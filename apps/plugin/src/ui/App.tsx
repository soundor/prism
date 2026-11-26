import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { EDGE, EDITOR_HEIGHT, EDITOR_WIDTH, GAP } from '../layout';
import { Footer } from './Footer';
import { Graph } from './Graph';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { MeterColumn } from './MeterColumn';

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
