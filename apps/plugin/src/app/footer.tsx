import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { FOOTER_HEIGHT, GAP } from './layout';

// Analyzer, display and view options.
export function Footer() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="View"
      style={{
        height: FOOTER_HEIGHT,
        flexShrink: 0,
        marginTop: GAP,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.spaceMd,
        paddingHorizontal: 14,
        borderTopWidth: theme.size.borderHairline,
        borderColor: theme.color.divider,
      }}
    />
  );
}
