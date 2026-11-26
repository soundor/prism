import { SegmentedControl, Select, Toggle } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, useStateValue, View } from '@soundor/react';
import { useState } from 'react';
import { state, type AnalyzerMode, type DisplayRange } from 'soundor:state';

import { AnalyzerSettings, compactSegments } from '../analyzer/settings';
import { rangeDecibels } from '../graph/axes';
import { FOOTER_HEIGHT, GAP } from './layout';

export function Footer({ onFreeze }: { onFreeze: (value: boolean) => void }) {
  const theme = useTheme();
  const analyzer = useStateValue(state.analyzerMode);
  const range = useStateValue(state.displayRange);
  const [frozen, setFrozen] = useState(false);
  const caption = textStyle(theme, 'technical', theme.color.textMuted);
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
    >
      <Text style={caption}>Analyzer</Text>
      <SegmentedControl<AnalyzerMode>
        label="Analyzer mode"
        size="sm"
        styles={compactSegments}
        value={analyzer}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'pre', label: 'Pre' },
          { value: 'post', label: 'Post' },
          { value: 'prePost', label: 'Pre + Post' },
        ]}
        onChange={(value) => state.analyzerMode.set(value)}
      />
      <Toggle
        label="Freeze"
        accessibilityLabel="Freeze spectrum"
        size="sm"
        value={frozen}
        disabled={analyzer === 'off'}
        onChange={(value) => {
          setFrozen(value);
          onFreeze(value);
        }}
        styles={{ root: { alignSelf: 'center' } }}
      />
      <AnalyzerSettings />
      <View
        style={{
          width: theme.size.borderHairline,
          height: 18,
          backgroundColor: theme.color.divider,
        }}
      />
      <Text style={caption}>Range</Text>
      <Select<DisplayRange>
        accessibilityLabel="Response display range"
        size="sm"
        styles={{ root: { alignSelf: 'center' } }}
        width={76}
        side="top"
        value={range}
        options={(Object.keys(rangeDecibels) as DisplayRange[]).map((value) => ({
          value,
          label: `±${rangeDecibels[value]} dB`,
        }))}
        onChange={(value) => state.displayRange.set(value)}
      />
    </View>
  );
}
