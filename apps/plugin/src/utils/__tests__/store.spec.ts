import { describe, expect, test, vi } from 'vitest';

import { createStore } from '../store';

describe('createStore', () => {
  test('tells its listeners of a new value, and only of a new one', () => {
    const store = createStore(1);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
    store.set(2);
    expect(listener).toHaveBeenCalledOnce();
    expect(store.get()).toBe(2);
  });

  test('compares with the equality it is given', () => {
    const store = createStore([1, 2], (a, b) => a.join() === b.join());
    const listener = vi.fn();
    store.subscribe(listener);
    const first = store.get();
    store.set([1, 2]);
    expect(store.get()).toBe(first);
    expect(listener).not.toHaveBeenCalled();
  });

  test('always tells, for a value published in place', () => {
    const frame = { level: 0 };
    const store = createStore(frame, () => false);
    const listener = vi.fn();
    store.subscribe(listener);
    frame.level = 1;
    store.set(frame);
    expect(listener).toHaveBeenCalledOnce();
  });

  test('stops telling a listener that unsubscribed', () => {
    const store = createStore(0);
    const listener = vi.fn();
    store.subscribe(listener)();
    store.set(1);
    expect(listener).not.toHaveBeenCalled();
  });
});
