import { expect, test } from 'vitest';

import { defaultBand, type Band } from '../../bands/catalog';
import { formatNote } from '../../bands/format';
import { bandAt, moveGroup, wheelQ } from '../editing';

const band = (slot: number, settings: Partial<Band>): Band => ({
  ...defaultBand,
  active: true,
  slot,
  ...settings,
});

// 100 px per decade from 10 Hz; 10 px per dB, 0 dB at 300 px.
const x = {
  map: (hz: number) => 100 * Math.log10(hz / 10),
  invert: (px: number) => 10 * 10 ** (px / 100),
};
const y = { map: (db: number) => 300 - 10 * db, invert: (px: number) => (300 - px) / 10 };

test('a double-click adds a cut near either end, a bell at the pointer otherwise', () => {
  expect(bandAt(22, 5)).toEqual({ type: 'lowCut', frequency: 22 });
  expect(bandAt(18_000, 5)).toEqual({ type: 'highCut', frequency: 18_000 });
  expect(bandAt(440, 2.345)).toEqual({ type: 'bell', frequency: 440, gain: 2.3 });
  expect(bandAt(2, 0).frequency).toBe(10);
});

test('a group keeps its ratios and differences, and stops at the first edge', () => {
  const bands = [
    band(1, { type: 'bell', frequency: 100, gain: -2 }),
    band(2, { type: 'notch', frequency: 1000, gain: 0 }),
  ];
  const moved = moveGroup(bands, [100, -30], x, y, 12);
  expect(moved.get(1)!.frequency).toBeCloseTo(1000);
  expect(moved.get(2)!.frequency).toBeCloseTo(10_000);
  expect(moved.get(1)!.gain).toBeCloseTo(1);
  expect(moved.get(2)!.gain).toBeUndefined();

  // Band 2 reaches 30 kHz first; band 1 stops with it, the same ratio below.
  const far = moveGroup(bands, [400, -500], x, y, 12);
  expect(far.get(2)!.frequency).toBeCloseTo(30_000);
  expect(far.get(1)!.frequency).toBeCloseTo(3000);
  expect(far.get(1)!.gain).toBeCloseTo(12);
});

test('a wheel notch scales Q, finer with Shift, within its range', () => {
  expect(wheelQ(1, -1, false)).toBeCloseTo(1.12);
  expect(wheelQ(1, 1, false)).toBeCloseTo(1 / 1.12);
  expect(wheelQ(1, -1, true)).toBeCloseTo(1.02);
  expect(wheelQ(40, -1, false)).toBe(40);
  expect(wheelQ(1, 0, false)).toBe(1);
});

test('names the nearest note and how far off it is', () => {
  expect(formatNote(440)).toBe('A4');
  expect(formatNote(261.63)).toBe('C4');
  expect(formatNote(450)).toBe('A4 +39¢');
  expect(formatNote(3100)).toBe('G7 −20¢');
  expect(formatNote(27.5)).toBe('A0');
});
