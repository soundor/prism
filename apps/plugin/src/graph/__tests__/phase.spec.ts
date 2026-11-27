import { expect, test } from 'vitest';

import { resample } from '../../analyzer/analyzer';
import { FREQUENCY_MAX, FREQUENCY_MIN } from '../../bands/catalog';
import { formatDegrees, phasePoints, wrapDegrees } from '../phase';
import { gridFrequencies, GRID_POINTS } from '../response';

test('wraps angles to ±180° and labels them', () => {
  expect(wrapDegrees(190)).toBeCloseTo(-170);
  expect(wrapDegrees(-190)).toBeCloseTo(170);
  expect(wrapDegrees(45)).toBe(45);
  expect(formatDegrees(90)).toBe('+90°');
  expect(formatDegrees(-180)).toBe('−180°');
  expect(formatDegrees(0)).toBe('0°');
});

test('breaks the phase curve where it wraps, rather than crossing the plot', () => {
  // A steady fall of two full turns across the grid.
  const phase = Float64Array.from(
    { length: GRID_POINTS },
    (_, i) => (-4 * Math.PI * i) / GRID_POINTS,
  );
  const points = phasePoints(phase);
  const breaks = points.filter(([, degrees]) => Number.isNaN(degrees));
  expect(breaks.length).toBe(2);
  expect(points.length).toBe(GRID_POINTS + 2);
  for (const [, degrees] of points)
    if (!Number.isNaN(degrees)) expect(Math.abs(degrees)).toBeLessThanOrEqual(180);
});

test('resamples a log-spaced spectrum onto equally spaced bins', () => {
  const points = Array.from(gridFrequencies, (hz) => [hz, Math.log10(hz)] as [number, number]);
  const bins = new Float32Array(1001);
  resample(points, bins);
  expect(bins[0]).toBeCloseTo(Math.log10(FREQUENCY_MIN), 3);
  expect(bins[1000]).toBeCloseTo(Math.log10(FREQUENCY_MAX), 3);
  const middle = FREQUENCY_MIN + (FREQUENCY_MAX - FREQUENCY_MIN) / 2;
  expect(bins[500]).toBeCloseTo(Math.log10(middle), 2);
});
