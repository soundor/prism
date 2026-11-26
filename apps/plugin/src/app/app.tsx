import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';

import { clearSelection } from '../bands/selection';
import { trackModifiers } from '../graph/pointer';
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
      // Escape clears the band selection, unless a control used it first:
      // to cancel a drag, close a menu or leave a field.
      onKeyDown={(event) => {
        trackModifiers(event);
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        clearSelection();
      }}
      // Alt pressed or let go with the pointer still: the tooltip follows.
      onKeyUp={trackModifiers}
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
