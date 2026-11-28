import { testParameters } from '@soundor/testing-library/react';
import { expect, test, vi } from 'vitest';

import { createCurves } from '../curves';

test('computes again only the curve of the band that changed', () => {
  testParameters.set('band1Active', true);
  testParameters.set('band2Active', true);
  testParameters.set('band2Frequency', 4000);
  const curves = createCurves();
  const first = curves.band(1).get();
  const second = curves.band(2).get();
  const combined = curves.combined.get();

  testParameters.set('band2Gain', 6);
  expect(curves.band(1).get()).toBe(first);
  expect(curves.band(2).get()).not.toBe(second);
  expect(curves.combined.get()).not.toBe(combined);
});

test('computes the phase when it is drawn', () => {
  testParameters.set('band1Active', true);
  testParameters.set('band1Gain', 6);
  const curves = createCurves();
  curves.combined.get();
  const degrees = (curves.phase.get().points ?? []).map(([, value]) => value);
  expect(degrees.some((value) => value !== 0)).toBe(true);
});

test('one series that stops listening leaves the others listening', () => {
  // A Plot gives every series the same listener, its controller's invalidate.
  const invalidate = vi.fn();
  const curves = createCurves();
  const stopFirst = curves.band(1).subscribe(invalidate);
  const stopSecond = curves.band(2).subscribe(invalidate);
  stopFirst();
  testParameters.set('band2Gain', 3);
  expect(invalidate).toHaveBeenCalled();
  stopSecond();
});
