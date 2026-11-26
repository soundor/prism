import { Button, SelectableList, Tooltip } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Headphones, Plus } from '@soundor/icons/lucide';
import { Text, View } from '@soundor/react';

import { filterTypeLabel, hasSlope, MAX_BANDS, type Band } from '../bands/catalog';
import { addBand } from '../bands/edit';
import { setSelection, useSelection } from '../bands/selection';
import { useBands } from '../bands/use-bands';
import { bandColor, bandColorOnLight } from '../graph/band-colors';

export const STRIP_HEIGHT = 32;

/**
 * One chip per band, to select it: every press adds the band to the
 * selection or takes it out. Then how many slots are in use, and Add.
 */
export function BandStrip() {
  const theme = useTheme();
  const bands = useBands();
  const selected = useSelection().map((band) => String(band.slot));
  const full = bands.length >= MAX_BANDS;

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
            multiple
            items={bands.map((band) => ({ id: String(band.slot), label: chipLabel(band) }))}
            selectedIds={selected}
            onSelectionChange={(ids) => setSelection(ids.map(Number))}
            styles={{
              root: { gap: 3 },
              item: {
                padding: 0,
                borderWidth: 0,
                borderRadius: theme.radius.radiusSm,
                backgroundColor: 'transparent',
              },
            }}
            renderItem={(item, state) => (
              <Chip
                band={bands.find((band) => String(band.slot) === item.id)!}
                selected={state.selected}
                hovered={state.hovered}
              />
            )}
          />
        )}
      </View>
      <Text style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.textMuted }}>
        {`${bands.length}/${MAX_BANDS}`}
      </Text>
      <Tooltip content={full ? `All ${MAX_BANDS} bands are in use` : 'Add a bell at 1 kHz'}>
        <Button
          size="sm"
          variant="ghost"
          disabled={full}
          accessibilityLabel="Add band"
          onPress={() => addBand(bands)}
          leading={
            <Plus
              size={12}
              color={full ? theme.color.textDisabled : theme.color.textSecondary}
              strokeWidth={1.8}
            />
          }
        >
          Add
        </Button>
      </Tooltip>
    </View>
  );
}

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
function Chip({ band, selected, hovered }: { band: Band; selected: boolean; hovered: boolean }) {
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
}

/**
 * The band's own colour, edged with a deeper shade of it so the pastel holds
 * its shape on the light chrome; a bypassed band's dot is that edge alone.
 * Even sizes keep it round.
 */
function BandDot({ band }: { band: Band }) {
  const theme = useTheme();
  // Measured against the selected chip's background, the darker of the two.
  const edge = bandColorOnLight(theme, band.slot, theme.color.surfaceInset);
  return (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: hasSlope(band.type) ? 2.5 : 5,
        backgroundColor: band.enabled ? bandColor(theme, band.slot) : 'transparent',
        borderWidth: band.enabled ? 1 : 2,
        borderColor: edge,
      }}
    />
  );
}
