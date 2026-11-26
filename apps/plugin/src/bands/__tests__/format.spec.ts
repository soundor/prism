import { expect, test } from 'vitest';

import { defaultBand } from '../catalog';
import { describeBand, formatFrequency, formatGain, formatQ } from '../format';

test('frequencies keep three significant figures', () => {
  expect(formatFrequency(31.5)).toBe('31.5 Hz');
  expect(formatFrequency(240)).toBe('240 Hz');
  expect(formatFrequency(3100)).toBe('3.10 kHz');
  expect(formatFrequency(11_500)).toBe('11.5 kHz');
});

test('gains are signed, with a true minus', () => {
  expect(formatGain(2.6)).toBe('+2.6 dB');
  expect(formatGain(-3.2)).toBe('−3.2 dB');
  expect(formatGain(-0.01)).toBe('0.0 dB');
});

test('Q keeps three significant figures', () => {
  expect(formatQ(0.707)).toBe('0.707');
  expect(formatQ(1.4)).toBe('1.40');
  expect(formatQ(12)).toBe('12.0');
});

test('a band is described by the settings its type uses', () => {
  const bell = { ...defaultBand, type: 'bell', frequency: 3100, gain: 2.6, q: 0.9 } as const;
  expect(describeBand(bell)).toBe('3.10 kHz, +2.6 dB, Q 0.900');
  const cut = {
    ...defaultBand,
    type: 'lowCut',
    frequency: 85,
    slope: 'db6',
    enabled: false,
  } as const;
  expect(describeBand(cut)).toBe('85.0 Hz, 6 dB/oct, bypassed');
  const notch = { ...defaultBand, type: 'notch', frequency: 6400, q: 6, channel: 'mid' } as const;
  expect(describeBand(notch)).toBe('6.40 kHz, Q 6.00, Mid');
});
