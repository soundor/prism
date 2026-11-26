import { textStyle, useTheme } from '@soundor/components/theme';
import { SquareDashedMousePointer } from '@soundor/icons/lucide';
import { Text, View } from '@soundor/react';

import { channelLabel, filterTypeLabel, hasSlope, type Band } from '../bands/catalog';
import { bandColor, bandForeground } from '../graph/band-colors';

const BADGE = 26;

/**
 * Which band the cells edit: its chip, number, type and channel. For several
 * bands, one selection badge in the same place (not a count, which would
 * read as a band number) and their numbers.
 */
export function Identity({ bands }: { bands: readonly Band[] }) {
  const theme = useTheme();
  const single = bands.length === 1 ? bands[0]! : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {single ? <BandBadge band={single} /> : <SelectionBadge />}
      <View style={{ gap: 2, minWidth: 0 }}>
        <Text style={textStyle(theme, 'title', theme.color.text)}>
          {single ? `Band ${single.slot}` : `${bands.length} selected`}
        </Text>
        <Text
          style={textStyle(
            theme,
            'caption',
            single && !single.enabled ? theme.color.warning : theme.color.textSecondary,
          )}
        >
          {single ? describeSingle(single) : `Bands ${listSlots(bands)}`}
        </Text>
      </View>
    </View>
  );
}

function describeSingle(band: Band) {
  if (!band.enabled) return 'Bypassed';
  return `${filterTypeLabel(band.type)} · ${channelLabel(band.channel)}`;
}

/** "2, 3, 5"; past five bands, the first four and how many more: "1, 2, 3, 4 +3". */
export function listSlots(bands: readonly Band[]) {
  const slots = bands.map((band) => band.slot);
  if (slots.length <= 5) return slots.join(', ');
  return `${slots.slice(0, 4).join(', ')} +${slots.length - 4}`;
}

function BandBadge({ band }: { band: Band }) {
  const theme = useTheme();
  const color = bandColor(theme, band.slot);
  return (
    <View
      style={{
        width: BADGE,
        height: BADGE,
        borderRadius: hasSlope(band.type) ? 5 : BADGE / 2,
        // Bypassed, hollow on the graph's surface, as its marker is.
        backgroundColor: band.enabled ? color : theme.color.display,
        borderWidth: band.enabled ? 0 : 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: theme.font.mono,
          fontSize: 12,
          fontWeight: 'bold',
          color: band.enabled ? bandForeground(theme, band.slot) : color,
        }}
      >
        {String(band.slot)}
      </Text>
    </View>
  );
}

function SelectionBadge() {
  const theme = useTheme();
  return (
    <View
      style={{
        width: BADGE,
        height: BADGE,
        borderRadius: theme.radius.radiusMd,
        backgroundColor: theme.color.selected,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SquareDashedMousePointer size={16} color={theme.color.selectedForeground} strokeWidth={2} />
    </View>
  );
}
