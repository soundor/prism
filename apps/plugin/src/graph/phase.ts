import { gridFrequencies } from './response';

// The phase view: the combined response's phase in degrees, wrapped to
// ±180°, on an axis of its own. The band markers keep their gain positions.

/** Ticks of the phase axis, in degrees. */
export const phaseTicks = [-180, -90, 0, 90, 180];

/** "+90°", "−180°", "0°". */
export function formatDegrees(value: number): string {
  if (value > 0) return `+${value}°`;
  if (value < 0) return `−${-value}°`;
  return '0°';
}

/** An angle in degrees, wrapped to [−180, 180). */
export function wrapDegrees(degrees: number): number {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/**
 * Phases in radians across the display grid as [Hz, degrees] points, wrapped
 * to ±180°. Where the wrapped curve jumps by more than half a turn, a point
 * with no value breaks the line, so that it does not cross the whole plot.
 */
export function phasePoints(phase: ArrayLike<number>): [number, number][] {
  const points: [number, number][] = [];
  let previous: number | null = null;
  for (const [i, frequency] of gridFrequencies.entries()) {
    const degrees = wrapDegrees((phase[i]! * 180) / Math.PI);
    if (previous !== null && Math.abs(degrees - previous) > 180) points.push([frequency, NaN]);
    points.push([frequency, degrees]);
    previous = degrees;
  }
  return points;
}
