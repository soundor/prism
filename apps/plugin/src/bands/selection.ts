import { useMemo, useSyncExternalStore } from 'react';

import type { Band } from './catalog';
import { useBands } from './use-bands';

// Which bands are selected: editor state, never saved, automated or undone.
// It holds slot numbers; readers see only the slots that hold a band, so a
// band that is deleted or replaced by a preset leaves the selection by itself.

const listeners = new Set<() => void>();
let selected: readonly number[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSelection = () => selected;

/** Replaces the selection, in slot order. */
export function setSelection(slots: Iterable<number>) {
  const next = [...new Set(slots)].sort((a, b) => a - b);
  if (next.length === selected.length && next.every((slot, i) => slot === selected[i])) return;
  selected = next;
  for (const listener of listeners) listener();
}

export const selectOnly = (slot: number) => setSelection([slot]);

export const clearSelection = () => setSelection([]);

/** Adds the band to the selection, or takes it out. */
export function toggleSelected(slot: number) {
  setSelection(selected.includes(slot) ? selected.filter((s) => s !== slot) : [...selected, slot]);
}

/** The selected slots, active or not; for code outside React. */
export const selectedSlots = getSelection;

/** The selected bands, in slot order. */
export function useSelection(): readonly Band[] {
  const bands = useBands();
  const slots = useSyncExternalStore(subscribe, getSelection);
  return useMemo(() => bands.filter((band) => slots.includes(band.slot)), [bands, slots]);
}
