import { testParameters } from '@soundor/testing-library/react';
import { expect, test } from 'vitest';

import { bandsSource, getBands, sameShapes } from '../use-bands';

test('an edit replaces the band it changed, and keeps the others', () => {
  testParameters.set('band1Active', true);
  testParameters.set('band2Active', true);
  const stop = bandsSource.subscribe(() => {});
  try {
    const before = getBands();
    expect(getBands()).toBe(before);

    testParameters.set('band2Gain', 4);
    const after = getBands();
    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1]!.gain).toBe(4);

    // Set to what it already is: nothing changed, nothing is replaced.
    testParameters.set('band2Gain', 4);
    expect(getBands()).toBe(after);
  } finally {
    stop();
  }
});

test('shapes differ in how a band is drawn and listed, not in where', () => {
  testParameters.set('band1Active', true);
  const before = getBands();
  testParameters.set('band1Frequency', 2000);
  testParameters.set('band1Gain', -3);
  expect(sameShapes(before, getBands())).toBe(true);
  testParameters.set('band1Type', 'notch');
  expect(sameShapes(before, getBands())).toBe(false);
});
