import { Toggle } from '@soundor/components';
import { useTheme } from '@soundor/components/theme';
import { Image, useParameter, View } from '@soundor/react';
import { parameters } from 'soundor:parameters';

import logo from '../../../../assets/brand/svg/soundor-prism-logo.svg';
import { HEADER_HEIGHT } from './layout';

// Logo and global bypass. Presets, undo/redo and A/B go between them.
export function Header() {
  const theme = useTheme();
  const bypassed = useParameter(parameters.bypass);
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
      <View style={{ flex: 1 }} />
      <Toggle
        parameter={parameters.bypass}
        label="Bypass"
        accessibilityLabel="Global bypass"
        size="sm"
        styles={{
          root: {
            alignSelf: 'center',
            ...(bypassed && {
              backgroundColor: theme.color.selected,
              borderColor: theme.color.warning,
            }),
          },
          label: bypassed ? { color: theme.color.displayWarning } : undefined,
          indicator: bypassed ? { backgroundColor: theme.color.displayWarning } : undefined,
        }}
      />
    </View>
  );
}
