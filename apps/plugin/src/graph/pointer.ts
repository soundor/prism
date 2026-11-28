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
