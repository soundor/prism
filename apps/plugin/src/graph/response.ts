// The curves the graph draws, from the standard biquad formulas (R.
// Bristow-Johnson's Audio EQ Cookbook), a first-order section for 6 dB/oct
// and cascaded Butterworth sections for steeper cuts. The processor
// (lib/src/filter.rs) filters with the same responses: the fixture that
// __tests__/response-fixture.spec.ts writes holds the two together, so change
// both, and rewrite the fixture, when this math changes. The curves are
// computed at 96 kHz; at 44.1 or 48 kHz the audio falls a little earlier
// close to 20 kHz, as every bilinear-transform filter does.

import {
  FREQUENCY_MAX,
  FREQUENCY_MIN,
  slopeDecibels,
  type BandSettings,
  type FilterType,
} from '../bands/catalog';

/** The rate the curves are computed at: high enough to keep 20 kHz honest. */
export const SAMPLE_RATE = 96_000;
const NYQUIST_LIMIT = SAMPLE_RATE * 0.49;

/** b0, b1, b2, a0, a1, a2. */
type Section = readonly [number, number, number, number, number, number];

function biquad(type: FilterType, frequency: number, q: number, gain: number): Section {
  const w0 = (2 * Math.PI * Math.min(frequency, NYQUIST_LIMIT)) / SAMPLE_RATE;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a = 10 ** (gain / 40);
  switch (type) {
    case 'bell':
      return [1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a];
    case 'lowShelf': {
      const s = 2 * Math.sqrt(a) * alpha;
      return [
        a * (a + 1 - (a - 1) * cos + s),
        2 * a * (a - 1 - (a + 1) * cos),
        a * (a + 1 - (a - 1) * cos - s),
        a + 1 + (a - 1) * cos + s,
        -2 * (a - 1 + (a + 1) * cos),
        a + 1 + (a - 1) * cos - s,
      ];
    }
    case 'highShelf': {
      const s = 2 * Math.sqrt(a) * alpha;
      return [
        a * (a + 1 + (a - 1) * cos + s),
        -2 * a * (a - 1 + (a + 1) * cos),
        a * (a + 1 + (a - 1) * cos - s),
        a + 1 - (a - 1) * cos + s,
        2 * (a - 1 - (a + 1) * cos),
        a + 1 - (a - 1) * cos - s,
      ];
    }
    case 'notch':
      return [1, -2 * cos, 1, 1 + alpha, -2 * cos, 1 - alpha];
    case 'bandPass':
      return [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha];
    case 'highCut':
      return [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
    case 'lowCut':
      return [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
  }
}

/** A first-order (6 dB/oct) section, bilinear. */
function firstOrder(lowCut: boolean, frequency: number): Section {
  const k = Math.tan((Math.PI * Math.min(frequency, NYQUIST_LIMIT)) / SAMPLE_RATE);
  return lowCut ? [1, -1, 0, 1 + k, k - 1, 0] : [k, k, 0, 1 + k, k - 1, 0];
}

/** Butterworth stage Qs for 2, 4, 6 and 8 poles. */
const butterworth: Record<number, readonly number[]> = {
  1: [0.7071],
  2: [0.5412, 1.3066],
  3: [0.5176, 0.7071, 1.9319],
  4: [0.5098, 0.6013, 0.9, 2.5629],
};

type Shape = Pick<BandSettings, 'type' | 'frequency' | 'gain' | 'q' | 'slope'>;

function sections({ type, frequency, gain, q, slope }: Shape): Section[] {
  if (type === 'lowCut' || type === 'highCut') {
    const order = slopeDecibels[slope] / 6;
    if (order === 1) return [firstOrder(type === 'lowCut', frequency)];
    const stages = butterworth[order / 2]!;
    // The band's Q scales the last, most resonant stage; 0.7071 is neutral.
    return stages.map((stageQ, i) =>
      biquad(type, frequency, i === stages.length - 1 ? (stageQ * q) / 0.7071 : stageQ, 0),
    );
  }
  return [biquad(type, frequency, q, gain)];
}

/** Display frequencies, log-spaced across the graph's range. */
export const GRID_POINTS = 320;
export const gridFrequencies: Float64Array = Float64Array.from(
  { length: GRID_POINTS },
  (_, i) => FREQUENCY_MIN * (FREQUENCY_MAX / FREQUENCY_MIN) ** (i / (GRID_POINTS - 1)),
);

/** Per grid frequency: magnitude in dB and phase in radians (unwrapped). */
export interface Response {
  decibels: Float64Array;
  phase: Float64Array;
}

/** A band's response at one frequency: [dB, radians]. */
export function responseAt(band: Shape, frequency: number): [number, number] {
  return evaluate(sections(band), frequency);
}

function evaluate(list: readonly Section[], frequency: number): [number, number] {
  const w = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const c1 = Math.cos(w);
  const s1 = Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = Math.sin(2 * w);
  let decibels = 0;
  let phase = 0;
  for (const [b0, b1, b2, a0, a1, a2] of list) {
    const nr = b0 + b1 * c1 + b2 * c2;
    const ni = -(b1 * s1 + b2 * s2);
    const dr = a0 + a1 * c1 + a2 * c2;
    const di = -(a1 * s1 + a2 * s2);
    decibels += 10 * Math.log10(Math.max((nr * nr + ni * ni) / (dr * dr + di * di), 1e-18));
    phase += Math.atan2(ni, nr) - Math.atan2(di, dr);
  }
  return [decibels, phase];
}

/** A band's response across the display grid. */
export function bandResponse(band: Shape): Response {
  const list = sections(band);
  const decibels = new Float64Array(GRID_POINTS);
  const phase = new Float64Array(GRID_POINTS);
  for (let i = 0; i < GRID_POINTS; i++) {
    [decibels[i], phase[i]] = evaluate(list, gridFrequencies[i]!);
  }
  return { decibels, phase };
}

/** Bands in series: magnitudes in dB and phases add. */
export function combine(responses: readonly Response[]): Response {
  const decibels = new Float64Array(GRID_POINTS);
  const phase = new Float64Array(GRID_POINTS);
  for (const response of responses)
    for (let i = 0; i < GRID_POINTS; i++) {
      decibels[i]! += response.decibels[i]!;
      phase[i]! += response.phase[i]!;
    }
  return { decibels, phase };
}

/** Grid points as [Hz, value] pairs, for a Plot series. */
export function toPoints(values: ArrayLike<number>): [number, number][] {
  return Array.from(gridFrequencies, (frequency, i) => [frequency, values[i]!]);
}
