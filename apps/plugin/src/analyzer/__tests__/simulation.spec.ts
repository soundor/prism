import { parameters } from 'soundor:parameters';
import { state } from 'soundor:state';
import { expect, test, vi } from 'vitest';

import { createSimulation } from '../simulation';

test('freezing holds the spectrum', () => {
  vi.useFakeTimers();
  const simulation = createSimulation();
  const stop = simulation.start();
  try {
    const before = simulation.pre.get();
    simulation.setFrozen(true);
    parameters.outputGain.set(24);
    vi.advanceTimersByTime(66);
    expect(simulation.pre.get()).toBe(before);

    simulation.setFrozen(false);
    vi.advanceTimersByTime(33);
    expect(simulation.pre.get()).not.toBe(before);
    const resumed = simulation.pre.get();
    state.analyzerMode.set('off');
    vi.advanceTimersByTime(33);
    expect(simulation.pre.get()).toBe(resumed);
  } finally {
    stop();
    vi.useRealTimers();
  }
});
