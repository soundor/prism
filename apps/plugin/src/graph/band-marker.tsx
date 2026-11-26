import { Plot, type PlotMarkerState } from '@soundor/components';
import { useTheme } from '@soundor/components/theme';
import { Text, View } from '@soundor/react';

import { channelBadges, filterTypeLabel, hasGain, hasSlope, type Band } from '../bands/catalog';
import { bandColor, bandForeground } from './band-colors';
import { describeBand } from '../bands/format';

/**
 * The marker's box; the face is centred in it. Every size is even, so each
 * layer's centre falls on the box's whole-pixel centre and circles stay round.
 */
const BOX = 30;
const FACE = 18;
const FACE_LARGE = 20;

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
}

/**
 * A band's numbered marker at its frequency and gain; gain-less types sit
 * on the 0 dB line. Cuts have a rounded-square face, the others a circle; a
 * bypassed band's face is hollow, and a band that is not stereo has a badge.
 */
export function BandMarker({ band, dimmed, soloed, bypassed, selected }: BandMarkerProps) {
  const gain = hasGain(band.type);
  return (
    <Plot.Marker
      x={band.frequency}
      y={gain ? band.gain : 0}
      label={String(band.slot)}
      radius={BOX / 2}
      selected={selected}
      accessibilityLabel={`Band ${band.slot}, ${filterTypeLabel(band.type)}`}
      describeValue={() => describeBand(band)}
      render={(state) => (
        <MarkerFace band={band} state={state} dimmed={dimmed} soloed={soloed} bypassed={bypassed} />
      )}
    />
  );
}

interface MarkerFaceProps extends Omit<BandMarkerProps, 'selected'> {
  state: PlotMarkerState;
}

function MarkerFace({ band, state, dimmed, soloed, bypassed }: MarkerFaceProps) {
  const theme = useTheme();
  const color = bandColor(theme, band.slot);
  const ringed = state.selected || state.dragging;
  const size = ringed ? FACE_LARGE : FACE;
  const square = hasSlope(band.type);
  const corner = (extra: number) => (square ? 4 + extra / 3 : (size + extra) / 2);
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
      {(state.hovered || soloed) && !ringed && (
        <View
          style={{
            position: 'absolute',
            width: size + 8,
            height: size + 8,
            borderRadius: corner(8),
            backgroundColor: color,
            opacity: 0.22,
          }}
        />
      )}
      {ringed && (
        <View
          style={{
            position: 'absolute',
            width: size + 6,
            height: size + 6,
            borderRadius: corner(6),
            borderWidth: 2,
            borderColor: theme.color.textInverse,
          }}
        />
      )}
      {soloed && (
        <View
          style={{
            position: 'absolute',
            width: size + 12,
            height: size + 12,
            borderRadius: corner(12),
            borderWidth: 1,
            borderColor: color,
          }}
        />
      )}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: corner(0),
          backgroundColor: hollow ? theme.color.display : color,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
      {/* Over the whole box rather than inside the bordered face, so the
          border does not offset it. */}
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
