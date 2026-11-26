import {
  FREQUENCY_MAX,
  FREQUENCY_MIN,
  hasGain,
  Q_MAX,
  Q_MIN,
  type Band,
  type BandSettings,
} from '../bands/catalog';
import type { ContinuousValues } from '../bands/edit';

// What the graph's gestures do to the bands, apart from the pointer.

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Below this, a double-click on the graph adds a low cut. */
export const LOW_CUT_BELOW = 30;
/** Above this, a high cut. */
export const HIGH_CUT_ABOVE = 16_000;

/**
 * The band a double-click at `frequency` and `gain` adds: a cut near either
 * end of the range, a bell at the pointer otherwise.
 */
export function bandAt(frequency: number, gain: number): Partial<BandSettings> {
  const hz = clamp(frequency, FREQUENCY_MIN, FREQUENCY_MAX);
  if (hz < LOW_CUT_BELOW) return { type: 'lowCut', frequency: hz };
  if (hz > HIGH_CUT_ABOVE) return { type: 'highCut', frequency: hz };
  return { type: 'bell', frequency: hz, gain: Math.round(gain * 10) / 10 };
}

/** One axis of the plot: value to pixel and back. */
interface Scale {
  map(value: number): number;
  invert(pixel: number): number;
}

/**
 * Each band of a group moved by the same pixel `delta`, which keeps their
 * frequency ratios and gain differences. The delta is cut short so the band
 * nearest an edge stops there, rather than the group bunching up against it.
 * Bands without gain move across only.
 */
export function moveGroup(
  bands: readonly Band[],
  delta: readonly [number, number],
  x: Scale,
  y: Scale,
  gainLimit: number,
): Map<number, ContinuousValues> {
  const dx = clamp(
    delta[0],
    Math.max(...bands.map((band) => x.map(FREQUENCY_MIN) - x.map(band.frequency))),
    Math.min(...bands.map((band) => x.map(FREQUENCY_MAX) - x.map(band.frequency))),
  );
  const gained = bands.filter((band) => hasGain(band.type));
  // Pixels grow downwards, so the top edge is the highest gain.
  const dy =
    gained.length === 0
      ? 0
      : clamp(
          delta[1],
          Math.max(...gained.map((band) => y.map(gainLimit) - y.map(band.gain))),
          Math.min(...gained.map((band) => y.map(-gainLimit) - y.map(band.gain))),
        );
  return new Map(
    bands.map((band) => [
      band.slot,
      {
        frequency: clamp(x.invert(x.map(band.frequency) + dx), FREQUENCY_MIN, FREQUENCY_MAX),
        ...(hasGain(band.type) && {
          gain: clamp(y.invert(y.map(band.gain) + dy), -gainLimit, gainLimit),
        }),
      },
    ]),
  );
}

/** Q after one wheel notch: ×1.12 up, ÷1.12 down; ×1.02 with Shift. */
export function wheelQ(q: number, deltaY: number, fine: boolean): number {
  if (deltaY === 0) return q;
  const factor = fine ? 1.02 : 1.12;
  return clamp(deltaY < 0 ? q * factor : q / factor, Q_MIN, Q_MAX);
}

/** How long the wheel rests before its turns so far become one undo step. */
export const WHEEL_SETTLE_MS = 400;
