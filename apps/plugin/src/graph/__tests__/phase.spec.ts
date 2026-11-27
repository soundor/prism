import { expect, test } from 'vitest';

import { formatDegrees, phasePoints, wrapDegrees } from '../phase';
import { GRID_POINTS } from '../response';

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
