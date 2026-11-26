import { Plot, type PlotMarkerState } from '@soundor/components';
import { useTheme } from '@soundor/components/theme';
import { Text, View } from '@soundor/react';
import { Circle, Rect, Svg } from '@soundor/react/svg';
import { useEffect, useRef, type RefObject } from 'react';
import type { UiNode } from 'soundor:ui';

import {
  channelBadges,
  filterTypeLabel,
  hasGain,
  hasQ,
  hasSlope,
  type Band,
} from '../bands/catalog';
import { beginBandsMove, setBandsField, type BandsMove } from '../bands/edit';
import { describeBand } from '../bands/format';
import { bandColor, bandForeground } from './band-colors';
import { WHEEL_SETTLE_MS, wheelQ } from './editing';

/**
 * The marker's box; the face is centred in it. Every size is even, so each
 * layer's centre falls on the box's whole-pixel centre and circles stay round.
 */
const BOX = 30;
const FACE = 18;
const FACE_LARGE = 20;
/**
 * The pointer's and the focus ring's circle: the face with its ring, and no
 * more, so the ring and the tooltip hug the marker. (The Plot's default is
 * the radius plus 5, a 40 px circle here.)
 */
const HIT_RADIUS = 14;

export interface BandMarkerProps {
  band: Band;
  /** Another band is soloed: this one is drawn faded. */
  dimmed: boolean;
  /** This band is soloed. */
  soloed: boolean;
  /** The plugin is bypassed: everything fades, and stays readable. */
  bypassed: boolean;
  /** In the editor's selection: a larger face with a ring. */
  selected: boolean;
  /** The marker's node, for its tooltip. */
  nodeRef: RefObject<UiNode | null>;
  /** The pointer is over it, or has left it. */
  onHover: (hovered: boolean) => void;
  /** A drag, or a run of arrow keys, begins or ends. */
  onDragChange: (dragging: boolean) => void;
  /** Delete or Backspace while it has focus. */
  onRemove: () => void;
}

/**
 * A band's numbered marker at its frequency and gain; gain-less types sit
 * on the 0 dB line and move across only. Cuts have a rounded-square face,
 * the others a circle; a bypassed band's face is hollow, and a band that is
 * not stereo has a badge.
 *
 * Dragging it, or its arrow keys, set frequency and gain; the wheel sets Q
 * and a double-click puts the gain back to 0 dB. Each is one undo step.
 */
export function BandMarker({
  band,
  dimmed,
  soloed,
  bypassed,
  selected,
  nodeRef,
  onHover,
  onDragChange,
  onRemove,
}: BandMarkerProps) {
  const gain = hasGain(band.type);
  // Begun at the first move, not at the drag's start: a drag of a group
  // moves this band with the others, through the Plot's group handler.
  const move = useRef<BandsMove | null>(null);
  const wheel = useWheelQ(band);
  return (
    <Plot.Marker
      ref={nodeRef}
      id={String(band.slot)}
      x={band.frequency}
      y={gain ? band.gain : 0}
      label={String(band.slot)}
      radius={BOX / 2}
      hitRadius={HIT_RADIUS}
      // The face draws the focus ring, beside its other rings: an outline on
      // the hit area is a separate element, which a browser can round to
      // other pixels than the face, off its centre.
      styles={{ root: { outlineWidth: 0 } }}
      selected={selected}
      movement={gain ? 'both' : 'x'}
      accessibilityLabel={`Band ${band.slot}, ${filterTypeLabel(band.type)}`}
      describeValue={() => describeBand(band)}
      render={(state) => (
        <MarkerFace
          band={band}
          state={state}
          dimmed={dimmed}
          soloed={soloed}
          bypassed={bypassed}
          onHover={onHover}
        />
      )}
      onMoveStart={() => onDragChange(true)}
      onMove={([frequency, decibels]) => {
        move.current ??= beginBandsMove(
          [band],
          gain ? ['frequency', 'gain'] : ['frequency'],
          'Move band',
        );
        move.current.update(() => ({ frequency, gain: decibels }));
      }}
      onMoveEnd={() => {
        const edit = move.current;
        move.current = null;
        edit?.end();
        onDragChange(false);
      }}
      onDoubleClick={() => {
        if (gain && band.gain !== 0) setBandsField([band.slot], 'gain', 0, 'Reset gain');
      }}
      onWheel={wheel}
      onRemove={onRemove}
    />
  );
}

/**
 * The wheel's handler: Q up or down a notch at a time. The notches of one
 * turn, until the wheel rests, are one undo step.
 */
function useWheelQ(band: Band) {
  const run = useRef<{ edit: BandsMove; q: number; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );
  useEffect(
    () => () => {
      if (!run.current) return;
      clearTimeout(run.current.timer);
      run.current.edit.end();
      run.current = null;
    },
    [band.slot],
  );
  return (event: { deltaY: number; shiftKey: boolean; preventDefault(): void }) => {
    if (!hasQ(band.type, band.slope)) return;
    event.preventDefault();
    const current = run.current ?? {
      edit: beginBandsMove([band], ['q'], 'Change Q'),
      q: band.q,
      timer: undefined as unknown as ReturnType<typeof setTimeout>,
    };
    run.current = current;
    current.q = wheelQ(current.q, event.deltaY, event.shiftKey);
    current.edit.update(() => ({ q: current.q }));
    clearTimeout(current.timer);
    current.timer = setTimeout(() => {
      if (run.current !== current) return;
      run.current = null;
      current.edit.end();
    }, WHEEL_SETTLE_MS);
  };
}

interface MarkerFaceProps extends Pick<
  BandMarkerProps,
  'band' | 'dimmed' | 'soloed' | 'bypassed' | 'onHover'
> {
  state: PlotMarkerState;
}

function MarkerFace({ band, state, dimmed, soloed, bypassed, onHover }: MarkerFaceProps) {
  const theme = useTheme();
  const hovered = state.hovered;
  // The latest callback, so that a new one each render does not report the
  // hover again.
  const report = useRef(onHover);
  report.current = onHover;
  useEffect(() => {
    if (!hovered) return;
    report.current(true);
    return () => report.current(false);
  }, [hovered]);
  const color = bandColor(theme, band.slot);
  const ringed = state.selected || state.dragging;
  const size = ringed ? FACE_LARGE : FACE;
  const shape = { square: hasSlope(band.type), size };
  const hollow = !band.enabled;
  const badge = channelBadges[band.channel];
  return (
    <View
      style={{
        width: BOX,
        height: BOX,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dimmed || bypassed ? 0.4 : 1,
      }}
    >
      {/* The face and its rings in one drawing, so that they stay concentric:
          as separate views, a browser at a fractional scale (125 %, 150 %)
          rounds each one to device pixels on its own. */}
      <Svg
        width={ART}
        height={ART}
        viewBox={[0, 0, ART, ART]}
        style={{ position: 'absolute', left: (BOX - ART) / 2, top: (BOX - ART) / 2 }}
      >
        {(state.hovered || soloed) && !ringed && (
          <Outline {...shape} grow={8} fill={color} fillOpacity={0.22} />
        )}
        {ringed && <Outline {...shape} grow={6} stroke={theme.color.textInverse} strokeWidth={2} />}
        {soloed && <Outline {...shape} grow={12} stroke={color} strokeWidth={1} />}
        {state.focused && (
          <Outline
            {...shape}
            grow={16}
            stroke={theme.color.focus}
            strokeWidth={theme.size.focusRing}
          />
        )}
        <Outline
          {...shape}
          grow={0}
          fill={hollow ? theme.color.display : color}
          {...(hollow && { stroke: color, strokeWidth: 1.5 })}
        />
      </Svg>
      {/* Over the whole box, centred as the drawing is. */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: BOX,
          height: BOX,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.mono,
            fontSize: band.slot > 9 ? 9 : 10,
            fontWeight: 'bold',
            color: hollow ? color : bandForeground(theme, band.slot),
          }}
        >
          {String(band.slot)}
        </Text>
      </View>
      {badge && (
        <View
          style={{
            position: 'absolute',
            right: 1,
            bottom: 1,
            minWidth: 11,
            height: 11,
            paddingHorizontal: 1,
            borderRadius: 3,
            borderWidth: 1,
            borderColor: color,
            backgroundColor: theme.color.display,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: theme.font.mono, fontSize: 7, fontWeight: 'bold', color }}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The drawing's side: room around the box for the outer rings. */
const ART = 40;

/**
 * The face's shape grown by `grow` (its outer size), centred in the
 * drawing: a circle, or a rounded square for a cut. A stroke is drawn
 * inside that outer size.
 */
function Outline({
  square,
  size,
  grow,
  fill = 'none',
  fillOpacity,
  stroke,
  strokeWidth = 0,
}: {
  square: boolean;
  size: number;
  grow: number;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  const outer = size + grow;
  const extent = outer - strokeWidth;
  const paint = { fill, fillOpacity, stroke, strokeWidth: stroke ? strokeWidth : undefined };
  if (!square) return <Circle cx={ART / 2} cy={ART / 2} r={extent / 2} {...paint} />;
  const corner = 4 + grow / 3 - strokeWidth / 2;
  return (
    <Rect
      x={(ART - extent) / 2}
      y={(ART - extent) / 2}
      width={extent}
      height={extent}
      rx={corner}
      ry={corner}
      {...paint}
    />
  );
}
