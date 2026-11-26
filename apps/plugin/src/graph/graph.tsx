import { Plot } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, useParameter, useStateValue, View } from '@soundor/react';
import { useMemo } from 'react';
import { parameters } from 'soundor:parameters';
import { state } from 'soundor:state';

import { GRAPH_HEIGHT, GRAPH_WIDTH } from '../app/layout';
import { FREQUENCY_MAX, FREQUENCY_MIN, type Band } from '../bands/catalog';
import { useSelection } from '../bands/selection';
import { useBands } from '../bands/use-bands';
import {
  analyzerTicks,
  floorDecibels,
  formatFrequencyTick,
  formatSigned,
  frequencyTicks,
  gainTicks,
  rangeDecibels,
} from './axes';
import { bandColor } from './band-colors';
import { BandMarker } from './band-marker';
import { bandResponse, combine, GRID_POINTS, toPoints, type Response } from './response';

/**
 * The plot starts this far below the graph's top edge, leaving room for the
 * unit labels; the Plot keeps its own margin of 10 above its frame.
 */
const PLOT_OFFSET = 20;

/** Opacity of everything drawn from the bands while the plugin is bypassed. */
const BYPASSED_OPACITY = 0.35;

// The equalizer graph: grid and axes, each band's response, the combined
// response, and the band markers on top.
export function Graph() {
  const theme = useTheme();
  const bands = useBands();
  const selection = useSelection();
  const bypassed = useParameter(parameters.bypass);
  const range = useStateValue(state.displayRange);
  const analyzerMode = useStateValue(state.analyzerMode);
  const spectrogram = useStateValue(state.showSpectrogram);
  const floor = useStateValue(state.analyzerFloor);

  const responses = useResponses(bands);
  const soloing = bands.some((band) => band.solo);
  const limit = rangeDecibels[range];
  const analyzerAxis = analyzerMode !== 'off' || spectrogram;
  const fade = bypassed ? BYPASSED_OPACITY : 1;

  return (
    <View
      style={{
        width: GRAPH_WIDTH,
        height: GRAPH_HEIGHT,
        borderRadius: theme.radius.radiusXl,
        backgroundColor: theme.color.display,
        overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: PLOT_OFFSET }}>
        <Plot
          width={GRAPH_WIDTH}
          height={GRAPH_HEIGHT - PLOT_OFFSET}
          accessibilityLabel="Equalizer response and bands"
          styles={{ root: { backgroundColor: theme.color.display, borderRadius: 0 } }}
        >
          <Plot.XAxis
            domain={[FREQUENCY_MIN, FREQUENCY_MAX]}
            scale="log"
            ticks={frequencyTicks}
            minorTicks
            format={formatFrequencyTick}
          />
          <Plot.YAxis domain={[-limit, limit]} ticks={gainTicks(range)} format={formatSigned} />
          <Plot.YAxis
            id="analyzer"
            position="right"
            domain={[floorDecibels[floor], 0]}
            ticks={analyzerTicks(floor)}
            format={formatSigned}
            hidden={!analyzerAxis}
          />
          <Plot.Grid />
          <Plot.HorizontalLine value={0} color={theme.color.displayAxis} />

          {bands.map((band) => (
            <Plot.Line
              key={band.slot}
              points={responses.points.get(band.slot)!}
              color={bandColor(theme, band.slot)}
              opacity={bandCurveOpacity(band, soloing) * fade}
              strokeWidth={1}
              dash={band.enabled ? undefined : [3, 3]}
              extend
              hideInReadout
            />
          ))}

          {bands.length > 0 && (
            <>
              <Plot.Band
                lower={responses.zero}
                upper={responses.combined}
                color={theme.color.textInverse}
                opacity={0.05 * fade}
                hideInReadout
              />
              <Plot.Line
                points={responses.combined}
                color={theme.color.textInverse}
                opacity={fade}
                strokeWidth={2}
                extend
                label="Response"
              />
            </>
          )}

          {bands.map((band) => (
            <BandMarker
              key={band.slot}
              band={band}
              soloed={band.solo}
              dimmed={soloing && !band.solo}
              bypassed={bypassed}
              selected={selection.some((s) => s.slot === band.slot)}
            />
          ))}
        </Plot>
      </View>
      <UnitLabels analyzer={analyzerAxis} />
    </View>
  );
}

/** A band's own curve: faint beside the combined one, fainter when off or out of a solo. */
function bandCurveOpacity(band: Band, soloing: boolean) {
  if (!band.enabled) return 0.16;
  if (soloing && !band.solo) return 0.2;
  return 0.5;
}

/** "dB" at the top left, "dBFS" at the top right, "Hz" at the bottom right. */
function UnitLabels({ analyzer }: { analyzer: boolean }) {
  const theme = useTheme();
  const style = textStyle(theme, 'technical', theme.color.displayMuted);
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: GRAPH_WIDTH,
        height: GRAPH_HEIGHT,
        pointerEvents: 'none',
      }}
    >
      <Text style={[style, { position: 'absolute', left: 8, top: 8 }]}>dB</Text>
      {analyzer && <Text style={[style, { position: 'absolute', right: 6, top: 8 }]}>dBFS</Text>}
      <Text style={[style, { position: 'absolute', right: 6, bottom: 6 }]}>Hz</Text>
    </View>
  );
}

interface Curves {
  /** Each band's response, by slot. */
  points: Map<number, [number, number][]>;
  combined: [number, number][];
  zero: [number, number][];
}

const zeroPoints = toPoints(new Float64Array(GRID_POINTS));

/** Responses recomputed only for bands whose settings changed. */
function useResponses(bands: readonly Band[]): Curves {
  const cache = useMemo(() => new Map<number, { key: string; response: Response }>(), []);
  return useMemo(() => {
    const points = new Map<number, [number, number][]>();
    const active: Response[] = [];
    for (const band of bands) {
      const key = `${band.type}|${band.frequency}|${band.gain}|${band.q}|${band.slope}`;
      let entry = cache.get(band.slot);
      if (!entry || entry.key !== key) {
        entry = { key, response: bandResponse(band) };
        cache.set(band.slot, entry);
      }
      points.set(band.slot, toPoints(entry.response.decibels));
      if (band.enabled) active.push(entry.response);
    }
    return { points, combined: toPoints(combine(active).decibels), zero: zeroPoints };
  }, [bands, cache]);
}
