import { useRef, useSyncExternalStore } from 'react';

// A value kept outside React state, for state that many views read but few
// should re-render for: a view subscribes with `useStore`, or to a part of it
// with `useSelector`, and code outside React reads it with `get`.

/** Anything that can be read and watched. */
export interface Source<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
}

export interface Store<T> extends Source<T> {
  set(value: T): void;
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

export const useStore = <T>(source: Source<T>) =>
  useSyncExternalStore(source.subscribe, source.get);

/**
 * What `select` makes of the source's value, re-rendering only when `equal`
 * says that changed. `select` runs again only for a new value or a new
 * `select`: give it a stable one (module-level, or from useCallback).
 */
export function useSelector<S, T>(
  source: Source<S>,
  select: (value: S) => T,
  equal: (a: T, b: T) => boolean = Object.is,
): T {
  const last = useRef<{ input: S; select: (value: S) => T; output: T } | null>(null);
  const read = () => {
    const input = source.get();
    const memo = last.current;
    if (memo && memo.input === input && memo.select === select) return memo.output;
    const output = select(input);
    if (memo && equal(memo.output, output)) {
      memo.input = input;
      memo.select = select;
      return memo.output;
    }
    last.current = { input, select, output };
    return output;
  };
  return useSyncExternalStore(source.subscribe, read);
}

/** Two arrays with the same items, by `Object.is`. */
export function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
