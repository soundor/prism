import { useTheme } from '@soundor/components/theme';
import { Image, View } from '@soundor/react';

import logo from '../../../../assets/brand/svg/soundor-prism-logo.svg';
import { HEADER_HEIGHT } from '../layout';

// Logo, presets, undo/redo, A/B and bypass. The controls arrive in later
// parts; the logo and the bar's place in the layout are final.
export function Header() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Prism"
      style={{
        height: HEADER_HEIGHT,
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.spaceSm,
        paddingHorizontal: 14,
        borderBottomWidth: theme.size.borderHairline,
        borderColor: theme.color.divider,
      }}
    >
      <Image
        source={logo}
        accessibilityLabel="Soundor Prism"
        style={{ width: 78, height: 30, resizeMode: 'contain' }}
      />
    </View>
  );
}
