import { useSyncExternalStore } from 'react';

// A value kept outside React state, for state that many views read but few
// should re-render for: a view subscribes with `useStore`, and code outside
// React reads it with `get`.

export interface Store<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/**
 * A store holding `initial`. `set` tells the listeners only when `equal` says
 * the value changed; pass `() => false` for a value published in place, which
 * is the same object each time.
 */
export function createStore<T>(initial: T, equal: (a: T, b: T) => boolean = Object.is): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      if (equal(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const useStore = <T>(store: Store<T>) => useSyncExternalStore(store.subscribe, store.get);
