import { describe, expect, test } from 'vitest';

import { defaultBand, type BandSettings } from '../../bands/catalog';
import { bandResponse, combine, gridFrequencies, GRID_POINTS, responseAt } from '../response';

const band = (settings: Partial<BandSettings>) => ({ ...defaultBand, active: true, ...settings });
const decibelsAt = (settings: Partial<BandSettings>, hz: number) =>
  responseAt(band(settings), hz)[0];

describe('the display grid', () => {
  test('spans 10 Hz to 30 kHz, log-spaced', () => {
    expect(gridFrequencies).toHaveLength(GRID_POINTS);
    expect(gridFrequencies[0]).toBeCloseTo(10);
    expect(gridFrequencies.at(-1)).toBeCloseTo(30_000);
    const ratio = gridFrequencies[1]! / gridFrequencies[0]!;
    expect(gridFrequencies[200]! / gridFrequencies[199]!).toBeCloseTo(ratio);
  });
});

describe('band responses', () => {
  test('a bell reaches its gain at its frequency and is flat far away', () => {
    expect(decibelsAt({ type: 'bell', frequency: 1000, gain: 6, q: 1 }, 1000)).toBeCloseTo(6, 3);
    expect(decibelsAt({ type: 'bell', frequency: 1000, gain: -9, q: 1 }, 1000)).toBeCloseTo(-9, 3);
    expect(decibelsAt({ type: 'bell', frequency: 1000, gain: 6, q: 1 }, 20)).toBeCloseTo(0, 1);
  });

  test('a wider bell (lower Q) lifts more an octave away', () => {
    const wide = decibelsAt({ type: 'bell', gain: 6, q: 0.5 }, 2000);
    const narrow = decibelsAt({ type: 'bell', gain: 6, q: 4 }, 2000);
    expect(wide).toBeGreaterThan(narrow);
  });

  test('shelves reach their gain on their side and half of it at the corner', () => {
    const low = { type: 'lowShelf', frequency: 200, gain: 8, q: 0.707 } as const;
    expect(decibelsAt(low, 15)).toBeCloseTo(8, 1);
    expect(decibelsAt(low, 20_000)).toBeCloseTo(0, 1);
    expect(decibelsAt(low, 200)).toBeCloseTo(4, 1);
    const high = { type: 'highShelf', frequency: 5000, gain: -6, q: 0.707 } as const;
    expect(decibelsAt(high, 25_000)).toBeCloseTo(-6, 0);
    expect(decibelsAt(high, 50)).toBeCloseTo(0, 1);
  });

  test.each([
    ['db6', 6],
    ['db12', 12],
    ['db24', 24],
    ['db36', 36],
    ['db48', 48],
  ] as const)('a %s low cut falls %i dB per octave below its corner', (slope, perOctave) => {
    const cut = { type: 'lowCut', frequency: 1000, q: 0.707, slope } as const;
    const fall = decibelsAt(cut, 100) - decibelsAt(cut, 50);
    expect(fall).toBeCloseTo(perOctave, 0);
    expect(decibelsAt(cut, 1000)).toBeCloseTo(-3, 0);
    expect(decibelsAt(cut, 20_000)).toBeCloseTo(0, 1);
  });

  test('a high cut mirrors the low cut', () => {
    // Well below Nyquist: a digital cut falls faster as it nears it.
    const cut = { type: 'highCut', frequency: 200, q: 0.707, slope: 'db24' } as const;
    expect(decibelsAt(cut, 2000) - decibelsAt(cut, 4000)).toBeCloseTo(24, 0);
    expect(decibelsAt(cut, 200)).toBeCloseTo(-3, 0);
    expect(decibelsAt(cut, 20)).toBeCloseTo(0, 1);
  });

  test('Q above 0.707 makes a cut resonate at its corner', () => {
    const flat = decibelsAt({ type: 'lowCut', frequency: 500, q: 0.707, slope: 'db12' }, 500);
    const peaked = decibelsAt({ type: 'lowCut', frequency: 500, q: 4, slope: 'db12' }, 500);
    expect(peaked).toBeGreaterThan(flat + 10);
  });

  test('a notch removes its frequency, a band pass keeps only its own', () => {
    expect(decibelsAt({ type: 'notch', frequency: 3000, q: 4 }, 3000)).toBeLessThan(-60);
    expect(decibelsAt({ type: 'notch', frequency: 3000, q: 4 }, 300)).toBeCloseTo(0, 1);
    expect(decibelsAt({ type: 'bandPass', frequency: 3000, q: 1 }, 3000)).toBeCloseTo(0, 3);
    expect(decibelsAt({ type: 'bandPass', frequency: 3000, q: 1 }, 100)).toBeLessThan(-25);
  });

  test('gain-less types ignore the gain parameter', () => {
    for (const type of ['lowCut', 'highCut', 'notch', 'bandPass'] as const)
      expect(decibelsAt({ type, gain: 12 }, 1000)).toBeCloseTo(
        decibelsAt({ type, gain: 0 }, 1000),
        6,
      );
  });
});

describe('the combined response', () => {
  test('adds the bands in dB', () => {
    const a = bandResponse(band({ type: 'bell', frequency: 100, gain: 4 }));
    const b = bandResponse(band({ type: 'highShelf', frequency: 4000, gain: -3 }));
    const sum = combine([a, b]);
    for (const i of [0, 80, 160, 240, GRID_POINTS - 1])
      expect(sum.decibels[i]).toBeCloseTo(a.decibels[i]! + b.decibels[i]!, 9);
  });

  test('is flat with no bands', () => {
    expect(combine([]).decibels.every((value) => value === 0)).toBe(true);
  });
});
