import { Button, SelectableList, Tooltip } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Headphones, Plus } from '@soundor/icons/lucide';
import { Text, View } from '@soundor/react';
import { Circle, Rect, Svg } from '@soundor/react/svg';
import { memo, useMemo } from 'react';

import { filterTypeLabel, hasSlope, MAX_BANDS, type Band } from '../bands/catalog';
import { addBand } from '../bands/edit';
import { selectionSource, setSelection } from '../bands/selection';
import { getBands, useBandShapes } from '../bands/use-bands';
import { sameItems, useSelector } from '../utils/store';
import { bandColor, bandColorOnLight } from '../graph/band-colors';

export const STRIP_HEIGHT = 32;

/** The band dot's size; even, so it centres on a whole pixel. */
const DOT = 10;

/**
 * One chip per band, selected as files are in a file manager: a click selects
 * that band alone, Ctrl (Cmd on macOS) adds or removes one, Shift selects the
 * range from the last one chosen. Then how many slots are in use, and Add,
 * or "Full" once all of them are.
 *
 * None of it shows frequency, gain or Q, so it renders for none of them: not
 * while a band is dragged.
 */
export function BandStrip() {
  const theme = useTheme();
  const bands = useBandShapes();
  const selected = useSelector(selectionSource, selectedIds, sameItems);
  const full = bands.length >= MAX_BANDS;
  const items = useMemo(
    () => bands.map((band) => ({ id: String(band.slot), label: chipLabel(band) })),
    [bands],
  );
  const bySlot = useMemo(() => new Map(bands.map((band) => [String(band.slot), band])), [bands]);
  const styles = useMemo(
    () => ({
      root: { gap: 3 },
      item: {
        padding: 0,
        borderWidth: 0,
        borderRadius: theme.radius.radiusSm,
        backgroundColor: 'transparent',
      },
    }),
    [theme],
  );

  return (
    <View
      style={{
        height: STRIP_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text accessible={false} style={textStyle(theme, 'section', theme.color.textMuted)}>
        BANDS
      </Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        {bands.length === 0 ? (
          <Text style={textStyle(theme, 'caption', theme.color.textDisabled)}>None yet</Text>
        ) : (
          <SelectableList
            accessibilityLabel="Bands"
            orientation="horizontal"
            selectionMode="extended"
            items={items}
            selectedIds={selected}
            onSelectionChange={selectIds}
            styles={styles}
            renderItem={(item, state) => (
              <Chip band={bySlot.get(item.id)!} selected={state.selected} hovered={state.hovered} />
            )}
          />
        )}
      </View>
      <Text style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.textMuted }}>
        {`${bands.length}/${MAX_BANDS}`}
      </Text>
      {/* Once every slot is used, a quiet word in Add's place: no control,
          and narrower than the button, as the 24 chips need its room. */}
      {full ? (
        <Text style={textStyle(theme, 'caption', theme.color.textDisabled)}>Full</Text>
      ) : (
        <Tooltip content="Add a bell at 1 kHz">
          <Button
            size="sm"
            variant="ghost"
            accessibilityLabel="Add band"
            onPress={() => addBand(getBands())}
            leading={<Plus size={12} color={theme.color.textSecondary} strokeWidth={1.8} />}
          >
            Add
          </Button>
        </Tooltip>
      )}
    </View>
  );
}

const selectedIds = (bands: readonly Band[]) => bands.map((band) => String(band.slot));
const selectIds = (ids: readonly string[]) => setSelection(ids.map(Number));

function chipLabel(band: Band) {
  const parts = [`Band ${band.slot}`, filterTypeLabel(band.type)];
  if (!band.enabled) parts.push('bypassed');
  if (band.solo) parts.push('solo');
  return parts.join(', ');
}

/**
 * The band's colour as a dot (square for cuts, hollow when bypassed) and its
 * number; a selected chip is outlined and bold.
 */
const Chip = memo(function Chip({
  band,
  selected,
  hovered,
}: {
  band: Band;
  selected: boolean;
  hovered: boolean;
}) {
  const theme = useTheme();
  const background = selected
    ? theme.color.surfaceInset
    : hovered
      ? theme.color.surface
      : 'transparent';
  return (
    <View
      style={{
        height: 22,
        minWidth: 30,
        paddingHorizontal: 6,
        borderRadius: theme.radius.radiusSm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: background,
        borderWidth: theme.size.borderHairline,
        borderColor: selected ? theme.color.borderStrong : 'transparent',
        opacity: band.enabled ? 1 : 0.55,
      }}
    >
      <BandDot band={band} />
      <Text
        style={{
          fontFamily: theme.font.mono,
          // Whole pixels everywhere, so every renderer rounds alike: an even
          // line box centred in the chip's 20 px starts on a whole pixel, as
          // the dot does, and at 11 px Geist Mono's digits (0.355 em above the
          // baseline) end up 0.1 px from the dot's centre. The font's own line
          // box, 14.3 px, would leave them half a pixel up or down.
          fontSize: 11,
          lineHeight: 14,
          fontWeight: selected ? 'bold' : 'normal',
          color: theme.color.text,
        }}
      >
        {String(band.slot)}
      </Text>
      {band.solo && <Headphones size={10} color={theme.color.warning} strokeWidth={2} />}
    </View>
  );
});

/**
 * The band's own colour, edged with a deeper shade of it so the pastel holds
 * its shape on the light chrome; a bypassed band's dot is that edge alone.
 *
 * Drawn as a vector shape, not a rounded view: when the web host scales the
 * editor to fit its window, a bordered box's edges snap to device pixels one
 * by one, and at 8 or 9 px a pixel's difference turns the circle into an oval.
 * The stroke sits inside the 10 px box, as a border would.
 */
function BandDot({ band }: { band: Band }) {
  const theme = useTheme();
  // Measured against the selected chip's background, the darker of the two.
  const edge = bandColorOnLight(theme, band.slot, theme.color.surfaceInset);
  const stroke = band.enabled ? 1 : 2;
  const inset = stroke / 2;
  const paint = {
    fill: band.enabled ? bandColor(theme, band.slot) : 'none',
    stroke: edge,
    strokeWidth: stroke,
  };
  return (
    <Svg width={DOT} height={DOT} viewBox={[0, 0, DOT, DOT]}>
      {hasSlope(band.type) ? (
        <Rect
          x={inset}
          y={inset}
          width={DOT - stroke}
          height={DOT - stroke}
          rx={2.5 - inset}
          {...paint}
        />
      ) : (
        <Circle cx={DOT / 2} cy={DOT / 2} r={DOT / 2 - inset} {...paint} />
      )}
    </Svg>
  );
}
