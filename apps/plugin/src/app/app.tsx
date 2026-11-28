import { ResizeGrip } from '@soundor/components';
import { useTheme } from '@soundor/components/theme';
import { View } from '@soundor/react';
import { useEffect, useState } from 'react';
import { history } from 'soundor:history';

import { createAnalyzer } from '../analyzer/analyzer';
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
  const [analyzer] = useState(createAnalyzer);
  useEffect(() => analyzer.start(), [analyzer]);
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
        if (event.defaultPrevented) return;
        if (
          (event.metaKey || event.ctrlKey) &&
          !event.altKey &&
          event.key.toLowerCase() === 'z' &&
          event.target?.type !== 'input'
        ) {
          if (event.shiftKey ? history.canRedo() : history.canUndo()) {
            event.preventDefault();
            if (event.shiftKey) history.redo();
            else history.undo();
          }
          return;
        }
        if (event.key !== 'Escape') return;
        if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
        clearSelection();
      }}
      // Alt pressed or let go with the pointer still: the tooltip follows.
      onKeyUp={trackModifiers}
    >
      <Header />
      <View style={{ flexDirection: 'row', gap: GAP, paddingTop: GAP, paddingHorizontal: EDGE }}>
        <Graph analyzer={analyzer} />
        <MeterColumn />
      </View>
      <Inspector />
      <Footer onFreeze={analyzer.setFrozen} />
      {/* Bottom-right, over the footer's end; nothing when the host cannot resize. */}
      <ResizeGrip />
    </View>
  );
}
