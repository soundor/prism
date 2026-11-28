import { createStore, sameItems, useSelector, useStore, type Source } from '../utils/store';

import type { Band } from './catalog';
import { bandsSource, sameShapes } from './use-bands';

// Which bands are selected: editor state, never saved, automated or undone.
// It holds slot numbers; readers see only the slots that hold a band, so a
// band that is deleted or replaced by a preset leaves the selection by itself.

const selection = createStore<readonly number[]>([], sameItems);

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

/** The selected slots, active or not, re-rendering only when the selection changes. */
export const useSelectedSlots = () => useStore(selection);

let cache: { bands: readonly Band[]; slots: readonly number[]; selected: readonly Band[] } | null =
  null;

/** The selected bands, in slot order; the same array until either list changes. */
export function getSelection(): readonly Band[] {
  const bands = bandsSource.get();
  const slots = selection.get();
  if (cache?.bands !== bands || cache.slots !== slots) {
    const selected = bands.filter((band) => slots.includes(band.slot));
    cache = {
      bands,
      slots,
      selected: cache && sameItems(cache.selected, selected) ? cache.selected : selected,
    };
  }
  return cache.selected;
}

export const selectionSource: Source<readonly Band[]> = {
  get: getSelection,
  subscribe(listener) {
    const stops = [bandsSource.subscribe(listener), selection.subscribe(listener)];
    return () => stops.forEach((stop) => stop());
  },
};

const itself = <T>(value: T) => value;

/** The selected bands, in slot order, re-rendering on any change to them. */
export const useSelection = (): readonly Band[] => useStore(selectionSource);

/**
 * The selected bands, re-rendering only for what `useBandShapes` does: their
 * frequency, gain and Q may be out of date.
 */
export const useSelectionShapes = (): readonly Band[] =>
  useSelector(selectionSource, itself, sameShapes);
