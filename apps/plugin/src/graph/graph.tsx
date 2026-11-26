import { Plot, type PlotGroupDrag, type PlotSelection } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, useParameter, useStateValue, View } from '@soundor/react';
import { createRef, useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { parameters } from 'soundor:parameters';
import { state } from 'soundor:state';
import type { PointerEvent, UiNode } from 'soundor:ui';

import { GRAPH_HEIGHT, GRAPH_WIDTH } from '../app/layout';
import { FREQUENCY_MAX, FREQUENCY_MIN, type Band } from '../bands/catalog';
import { addBand, beginBandsMove, deleteBands, type BandsMove } from '../bands/edit';
import { setSelection, useSelection } from '../bands/selection';
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
import { bandAt, moveGroup } from './editing';
import { BandTooltip, EmptyHint, GraphStatus, Readout } from './overlays';
import { altStore, pointerStore, trackModifiers, useStore } from './pointer';
import { bandResponse, combine, GRID_POINTS, toPoints, type Response } from './response';

/**
 * The plot starts this far below the graph's top edge, leaving room for the
 * unit labels; the Plot keeps its own margin of 10 above its frame.
 */
const PLOT_OFFSET = 20;

/** Opacity of everything drawn from the bands while the plugin is bypassed. */
const BYPASSED_OPACITY = 0.35;

// The equalizer graph: grid and axes, each band's response, the combined
// response, and the band markers on top, which are dragged to edit the
// bands. A double-click on the graph adds a band; a drag on it selects the
// markers in a rectangle.
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
  const soloed = bands.find((band) => band.solo);
  const soloing = soloed !== undefined;
  const limit = rangeDecibels[range];
  const analyzerAxis = analyzerMode !== 'off' || spectrogram;
  const fade = bypassed ? BYPASSED_OPACITY : 1;

  const [hovered, setHovered] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const markerRefs = useMarkerRefs();
  const selectionProps = usePlotSelection(bands, limit);
  // A drag shows its band's values. Otherwise both readings, a marker's
  // tooltip and the cursor readout, show only while Alt is held, so that
  // moving over the graph does not cover it.
  const alt = useStore(altStore);
  const shown = dragging ?? (alt ? hovered : null);
  const shownBand = bands.find((band) => band.slot === shown);

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
      <View
        style={{ position: 'absolute', left: 0, top: PLOT_OFFSET }}
        onPointerMoveCapture={trackPointer}
        onPointerDownCapture={trackPointer}
        onPointerLeave={() => {
          pointerStore.set(null);
          altStore.set(false);
        }}
      >
        <Plot
          width={GRAPH_WIDTH}
          height={GRAPH_HEIGHT - PLOT_OFFSET}
          accessibilityLabel="Equalizer response and bands"
          styles={{ root: { backgroundColor: theme.color.display, borderRadius: 0 } }}
          selection={selectionProps}
          onBackgroundDoubleClick={({ data: [hz, db] }) => addBand(bands, bandAt(hz, db))}
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

          {dragging !== null && shownBand && (
            <Plot.VerticalLine
              value={shownBand.frequency}
              color={bandColor(theme, shownBand.slot)}
              dash={[2, 4]}
            />
          )}

          {bands.map((band) => {
            const selected = selection.some((s) => s.slot === band.slot);
            return (
              <BandMarker
                key={band.slot}
                band={band}
                bands={bands}
                soloed={band.solo}
                dimmed={soloing && !band.solo}
                bypassed={bypassed}
                selected={selected}
                nodeRef={markerRefs(band.slot)}
                onHover={(on) =>
                  setHovered((current) => (on ? band.slot : current === band.slot ? null : current))
                }
                onDragChange={(on) =>
                  setDragging((current) =>
                    on ? band.slot : current === band.slot ? null : current,
                  )
                }
                removeLabel={
                  selected && selection.length > 1 ? 'Delete selected bands' : 'Delete band'
                }
                onRemove={() => deleteBands(selected ? selection.map((s) => s.slot) : [band.slot])}
              />
            );
          })}

          {bands.length === 0 && <EmptyHint />}
          <Readout hidden={!alt || shown !== null} />
        </Plot>
      </View>
      {shownBand && (
        <BandTooltip
          band={shownBand}
          anchor={markerRefs(shownBand.slot)}
          dragging={dragging !== null}
        />
      )}
      {bypassed ? (
        <GraphStatus label="Bypassed" color={theme.color.displayWarning} />
      ) : soloed ? (
        <GraphStatus label={`Solo · Band ${soloed.slot}`} color={bandColor(theme, soloed.slot)} />
      ) : null}
      <UnitLabels analyzer={analyzerAxis} />
    </View>
  );
}

/** Keeps the pointer's place, in the Plot's pixels, and whether Shift is held. */
function trackPointer(event: PointerEvent) {
  trackModifiers(event);
  let box;
  try {
    box = event.currentTarget?.getBoundingClientRect();
  } catch {
    // No layout to measure against, as in the simulated runtime of the tests.
    return;
  }
  pointerStore.set([event.pageX - (box?.x ?? 0), event.pageY - (box?.y ?? 0)]);
}

/** One ref per slot, kept across renders, for the tooltip's anchor. */
function useMarkerRefs() {
  const refs = useRef(new Map<number, RefObject<UiNode | null>>());
  return useCallback((slot: number) => {
    let ref = refs.current.get(slot);
    if (!ref) {
      ref = createRef<UiNode>();
      refs.current.set(slot, ref);
    }
    return ref;
  }, []);
}

/**
 * The Plot's side of the selection: a marker click selects, Shift adds and
 * Ctrl or Cmd toggles; a drag on the background selects a rectangle; a drag
 * of a selected marker moves all the selected bands, as one undo step.
 */
function usePlotSelection(bands: readonly Band[], gainLimit: number): PlotSelection {
  const selection = useSelection();
  const group = useRef<{ bands: readonly Band[]; edit: BandsMove } | null>(null);
  const onGroupDrag = (event: PlotGroupDrag) => {
    if (event.phase === 'start') {
      const members = bands.filter((band) => event.ids.includes(String(band.slot)));
      group.current = {
        bands: members,
        edit: beginBandsMove(members, ['frequency', 'gain'], 'Move bands'),
      };
      return;
    }
    const active = group.current;
    if (!active) return;
    if (event.phase === 'move') {
      const { x, y } = event.coordinates;
      const moved = moveGroup(active.bands, event.delta, x, y, gainLimit);
      active.edit.update((band) => moved.get(band.slot)!);
      return;
    }
    group.current = null;
    if (event.phase === 'cancel') active.edit.restore();
    active.edit.end();
  };
  return {
    selectedIds: selection.map((band) => String(band.slot)),
    onSelectionChange: (ids) => setSelection(ids.map(Number)),
    multiple: true,
    rectangle: true,
    onGroupDrag,
  };
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
