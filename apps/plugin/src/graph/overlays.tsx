import { Tooltip, usePlotCoordinates } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, View } from '@soundor/react';
import type { UiNode } from 'soundor:ui';
import type { RefObject } from 'react';

import {
  channelBadges,
  filterTypeLabel,
  hasGain,
  hasQ,
  hasSlope,
  slopeDecibels,
  type Band,
} from '../bands/catalog';
import { formatFrequency, formatGain, formatNote, formatQ } from '../bands/format';
import { pointerStore, shiftStore, useStore } from './pointer';

// Views laid over the plot: the cursor readout, a band's tooltip and the
// hint on an empty graph. None of them takes the pointer.

const SEPARATOR = '   ';
const PHASE_CAPTION_HEIGHT = 26;

/**
 * Where the pointer is, while Alt is held: frequency, the nearest note and,
 * on the magnitude view, gain, in a chip at the plot's top left, and a line
 * down the plot at the pointer.
 */
export function Readout({ hidden, phase = false }: { hidden: boolean; phase?: boolean }) {
  const theme = useTheme();
  const pointer = useStore(pointerStore);
  const { inner, rect, x, y } = usePlotCoordinates();
  if (hidden || !pointer) return null;
  const [px, py] = pointer;
  if (px < inner.left || px > inner.left + inner.width || py < rect.top) return null;
  if (py > rect.top + rect.height) return null;
  const hz = x.invert(px);
  // The vertical position reads as gain only on the magnitude view.
  const parts = [formatFrequency(hz), formatNote(hz)];
  if (!phase) parts.push(formatGain(y.invert(py)));
  const text = parts.join(SEPARATOR);
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: Math.round(px),
          top: rect.top,
          width: 1,
          height: rect.height,
          backgroundColor: theme.color.displayAxis,
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: inner.left + 8,
          // Below the phase view's caption.
          top: rect.top + (phase ? PHASE_CAPTION_HEIGHT + 16 : 8),
          height: 20,
          paddingHorizontal: 8,
          justifyContent: 'center',
          borderRadius: theme.radius.radiusSm,
          backgroundColor: theme.color.surfaceElevated,
          opacity: 0.94,
          pointerEvents: 'none',
        }}
      >
        <Text
          accessible={false}
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            lineHeight: 14,
            color: theme.color.textSecondary,
          }}
        >
          {text}
        </Text>
      </View>
    </>
  );
}

/** Every setting the band's type uses, as its tooltip shows them: "3 · Bell   3.10 kHz   +2.6 dB   Q 0.900". */
export function tooltipText(band: Band, fine: boolean): string {
  const parts = [`${band.slot} · ${filterTypeLabel(band.type)}`, formatFrequency(band.frequency)];
  if (hasGain(band.type)) parts.push(formatGain(band.gain));
  if (hasQ(band.type, band.slope)) parts.push(`Q ${formatQ(band.q)}`);
  if (hasSlope(band.type)) parts.push(`${slopeDecibels[band.slope]} dB/oct`);
  const badge = channelBadges[band.channel];
  if (badge) parts.push(badge);
  if (!band.enabled) parts.push('Bypassed');
  if (fine) parts.push('Fine');
  return parts.join(SEPARATOR);
}

/** Over the marker that is hovered or dragged; "Fine" while Shift slows a drag. */
export function BandTooltip({
  band,
  anchor,
  dragging,
}: {
  band: Band;
  anchor: RefObject<UiNode | null>;
  dragging: boolean;
}) {
  const fine = useStore(shiftStore) && dragging;
  return (
    <Tooltip
      open
      anchor={anchor}
      side="top"
      offset={8}
      content={
        <Tooltip.Content label={tooltipText(band, fine)}>
          <Tooltip.Arrow />
        </Tooltip.Content>
      }
    />
  );
}

/** The graph stays editable while bypassed or soloed. */
export function GraphStatus({ label, color }: { label: string; color: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 16,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <View
        style={{
          height: 22,
          paddingHorizontal: 10,
          justifyContent: 'center',
          borderRadius: theme.radius.radiusSm,
          borderWidth: theme.size.borderHairline,
          borderColor: color,
          backgroundColor: theme.color.display,
        }}
      >
        <Text
          accessibilityLabel={label}
          style={[textStyle(theme, 'technical', color), { letterSpacing: 1.8 }]}
        >
          {label.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/** What the phase view shows, at the plot's top left. */
export function PhaseCaption() {
  const theme = useTheme();
  const { inner, rect } = usePlotCoordinates();
  return (
    <View
      style={{
        position: 'absolute',
        left: inner.left + 8,
        top: rect.top + 8,
        height: PHASE_CAPTION_HEIGHT,
        gap: 3,
        pointerEvents: 'none',
      }}
    >
      <Text
        style={[textStyle(theme, 'technical', theme.color.displayText), { letterSpacing: 1.8 }]}
      >
        PHASE RESPONSE
      </Text>
      <Text style={textStyle(theme, 'caption', theme.color.displayMuted)}>
        Of the current minimum-phase filters · display only
      </Text>
    </View>
  );
}

/** On a graph with no bands, how to add one. */
export function EmptyHint() {
  const theme = useTheme();
  const { rect } = usePlotCoordinates();
  return (
    <View
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <Text style={textStyle(theme, 'body', theme.color.displayText)}>
        Double-click anywhere on the graph to add a band
      </Text>
      <Text style={textStyle(theme, 'caption', theme.color.displayMuted)}>
        Near the ends, a low or a high cut. Up to 24 bands.
      </Text>
    </View>
  );
}
