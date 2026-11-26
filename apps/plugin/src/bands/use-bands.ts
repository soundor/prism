import { useMemo, useSyncExternalStore } from 'react';

import { bandParameter } from './band-parameters';
import { bandFields, bandSlots, type Band } from './catalog';

// The 216 band parameters, read as one list of bands. While anything listens
// the store subscribes to every parameter and rebuilds its snapshot only after
// a change, so readers of an unchanged list get the same array.

function readSlot(slot: number): Band {
  const band: Record<string, unknown> = { slot };
  for (const field of bandFields) band[field] = bandParameter(slot, field).get();
  return band as unknown as Band;
}

const sameBand = (a: Band, b: Band) => bandFields.every((field) => a[field] === b[field]);

const listeners = new Set<() => void>();
let snapshot: readonly Band[] | null = null;
let stopWatching: (() => void) | null = null;

function changed() {
  snapshot = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stopWatching) {
    const stops = bandSlots.flatMap((slot) =>
      bandFields.map((field) => bandParameter(slot, field).subscribe(changed)),
    );
    stopWatching = () => stops.forEach((stop) => stop());
    // Unwatched until now: the cache may be stale.
    revalidate();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopWatching?.();
    stopWatching = null;
  };
}

/** Keeps the cached list while it matches the parameters, so it stays the same array. */
function revalidate(): readonly Band[] {
  const fresh = bandSlots.map(readSlot);
  if (!snapshot || fresh.some((band, i) => !sameBand(band, snapshot![i]!))) snapshot = fresh;
  return snapshot;
}

/** Every slot, active or not, in slot order. */
export function getAllBands(): readonly Band[] {
  // Unwatched, nothing tells the cache it is stale.
  return stopWatching && snapshot ? snapshot : revalidate();
}

/** The bands in use (active slots), in slot order, re-rendering on any change. */
export function useBands(): readonly Band[] {
  const all = useSyncExternalStore(subscribe, getAllBands);
  return useMemo(() => all.filter((band) => band.active), [all]);
}
