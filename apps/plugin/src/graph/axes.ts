import type { AnalyzerFloor, DisplayRange } from 'soundor:state';

// The graph's three axes: frequency (log), gain (the Range setting), and the
// analyzer's dBFS on the right, which has no grid of its own.

/** Labelled frequencies; the grid adds the 2–9 of each decade. */
export const frequencyTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000];

/** Half the gain axis, in dB, for each Range setting. */
export const rangeDecibels: Record<DisplayRange, number> = {
  db3: 3,
  db6: 6,
  db12: 12,
  db24: 24,
  db30: 30,
};

const gainSteps: Record<DisplayRange, number> = { db3: 1, db6: 2, db12: 3, db24: 6, db30: 10 };

const gainTickSets = Object.fromEntries(
  (Object.keys(rangeDecibels) as DisplayRange[]).map((range) => {
    const limit = rangeDecibels[range];
    const step = gainSteps[range];
    return [range, Array.from({ length: (2 * limit) / step + 1 }, (_, i) => -limit + i * step)];
  }),
) as Record<DisplayRange, number[]>;

/** Gain ticks from −range to +range: the same array for a range each time. */
export const gainTicks = (range: DisplayRange): number[] => gainTickSets[range];

/** The analyzer's floor, in dBFS: the bottom of its axis. */
export const floorDecibels: Record<AnalyzerFloor, number> = { db60: -60, db90: -90, db120: -120 };

const analyzerTickSets: Record<AnalyzerFloor, number[]> = {
  db60: [-48, -36, -24, -12],
  db90: [-80, -60, -40, -20],
  db120: [-120, -90, -60, -30],
};

export const analyzerTicks = (floor: AnalyzerFloor) => analyzerTickSets[floor];

/** A true minus sign, and a plus on positive values: "+6", "−12". */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${-value}`;
  return '0';
}

/** "20", "500", "1k", "20k". */
export const formatFrequencyTick = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);
