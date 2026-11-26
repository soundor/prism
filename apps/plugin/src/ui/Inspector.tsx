import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { EDGE, GAP, INSPECTOR_HEIGHT } from '../layout';

// The persistent band inspector: the band strip, then one row of parameter
// cells whose positions never change.
export function Inspector() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: INSPECTOR_HEIGHT,
        flexShrink: 0,
        marginTop: GAP,
        marginHorizontal: EDGE,
        borderRadius: theme.radius.radiusLg,
        borderWidth: theme.size.borderHairline,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surfaceElevated,
      }}
    />
  );
}
