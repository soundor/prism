import { describe, expect, test } from 'vitest';

import { drumLoop, pinkNoise, sineSweep, SWEEP_SECONDS, synthLoop } from '../signals';

const RATE = 48_000;

const peak = (samples: Float32Array) => samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);

/** The average power at `frequency`, over Hann-windowed stretches of 4096. */
function power(samples: Float32Array, frequency: number) {
  const size = 4096;
  let total = 0;
  let count = 0;
  for (let start = 0; start + size <= samples.length; start += size) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < size; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
      const angle = (2 * Math.PI * frequency * (start + i)) / RATE;
      re += samples[start + i]! * w * Math.cos(angle);
      im += samples[start + i]! * w * Math.sin(angle);
    }
    total += re * re + im * im;
    count++;
  }
  return total / count;
}

describe.each([
  ['synth loop', synthLoop, 4, 1],
  ['drum loop', drumLoop, 4, 1],
  ['pink noise', pinkNoise, 8, 2],
  ['sine sweep', sineSweep, SWEEP_SECONDS + 1, 1],
] as const)('the %s', (_, render, seconds, channels) => {
  const rendered = render(RATE);

  test('has its length and channels', () => {
    expect(rendered).toHaveLength(channels);
    for (const samples of rendered) expect(samples.length).toBe(RATE * seconds);
  });

  test('stays below full scale', () => {
    for (const samples of rendered) {
      expect(samples.every(Number.isFinite)).toBe(true);
      expect(peak(samples)).toBeLessThan(0.9);
      expect(peak(samples)).toBeGreaterThan(0.05);
    }
  });

  test('is the same every time', () => {
    expect(render(RATE)).toEqual(rendered);
  });
});

test('pink noise falls 3 dB an octave, and its channels differ', () => {
  const [left, right] = pinkNoise(RATE);
  // Four octaves: 12 dB.
  const fall = 10 * Math.log10(power(left!, 100) / power(left!, 1600));
  expect(fall).toBeGreaterThan(10);
  expect(fall).toBeLessThan(14);
  let correlation = 0;
  for (let i = 0; i < left!.length; i++) correlation += left![i]! * right![i]!;
  const energy = left!.reduce((sum, s) => sum + s * s, 0);
  expect(Math.abs(correlation / energy)).toBeLessThan(0.05);
});

test('the sweep passes the geometric middle halfway through', () => {
  const [samples] = sineSweep(RATE);
  // Count zero crossings over 50 ms around the middle.
  const middle = (RATE * SWEEP_SECONDS) / 2;
  const span = RATE * 0.05;
  let crossings = 0;
  for (let i = middle - span / 2; i < middle + span / 2; i++) {
    if (samples![i]! <= 0 !== samples![i + 1]! <= 0) crossings++;
  }
  const frequency = crossings / 2 / 0.05;
  expect(frequency).toBeGreaterThan(600);
  expect(frequency).toBeLessThan(665);
  // Sweeps start and end silent, so the loop does not click.
  expect(samples![0]).toBe(0);
  expect(samples![samples!.length - 1]).toBe(0);
});
