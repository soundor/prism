import { useMemo } from 'react';

import { createStore, useStore } from '../utils/store';

import type { Band } from './catalog';
import { useBands } from './use-bands';

// Which bands are selected: editor state, never saved, automated or undone.
// It holds slot numbers; readers see only the slots that hold a band, so a
// band that is deleted or replaced by a preset leaves the selection by itself.

const sameSlots = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((slot, i) => slot === b[i]);

const selection = createStore<readonly number[]>([], sameSlots);

/** Replaces the selection, in slot order. */
export function setSelection(slots: Iterable<number>) {
  selection.set([...new Set(slots)].sort((a, b) => a - b));
}

export const selectOnly = (slot: number) => setSelection([slot]);

export const clearSelection = () => setSelection([]);

/** Adds the band to the selection, or takes it out. */
export function toggleSelected(slot: number) {
  const selected = selection.get();
  setSelection(selected.includes(slot) ? selected.filter((s) => s !== slot) : [...selected, slot]);
}

/** The selected slots, active or not; for code outside React. */
export const selectedSlots = selection.get;

/** The selected bands, in slot order. */
export function useSelection(): readonly Band[] {
  const bands = useBands();
  const slots = useStore(selection);
  return useMemo(() => bands.filter((band) => slots.includes(band.slot)), [bands, slots]);
}
