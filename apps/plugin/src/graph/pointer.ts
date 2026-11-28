import { createStore } from '../utils/store';

// The pointer over the graph, and whether Shift is held, kept outside React
// state so that a pointer move renders only the views that read them.

/** Where the pointer is, in the Plot's pixels, or null when it is off the graph. */
export const pointerStore = createStore<readonly [number, number] | null>(null);

/** Shift is held: a drag is in fine adjustment. */
export const shiftStore = createStore(false);

/** Alt (Option on a Mac) is held: the hovered marker shows its tooltip. */
export const altStore = createStore(false);

/** Keeps the modifier stores up to date from any event that carries them. */
export function trackModifiers(event: { shiftKey: boolean; altKey: boolean }) {
  shiftStore.set(event.shiftKey);
  altStore.set(event.altKey);
}

/** The slot of the marker under the pointer, or null. */
export const hoveredStore = createStore<number | null>(null);

/** The slot of the marker being dragged, or moved with its keys, or null. */
export const draggingStore = createStore<number | null>(null);

/** Sets `store` to `slot` while `on`, and clears it when that slot turns off. */
export function claim(store: { get(): number | null; set(slot: number | null): void }) {
  return (slot: number, on: boolean) => {
    if (on) store.set(slot);
    else if (store.get() === slot) store.set(null);
  };
}

/**
 * The band whose values the graph shows: the one dragged, or, while Alt is
 * held, the one under the pointer.
 */
export const shownSource = {
  get: () => draggingStore.get() ?? (altStore.get() ? hoveredStore.get() : null),
  subscribe(listener: () => void) {
    const stops = [draggingStore, altStore, hoveredStore].map((store) => store.subscribe(listener));
    return () => stops.forEach((stop) => stop());
  },
};
