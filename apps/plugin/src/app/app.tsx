import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { EDGE, EDITOR_HEIGHT, EDITOR_WIDTH, GAP } from './layout';
import { Footer } from './footer';
import { Graph } from '../graph/graph';
import { Header } from './header';
import { Inspector } from '../inspector/inspector';
import { MeterColumn } from '../meters/meter-column';

export function App() {
  const theme = useTheme();
  return (
    <View
      style={{
        width: EDITOR_WIDTH,
        height: EDITOR_HEIGHT,
        backgroundColor: theme.color.background,
        overflow: 'hidden',
      }}
    >
      <Header />
      <View style={{ flexDirection: 'row', gap: GAP, paddingTop: GAP, paddingHorizontal: EDGE }}>
        <Graph />
        <MeterColumn />
      </View>
      <Inspector />
      <Footer />
    </View>
  );
}
