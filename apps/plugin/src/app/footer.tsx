import { SegmentedControl, Tooltip } from '@soundor/components';
import { ring, textStyle, useTheme } from '@soundor/components/theme';
import {
  ChartColumnBig,
  Pause,
  Piano,
  Play,
  type IconComponent,
  type StrokeIconProps,
} from '@soundor/icons/lucide';
import { Pressable, Text, useStateValue, View } from '@soundor/react';
import { useState } from 'react';
import { state, type AnalyzerMode, type DisplayMode, type DisplayRange } from 'soundor:state';

import { AnalyzerSettings, compactSegments } from '../analyzer/settings';
import { rangeDecibels } from '../graph/axes';
import { FOOTER_HEIGHT, GAP } from './layout';
import { TrackInfo } from './track-info';

export function Footer({ onFreeze }: { onFreeze: (value: boolean) => void }) {
  const theme = useTheme();
  const analyzer = useStateValue(state.analyzerMode);
  const range = useStateValue(state.displayRange);
  const display = useStateValue(state.displayMode);
  const spectrogram = useStateValue(state.showSpectrogram);
  const keyboard = useStateValue(state.showKeyboard);
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
      <FooterToggle
        icon={frozen ? Play : Pause}
        label="Freeze spectrum"
        tip={frozen ? 'Resume the spectrum' : 'Freeze the spectrum'}
        checked={frozen}
        disabled={analyzer === 'off' && !spectrogram}
        onPress={() => {
          setFrozen(!frozen);
          onFreeze(!frozen);
        }}
      />
      <AnalyzerSettings />
      <Divider />
      <Text style={caption}>Display</Text>
      <SegmentedControl<DisplayMode>
        label="Display"
        size="sm"
        styles={compactSegments}
        value={display}
        options={[
          { value: 'magnitude', label: 'Magnitude' },
          { value: 'phase', label: 'Phase' },
        ]}
        onChange={(value) => state.displayMode.set(value)}
      />
      <FooterToggle
        icon={ChartColumnBig}
        label="Spectrogram"
        tip={spectrogram ? 'Hide the spectrogram' : 'Show the spectrogram'}
        checked={spectrogram}
        onPress={() => state.showSpectrogram.set(!spectrogram)}
      />
      <FooterToggle
        icon={Piano}
        label="Pitch keyboard"
        tip={keyboard ? 'Hide the pitch keyboard' : 'Show the pitch keyboard'}
        checked={keyboard}
        onPress={() => state.showKeyboard.set(!keyboard)}
      />
      <Divider />
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
      <TrackInfo />
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return (
    <View
      style={{ width: theme.size.borderHairline, height: 18, backgroundColor: theme.color.divider }}
    />
  );
}

/** An icon button that stays pressed: graphite with a light icon while on. */
function FooterToggle({
  icon: Icon,
  label,
  tip,
  checked,
  disabled = false,
  onPress,
}: {
  icon: IconComponent<StrokeIconProps>;
  label: string;
  tip: string;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Tooltip content={tip}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="togglebutton"
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ hovered, focusVisible }) => ({
          width: 28,
          height: 24,
          borderRadius: theme.radius.radiusMd,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked
            ? theme.color.selected
            : hovered && !disabled
              ? theme.color.surface
              : 'transparent',
          opacity: disabled ? theme.opacity.opacityDisabled : 1,
          cursor: disabled ? 'default' : 'pointer',
          ...ring(theme, focusVisible),
        })}
      >
        <Icon
          size={14}
          color={checked ? theme.color.selectedForeground : theme.color.textSecondary}
          strokeWidth={1.75}
        />
      </Pressable>
    </Tooltip>
  );
}
