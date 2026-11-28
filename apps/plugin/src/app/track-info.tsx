import { Tooltip } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, useHostState, View } from '@soundor/react';

/** The longest a track name is shown; the tooltip has it whole. */
const NAME_LENGTH = 24;

/** `name`, cut to {@link NAME_LENGTH} characters with an ellipsis. */
export function shorten(name: string): string {
  const characters = [...name];
  if (characters.length <= NAME_LENGTH) return name;
  return `${characters
    .slice(0, NAME_LENGTH - 1)
    .join('')
    .trimEnd()}…`;
}

/** A sample rate as the footer shows it: 48 kHz, 44.1 kHz. */
export function formatRate(rate: number): string {
  return `${Number((rate / 1000).toFixed(1))} kHz`;
}

/**
 * The track the plugin is on, as the host reports it: its colour, number
 * and name, then the sample rate. A host that reports no track shows its own
 * name instead.
 */
export function TrackInfo() {
  const theme = useTheme();
  const { track, hostName, sampleRate } = useHostState();
  const caption = textStyle(theme, 'technical', theme.color.textMuted);
  // The host's colour, without its alpha: some hosts send none.
  const color = track?.color?.slice(0, 7);
  const name = track?.name?.trim();
  const rate = sampleRate > 0 ? formatRate(sampleRate) : null;
  const where = name ? null : hostName.trim() || null;
  const label = [name && `Track${track?.index ? ` ${track.index}` : ''}: ${name}`, where, rate]
    .filter(Boolean)
    .join(', ');
  if (!label) return null;
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}
    >
      {name ? (
        <>
          {color ? (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          ) : null}
          {track?.index ? (
            <Text style={caption}>{String(track.index).padStart(2, '0')}</Text>
          ) : null}
          <Tooltip content={name}>
            <Text
              numberOfLines={1}
              style={textStyle(theme, 'technical', theme.color.textSecondary)}
            >
              {shorten(name)}
            </Text>
          </Tooltip>
        </>
      ) : where ? (
        <Text style={caption}>{where}</Text>
      ) : null}
      {rate ? (
        <>
          {name || where ? <Text style={caption}>·</Text> : null}
          <Text style={caption}>{rate}</Text>
        </>
      ) : null}
    </View>
  );
}
