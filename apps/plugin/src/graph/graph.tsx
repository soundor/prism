import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { GRAPH_HEIGHT } from '../app/layout';

// The equalizer graph: response curves, band markers and the analyzer.
export function Graph() {
  const theme = useTheme();
  return (
    <View
      style={{
        flexGrow: 1,
        height: GRAPH_HEIGHT,
        borderRadius: theme.radius.radiusXl,
        backgroundColor: theme.color.display,
        overflow: 'hidden',
      }}
    />
  );
}
