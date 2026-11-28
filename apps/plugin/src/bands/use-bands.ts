import { useSyncExternalStore } from 'react';

import { useSelector, type Source } from '../utils/store';

import { bandParameter } from './band-parameters';
import { bandFields, bandSlots, type Band } from './catalog';

// The 216 band parameters, read as one list of bands. While anything listens
// the store subscribes to every parameter, and after a change reads again only
// the slots that changed: an unchanged band stays the same object, and an
// unchanged list the same array, so a view memoized on a band re-renders only
// for its own.

export function readSlot(slot: number): Band {
  const band: Record<string, unknown> = { slot };
  for (const field of bandFields) band[field] = bandParameter(slot, field).get();
  return band as unknown as Band;
}

const sameBand = (a: Band, b: Band) => bandFields.every((field) => a[field] === b[field]);

const listeners = new Set<() => void>();
/** Every slot's band, by index; null until first read. */
let slots: Band[] | null = null;
/** Indices of slots whose parameters changed since they were read. */
const stale = new Set<number>();
let all: readonly Band[] = [];
let active: readonly Band[] = [];
let stopWatching: (() => void) | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stopWatching) {
    const stops = bandSlots.flatMap((slot, i) => {
      const changed = () => {
        stale.add(i);
        for (const listener of listeners) listener();
      };
      return bandFields.map((field) => bandParameter(slot, field).subscribe(changed));
    });
    stopWatching = () => stops.forEach((stop) => stop());
    // Unwatched until now: any slot may be stale.
    for (let i = 0; i < bandSlots.length; i++) stale.add(i);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopWatching?.();
    stopWatching = null;
  };
}

/** Reads the stale slots again, keeping each band, and the lists, that did not change. */
function refresh() {
  if (!slots) {
    slots = bandSlots.map(readSlot);
    stale.clear();
  } else if (stale.size === 0) {
    return;
  } else {
    let changed = false;
    for (const i of stale) {
      const fresh = readSlot(bandSlots[i]!);
      if (!sameBand(fresh, slots[i]!)) {
        slots[i] = fresh;
        changed = true;
      }
    }
    stale.clear();
    if (!changed) return;
  }
  all = slots.slice();
  const next = all.filter((band) => band.active);
  if (next.length !== active.length || next.some((band, i) => band !== active[i])) active = next;
}

/** Every slot, active or not, in slot order. */
export function getAllBands(): readonly Band[] {
  // Unwatched, nothing marks a slot stale: read them all.
  if (!stopWatching) for (let i = 0; i < bandSlots.length; i++) stale.add(i);
  refresh();
  return all;
}

/** The bands in use (active slots), in slot order. */
export function getBands(): readonly Band[] {
  getAllBands();
  return active;
}

export const allBandsSource: Source<readonly Band[]> = { get: getAllBands, subscribe };
export const bandsSource: Source<readonly Band[]> = { get: getBands, subscribe };

/** The bands in use (active slots), in slot order, re-rendering on any change. */
export const useBands = (): readonly Band[] => useSyncExternalStore(subscribe, getBands);

export const useAllBands = (): readonly Band[] => useSyncExternalStore(subscribe, getAllBands);

/**
 * The fields that decide how a band is drawn and listed, apart from where
 * its marker is: a band strip or a menu needs these and no others.
 */
const shapeFields = ['active', 'enabled', 'type', 'slope', 'channel', 'solo'] as const;

/** The same bands in the same slots, alike in every field but frequency, gain and Q. */
export function sameShapes(a: readonly Band[], b: readonly Band[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x !== y && (x.slot !== y.slot || shapeFields.some((field) => x[field] !== y[field])))
      return false;
  }
  return true;
}

const itself = <T>(value: T) => value;

/**
 * The bands in use, re-rendering when one is added or removed or changes
 * type, slope, channel, on or solo, and not while it is dragged. Its
 * frequency, gain and Q are those of the last such change: for views that do
 * not show them, or bind to the parameters themselves.
 */
export const useBandShapes = (): readonly Band[] => useSelector(bandsSource, itself, sameShapes);
