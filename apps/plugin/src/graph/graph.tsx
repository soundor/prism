import {
  Plot,
  type PlotGroupDrag,
  type PlotSamples,
  type PlotSelection,
  type PlotSource,
} from '@soundor/components';
import { ring, textStyle, useTheme } from '@soundor/components/theme';
import { Text, useParameter, useStateValue, View } from '@soundor/react';
import { Path, Svg } from '@soundor/react/svg';
import {
  createRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { parameters } from 'soundor:parameters';
import { state, type AnalyzerFloor } from 'soundor:state';
import type { PointerEvent, UiNode } from 'soundor:ui';

import type { Analyzer } from '../analyzer/analyzer';
import { GRAPH_HEIGHT, GRAPH_WIDTH } from '../app/layout';
import { FREQUENCY_MAX, FREQUENCY_MIN, hasGain, type Band } from '../bands/catalog';
import { addBand, beginBandsMove, type BandsMove } from '../bands/edit';
import { getSelection, selectionSource, setSelection, useSelectedSlots } from '../bands/selection';
import { bandsSource, getBands, useBandShapes, useBands } from '../bands/use-bands';
import { sameItems, useSelector, useStore } from '../utils/store';
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
import { createCurves } from './curves';
import { bandAt, moveGroup } from './editing';
import { BandTooltip, EmptyHint, GraphStatus, PhaseCaption, Readout } from './overlays';
import {
  altStore,
  draggingStore,
  hoveredStore,
  pointerStore,
  shownSource,
  trackModifiers,
} from './pointer';
import { formatDegrees, phaseTicks } from './phase';
import { PlotFrame, SpectrogramLayer, type Frame } from './spectrogram';

/**
 * The plot starts this far below the graph's top edge, leaving room for the
 * unit labels; the Plot keeps its own margin of 10 above its frame.
 */
const PLOT_OFFSET = 20;

/** Opacity of everything drawn from the bands while the plugin is bypassed. */
const BYPASSED_OPACITY = 0.35;
const PRE_TRACE = { color: '#747986', strokeWidth: 1 };
const POST_TRACE = { color: '#B3A5D8', strokeWidth: 1.5 };
const PEAK_DASH = [1, 3];
const POST_FILL = 0.18;
// Plot.Band renders its fill at a quarter of the supplied series opacity.
const POST_BAND_OPACITY = POST_FILL / 0.25;
/** The combined magnitude, kept as a ghost behind the phase curve. */
const MAGNITUDE_GHOST = { opacity: 0.22, strokeWidth: 1, dash: [2, 3] };
const KEYBOARD_HEIGHT = 22;

// The equalizer graph: grid and axes, each band's response, the combined
// response, and the band markers on top, which are dragged to edit the
// bands. A double-click on the graph adds a band; a drag on it selects the
// markers in a rectangle.
//
// A drag is the hot path, and the graph keeps it off React's: the curves are
// live sources the Plot reads as it draws (./curves), and this view reads the
// bands only as far as how they are drawn and listed, not where. A drag
// renders the markers' list, then the dragged marker alone; its line, its
// tooltip and the readout follow from their own stores.
export function Graph({ analyzer }: { analyzer: Analyzer }) {
  const theme = useTheme();
  const bands = useBandShapes();
  const bypassed = useParameter(parameters.bypass);
  const range = useStateValue(state.displayRange);
  const analyzerMode = useStateValue(state.analyzerMode);
  const spectrogram = useStateValue(state.showSpectrogram);
  const floor = useStateValue(state.analyzerFloor);
  const peakHold = useStateValue(state.analyzerPeakHold);
  const phase = useStateValue(state.displayMode) === 'phase';
  const keyboard = useStateValue(state.showKeyboard);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [curves] = useState(createCurves);

  const soloed = bands.find((band) => band.solo);
  const soloing = soloed !== undefined;
  const limit = rangeDecibels[range];
  const analyzerAxis = analyzerMode !== 'off' || spectrogram;
  const showPre = analyzerAxis && !spectrogram && (bypassed || analyzerMode !== 'post');
  const showPost = analyzerAxis && !spectrogram && !bypassed && analyzerMode !== 'pre';
  const fade = bypassed ? BYPASSED_OPACITY : 1;

  const [focusRing, setFocusRing] = useState(false);
  const markerRefs = useMarkerRefs();
  // Only visible handles take part in graph drags, including group moves.
  // The response and inspector still use the complete set of bands.
  const visible = useSelector(
    bandsSource,
    useCallback((all: readonly Band[]) => visibleSlots(all, limit), [limit]),
    sameItems,
  );
  const selectionProps = usePlotSelection(visible, limit);
  const layerFrame = useMemo(() => frame && { ...frame, top: frame.top + PLOT_OFFSET }, [frame]);
  useEffect(
    () => () => {
      hoveredStore.set(null);
      draggingStore.set(null);
    },
    [],
  );

  return (
    <View
      // A press on the background focuses the graph rather than nothing, so
      // that Escape and undo still reach the editor after a click or a
      // rectangle selection.
      focusable
      accessibilityLabel="Equalizer graph"
      accessibilityHint="Double-click to add a band. Drag to select bands; Escape clears the selection."
      onFocusVisibleChange={(event) => setFocusRing(event.focusVisible)}
      style={{
        width: GRAPH_WIDTH,
        height: GRAPH_HEIGHT,
        borderRadius: theme.radius.radiusXl,
        backgroundColor: theme.color.display,
        overflow: 'hidden',
        ...ring(theme, focusRing),
      }}
    >
      {spectrogram && layerFrame && (
        <SpectrogramLayer
          source={analyzer.spectrogram}
          frame={layerFrame}
          floor={floorDecibels[floor]}
        />
      )}
      <View
        style={PLOT_POSITION}
        onPointerMoveCapture={trackPointer}
        onPointerDownCapture={trackPointer}
        onPointerLeave={leavePlot}
      >
        <Plot
          width={GRAPH_WIDTH}
          height={GRAPH_HEIGHT - PLOT_OFFSET}
          // The axis gutters already leave room for handles. Map the data
          // all the way to the frame, with or without a visible handle.
          autoSafeZone={false}
          axisLabelGap={14}
          accessibilityLabel="Equalizer response and bands"
          // Clear, so that the spectrogram shows through from under it.
          styles={PLOT_STYLES}
          selection={selectionProps}
          onBackgroundDoubleClick={addBandAt}
        >
          <Plot.XAxis
            domain={FREQUENCY_DOMAIN}
            scale="log"
            ticks={frequencyTicks}
            minorTicks
            format={formatFrequencyTick}
          />
          <Plot.YAxis
            domain={gainDomain(limit)}
            ticks={gainTicks(range)}
            format={formatSigned}
            hidden={phase}
          />
          <Plot.YAxis
            id="phase"
            domain={PHASE_DOMAIN}
            ticks={phaseTicks}
            format={formatDegrees}
            hidden={!phase}
          />
          <Plot.YAxis
            id="analyzer"
            position="right"
            domain={analyzerDomain(floor)}
            ticks={analyzerTicks(floor)}
            format={formatSigned}
            hidden={!analyzerAxis}
          />
          <Plot.Grid yAxis={phase ? 'phase' : undefined} />
          <PlotFrame onChange={setFrame} />
          {showPre && (
            <Plot.Line source={analyzer.pre} yAxis="analyzer" {...PRE_TRACE} hideInReadout />
          )}
          {showPost && (
            <>
              <Plot.Band
                source={analyzer.postFill}
                yAxis="analyzer"
                color={POST_TRACE.color}
                opacity={POST_BAND_OPACITY}
                hideInReadout
              />
              <Plot.Line source={analyzer.post} yAxis="analyzer" {...POST_TRACE} hideInReadout />
            </>
          )}
          {showPost && peakHold && (
            <Plot.Line
              source={analyzer.peak}
              yAxis="analyzer"
              color={POST_TRACE.color}
              opacity={0.4}
              dash={PEAK_DASH}
              hideInReadout
            />
          )}
          {!phase && <Plot.HorizontalLine value={0} color={theme.color.displayAxis} />}
          {!phase &&
            bands.map((band) => (
              <BandCurve
                key={band.slot}
                source={curves.band(band.slot)}
                color={bandColor(theme, band.slot)}
                opacity={bandCurveOpacity(band, soloing) * fade}
                dashed={!band.enabled}
              />
            ))}
          {bands.length > 0 && phase && (
            <>
              <Plot.Line
                source={curves.combined}
                color={theme.color.textInverse}
                {...MAGNITUDE_GHOST}
                opacity={MAGNITUDE_GHOST.opacity * fade}
                extend
                hideInReadout
              />
              <Plot.Line
                source={curves.phase}
                yAxis="phase"
                color={theme.color.displayWarning}
                opacity={fade}
                strokeWidth={1.75}
                label="Phase"
              />
            </>
          )}
          {bands.length > 0 && !phase && (
            <>
              <Plot.Band
                source={curves.fill}
                color={theme.color.textInverse}
                opacity={0.05 * fade}
                hideInReadout
              />
              <Plot.Line
                source={curves.combined}
                color={theme.color.textInverse}
                opacity={fade}
                strokeWidth={2}
                extend
                label="Response"
              />
            </>
          )}
          <DragLine />
          {keyboard && <SelectedNotes />}
          <Markers limit={limit} soloing={soloing} bypassed={bypassed} markerRefs={markerRefs} />
          {bands.length === 0 && <EmptyHint />}
          {phase && <PhaseCaption />}
          <Readout phase={phase} />
        </Plot>
      </View>
      <ShownTooltip limit={limit} markerRefs={markerRefs} />
      {bypassed ? (
        <GraphStatus label="Bypassed" color={theme.color.displayWarning} />
      ) : soloed ? (
        <GraphStatus label={`Solo · Band ${soloed.slot}`} color={bandColor(theme, soloed.slot)} />
      ) : null}
      <Legend
        curve={bands.length > 0 ? (phase ? 'phase' : 'magnitude') : null}
        pre={showPre}
        post={showPost}
        peak={showPost && peakHold}
      />
      <UnitLabels analyzer={analyzerAxis} phase={phase} />
    </View>
  );
}

const PLOT_POSITION = { position: 'absolute', left: 0, top: PLOT_OFFSET } as const;
const PLOT_STYLES = { root: { backgroundColor: 'transparent', borderRadius: 0 } };
const FREQUENCY_DOMAIN: [number, number] = [FREQUENCY_MIN, FREQUENCY_MAX];
const PHASE_DOMAIN: [number, number] = [-180, 180];
const DASHED = [3, 3];
const DRAG_DASH = [2, 4];
const KEYBOARD_STYLES = { root: { opacity: 0.8 } };

/** One array per value, so an axis is given the same domain at every render. */
function domains<K extends string | number>(make: (key: K) => [number, number]) {
  const made = new Map<K, [number, number]>();
  return (key: K) => {
    let domain = made.get(key);
    if (!domain) made.set(key, (domain = make(key)));
    return domain;
  };
}
const gainDomain = domains((limit: number) => [-limit, limit]);
const analyzerDomain = domains((floor: AnalyzerFloor) => [floorDecibels[floor], 0]);

const addBandAt = ({ data: [hz, db] }: { data: readonly [number, number] }) =>
  addBand(getBands(), bandAt(hz, db));

function leavePlot() {
  pointerStore.set(null);
  altStore.set(false);
}

/** The slots whose markers are on the plot: a gain past the range has none. */
const visibleSlots = (bands: readonly Band[], limit: number) =>
  bands
    .filter((band) => !hasGain(band.type) || Math.abs(band.gain) <= limit)
    .map((band) => band.slot);

/** A band's own curve, drawn from its live source: rendered again only when its look changes. */
const BandCurve = memo(function BandCurve({
  source,
  color,
  opacity,
  dashed,
}: {
  source: PlotSource<PlotSamples>;
  color: string;
  opacity: number;
  dashed: boolean;
}) {
  return (
    <Plot.Line
      source={source}
      color={color}
      opacity={opacity}
      strokeWidth={1}
      dash={dashed ? DASHED : undefined}
      extend
      hideInReadout
    />
  );
});

/**
 * The markers of the bands on the plot. The one list that follows every
 * edit and selection; each marker is memoized, so a drag renders the dragged
 * one only, and a new selection those whose state it changed.
 */
const Markers = memo(function Markers({
  limit,
  soloing,
  bypassed,
  markerRefs,
}: {
  limit: number;
  soloing: boolean;
  bypassed: boolean;
  markerRefs: (slot: number) => RefObject<UiNode | null>;
}) {
  const bands = useBands();
  const selected = useSelectedSlots();
  const several = bands.filter((band) => selected.includes(band.slot)).length > 1;
  return bands.map((band) => {
    if (hasGain(band.type) && Math.abs(band.gain) > limit) return null;
    const chosen = selected.includes(band.slot);
    return (
      <BandMarker
        key={band.slot}
        band={band}
        soloed={band.solo}
        dimmed={soloing && !band.solo}
        bypassed={bypassed}
        selected={chosen}
        groupDelete={chosen && several}
        nodeRef={markerRefs(band.slot)}
      />
    );
  });
});

/** A dashed line down the plot at the dragged band's frequency. */
function DragLine() {
  const slot = useStore(draggingStore);
  return slot === null ? null : <DragLineAt slot={slot} />;
}

function DragLineAt({ slot }: { slot: number }) {
  const theme = useTheme();
  const frequency = useSelector(
    bandsSource,
    useCallback((bands: readonly Band[]) => bands.find((b) => b.slot === slot)?.frequency, [slot]),
  );
  if (frequency === undefined) return null;
  return <Plot.VerticalLine value={frequency} color={bandColor(theme, slot)} dash={DRAG_DASH} />;
}

/** The selected bands' nearest notes on the pitch keyboard, rendered again only when one changes. */
function SelectedNotes() {
  const notes = useSelector(selectionSource, selectedNotes, sameItems);
  return (
    <Plot.FrequencyKeyboard
      height={KEYBOARD_HEIGHT}
      highlightedNotes={notes}
      styles={KEYBOARD_STYLES}
    />
  );
}

const selectedNotes = (bands: readonly Band[]) => bands.map((band) => nearestNote(band.frequency));

/** The tooltip of the band whose values the graph shows, over its marker. */
function ShownTooltip({
  limit,
  markerRefs,
}: {
  limit: number;
  markerRefs: (slot: number) => RefObject<UiNode | null>;
}) {
  const slot = useStore(shownSource);
  return slot === null ? null : (
    <ShownTooltipOf slot={slot} limit={limit} markerRefs={markerRefs} />
  );
}

function ShownTooltipOf({
  slot,
  limit,
  markerRefs,
}: {
  slot: number;
  limit: number;
  markerRefs: (slot: number) => RefObject<UiNode | null>;
}) {
  const band = useSelector(
    bandsSource,
    useCallback((bands: readonly Band[]) => bands.find((b) => b.slot === slot), [slot]),
  );
  const dragging = useStore(draggingStore) !== null;
  if (!band || (hasGain(band.type) && Math.abs(band.gain) > limit)) return null;
  return <BandTooltip band={band} anchor={markerRefs(slot)} dragging={dragging} />;
}

/**
 * What each line is: the summed EQ curve first (or, in the phase view, the
 * phase curve and the magnitude's ghost), then the analyzer's traces.
 */
const Legend = memo(function Legend({
  curve,
  pre,
  post,
  peak,
}: {
  curve: 'magnitude' | 'phase' | null;
  pre: boolean;
  post: boolean;
  peak: boolean;
}) {
  const theme = useTheme();
  if (!curve && !pre && !post) return null;
  return (
    <View
      style={{
        position: 'absolute',
        right: 52,
        top: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {curve === 'magnitude' && (
        <TraceKey label="EQ curve" color={theme.color.textInverse} strokeWidth={2} />
      )}
      {curve === 'phase' && (
        <>
          <TraceKey label="Phase" color={theme.color.displayWarning} strokeWidth={1.75} />
          <TraceKey label="Magnitude" color={theme.color.textInverse} {...MAGNITUDE_GHOST} />
        </>
      )}
      {pre && <TraceKey label="Pre EQ" {...PRE_TRACE} />}
      {post && <TraceKey label="Post EQ" {...POST_TRACE} filled />}
      {peak && <TraceKey label="Post peak" color={POST_TRACE.color} dash={PEAK_DASH} />}
    </View>
  );
});

function TraceKey({
  label,
  color,
  strokeWidth = 1,
  dash,
  filled,
  opacity = 1,
}: {
  label: string;
  color: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: readonly number[];
  filled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Svg width={16} height={9} viewBox={[0, 0, 16, 9]} accessible={false}>
        {filled && <Path d="M0 3.5H16V9H0Z" fill={color} fillOpacity={POST_FILL} />}
        <Path
          d="M0 3.5H16"
          stroke={color}
          strokeOpacity={opacity}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />
      </Svg>
      <Text style={textStyle(theme, 'caption', theme.color.displayText)}>{label}</Text>
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
 * of a selected marker moves the visible selected bands, as one undo step.
 */
function usePlotSelection(visible: readonly number[], gainLimit: number): PlotSelection {
  const limit = useRef(gainLimit);
  limit.current = gainLimit;
  const group = useRef<{ bands: readonly Band[]; edit: BandsMove } | null>(null);
  const onGroupDrag = useCallback((event: PlotGroupDrag) => {
    if (event.phase === 'start') {
      const members = getBands().filter((band) => event.ids.includes(String(band.slot)));
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
      const moved = moveGroup(active.bands, event.delta, x, y, limit.current);
      active.edit.update((band) => moved.get(band.slot)!);
      return;
    }
    group.current = null;
    if (event.phase === 'cancel') active.edit.restore();
    active.edit.end();
  }, []);
  const shown = useRef(visible);
  shown.current = visible;
  // The same object for the Plot's life. The Plot puts it in the context
  // every Plot.Marker reads, so a new one at each selection would render
  // every marker. It reads the ids only when the pointer acts, and each
  // marker is told whether it is selected, so a getter is enough.
  return useMemo(
    () => ({
      get selectedIds() {
        return getSelection()
          .filter((band) => shown.current.includes(band.slot))
          .map((band) => String(band.slot));
      },
      onSelectionChange: selectIds,
      multiple: true,
      rectangle: true,
      onGroupDrag,
    }),
    [onGroupDrag],
  );
}

const selectIds = (ids: readonly string[]) => setSelection(ids.map(Number));

/** A band's own curve: faint beside the combined one, fainter when off or out of a solo. */
function bandCurveOpacity(band: Band, soloing: boolean) {
  if (!band.enabled) return 0.16;
  if (soloing && !band.solo) return 0.2;
  return 0.5;
}

/** The equal-tempered note nearest a frequency, where A4 is 69. */
const nearestNote = (hz: number) => Math.round(69 + 12 * Math.log2(hz / 440));

/** "dB" (or "DEG") at the top left, "dBFS" at the top right, "Hz" at the bottom right. */
const UnitLabels = memo(function UnitLabels({
  analyzer,
  phase,
}: {
  analyzer: boolean;
  phase: boolean;
}) {
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
      <Text style={[style, { position: 'absolute', left: 8, top: 8 }]}>{phase ? 'DEG' : 'dB'}</Text>
      {analyzer && <Text style={[style, { position: 'absolute', right: 6, top: 8 }]}>dBFS</Text>}
      <Text style={[style, { position: 'absolute', right: 6, bottom: 6 }]}>Hz</Text>
    </View>
  );
});
