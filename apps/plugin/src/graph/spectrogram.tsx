import {
  Spectrogram,
  usePlotCoordinates,
  type PlotSource,
  type SpectrumFrame,
} from '@soundor/components';
import { useTheme, type Theme } from '@soundor/components/theme';
import { View } from '@soundor/react';
import { useLayoutEffect, useMemo } from 'react';

import { FREQUENCY_MAX, FREQUENCY_MIN } from '../bands/catalog';

// The spectrogram view: the spectrum's history under the curves, in place of
// the spectrum. Frequency runs across, as on the graph, and time down.

/** Rows of history: about four seconds at the simulation's 30 frames a second. */
const HISTORY = 120;
/** Frequency columns drawn across the plot. */
const COLUMNS = 192;

export interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Reports the Plot's frame, where its axes map, so that a view laid under the
 * Plot can line up with it. Renders nothing.
 */
export function PlotFrame({ onChange }: { onChange: (frame: Frame) => void }) {
  const { left, top, width, height } = usePlotCoordinates().rect;
  useLayoutEffect(
    () => onChange({ left, top, width, height }),
    [onChange, left, top, width, height],
  );
  return null;
}

/**
 * The spectrogram, laid at `frame` (in the parent's pixels). Its colours span
 * the analyzer's range, from `floor` to 0 dBFS, as the dBFS axis does.
 */
export function SpectrogramLayer({
  source,
  frame,
  floor,
}: {
  source: PlotSource<SpectrumFrame>;
  frame: Frame;
  floor: number;
}) {
  const theme = useTheme();
  const colorMap = useMemo(() => heatMap(theme), [theme]);
  return (
    <View
      accessible={false}
      style={{
        position: 'absolute',
        left: frame.left,
        top: frame.top,
        pointerEvents: 'none',
      }}
    >
      <Spectrogram
        width={frame.width}
        height={frame.height}
        source={source}
        frequencyRange={[FREQUENCY_MIN, FREQUENCY_MAX]}
        frequencyScale="log"
        amplitudeRange={[floor, 0]}
        historyLength={HISTORY}
        bins={COLUMNS}
        orientation="vertical"
        colorMap={colorMap}
        accessibilityLabel="Spectrogram"
        styles={{ root: { borderRadius: 0 } }}
      />
    </View>
  );
}

/**
 * A sequential ramp in Prism's purple: from the graph's ground, so that
 * silence disappears into it, through dark violets that keep quiet material
 * unobtrusive, to a near-white lilac for the loudest. Lightness rises at
 * every stop, so louder always reads as brighter.
 */
export function heatMap(theme: Theme): (fraction: number) => string {
  const stops: readonly [number, string][] = [
    [0, theme.color.display],
    [1 / 7, '#20192f'],
    [2 / 7, '#35234f'],
    [3 / 7, '#56367c'],
    [4 / 7, '#8654b5'],
    [5 / 7, '#b78adf'],
    [6 / 7, '#dfc1f1'],
    [1, '#fff1fa'],
  ];
  return (fraction) => {
    const n = Math.min(1, Math.max(0, fraction));
    let i = 1;
    while (i < stops.length - 1 && stops[i]![0] < n) i++;
    const [p0, c0] = stops[i - 1]!;
    const [p1, c1] = stops[i]!;
    return mix(c0, c1, (n - p0) / (p1 - p0));
  };
}

function mix(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  const hex = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${hex.toString(16).padStart(6, '0')}`;
}
