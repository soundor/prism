import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, View } from '@soundor/react';
import type { ReactNode } from 'react';

// The inspector's cells: a caption over a row of controls, at fixed widths so
// no control moves when the selection or the filter type changes. The row is
// exactly CONTROL_HEIGHT, the height of every control in it, because some of
// them keep to its top: the knobs, taller, overflow it evenly.

export const CONTROL_HEIGHT = 30;

export function Cell({
  width,
  caption,
  center = false,
  children,
}: {
  /** Fixed width; without one the cell takes the room that is left. */
  width?: number;
  caption: string;
  /** Centre the controls across the cell. */
  center?: boolean;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        ...(width === undefined ? { flex: 1 } : { width }),
        paddingHorizontal: 10,
        paddingTop: 9,
        gap: 12,
      }}
    >
      <Text
        accessible={false}
        style={[textStyle(theme, 'section', theme.color.textMuted), { height: 11 }]}
      >
        {caption.toUpperCase()}
      </Text>
      <View
        style={{
          height: CONTROL_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: center ? 'center' : 'flex-start',
          gap: 8,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Stands in a cell whose parameter the selected type does not use, and says why. */
export function NotUsed({ reason }: { reason: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        height: CONTROL_HEIGHT,
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderRadius: theme.radius.radiusSm,
        borderWidth: theme.size.borderHairline,
        borderColor: theme.color.divider,
      }}
    >
      <Text style={textStyle(theme, 'caption', theme.color.textDisabled)}>{reason}</Text>
    </View>
  );
}

export function CellDivider() {
  const theme = useTheme();
  return <View style={{ width: 1, marginVertical: 12, backgroundColor: theme.color.divider }} />;
}
