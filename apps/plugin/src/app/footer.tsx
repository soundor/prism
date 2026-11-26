import { SegmentedControl } from '@soundor/components';
import { ring, textStyle, useTheme } from '@soundor/components/theme';
import { Pause, Play } from '@soundor/icons/lucide';
import { Pressable, Text, useStateValue, View } from '@soundor/react';
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
  const FreezeIcon = frozen ? Play : Pause;
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
      <Pressable
        accessibilityLabel="Freeze spectrum"
        accessibilityRole="togglebutton"
        accessibilityState={{ checked: frozen }}
        disabled={analyzer === 'off'}
        onPress={() => {
          setFrozen(!frozen);
          onFreeze(!frozen);
        }}
        style={({ hovered, focusVisible }) => ({
          width: 28,
          height: 24,
          borderRadius: theme.radius.radiusMd,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: frozen || hovered ? theme.color.surfaceInset : 'transparent',
          opacity: analyzer === 'off' ? theme.opacity.opacityDisabled : 1,
          cursor: analyzer === 'off' ? 'default' : 'pointer',
          ...ring(theme, focusVisible),
        })}
      >
        <FreezeIcon
          size={14}
          color={frozen ? theme.color.positive : theme.color.textSecondary}
          strokeWidth={1.75}
        />
      </Pressable>
      <AnalyzerSettings />
      <View
        style={{
          width: theme.size.borderHairline,
          height: 18,
          backgroundColor: theme.color.divider,
        }}
      />
      <Text style={caption}>Range</Text>
      <SegmentedControl<DisplayRange>
        label="Response display range"
        size="sm"
        styles={compactSegments}
        value={range}
        options={(Object.keys(rangeDecibels) as DisplayRange[]).map((value) => ({
          value,
          label: `±${rangeDecibels[value]}`,
        }))}
        onChange={(value) => state.displayRange.set(value)}
      />
    </View>
  );
}
