import { Button, Popover, SegmentedControl } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { SlidersHorizontal } from '@soundor/icons/lucide';
import { Text, useStateValue, View } from '@soundor/react';
import { state, type StateField } from 'soundor:state';

export const compactSegments = {
  root: { alignSelf: 'center', padding: 2 },
  segment: { height: 18, minWidth: 28, paddingHorizontal: 8 },
  label: { fontSize: 10 },
} as const;

export function AnalyzerSettings() {
  const theme = useTheme();
  return (
    <Popover>
      <Popover.Trigger>
        <Button
          size="sm"
          variant="ghost"
          accessibilityLabel="Analyzer settings"
          leading={
            <SlidersHorizontal size={14} color={theme.color.textSecondary} strokeWidth={1.75} />
          }
          styles={{ root: { width: 26, paddingHorizontal: 0 } }}
        />
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="center"
        offset={10}
        accessibilityLabel="Analyzer settings"
        styles={{ root: { width: 348, padding: 14 } }}
      >
        <Popover.Arrow />
        <View style={{ gap: 4 }}>
          <Text style={[textStyle(theme, 'technical', theme.color.textMuted), { marginBottom: 4 }]}>
            Analyzer settings
          </Text>
          <Setting
            label="FFT size"
            field={state.analyzerFftSize}
            values={{ fft2048: '2k', fft4096: '4k', fft8192: '8k', fft16384: '16k' }}
          />
          <Setting
            label="Window"
            field={state.analyzerWindow}
            values={{
              hann: 'Hann',
              blackmanHarris: 'Blackman-H.',
              hamming: 'Hamming',
              flatTop: 'Flat top',
            }}
          />
          <Setting
            label="Smoothing"
            field={state.analyzerSmoothing}
            values={{ off: 'Off', oct12: '1/12', oct6: '1/6', oct3: '1/3' }}
          />
          <Setting
            label="Response"
            field={state.analyzerSpeed}
            values={{ slow: 'Slow', medium: 'Medium', fast: 'Fast' }}
          />
          <Setting
            label="Tilt · dB/oct"
            value={`tilt${useStateValue(state.analyzerTilt)}`}
            onChange={(value) => state.analyzerTilt.set(Number(value.slice(4)))}
            values={{ tilt0: '0', tilt3: '3', 'tilt4.5': '4.5', tilt6: '6' }}
          />
          <Setting
            label="Floor"
            field={state.analyzerFloor}
            values={{ db60: '−60', db90: '−90', db120: '−120' }}
          />
          <Setting
            label="Peak hold"
            value={useStateValue(state.analyzerPeakHold) ? 'on' : 'off'}
            onChange={(value) => state.analyzerPeakHold.set(value === 'on')}
            values={{ off: 'Off', on: 'On' }}
          />
        </View>
      </Popover.Content>
    </Popover>
  );
}

function Setting<T extends string>(
  props: {
    label: string;
    values: Record<T, string>;
  } & ({ field: StateField<T> } | { value: T; onChange: (value: T) => void }),
) {
  if ('field' in props) return <StateSetting {...props} field={props.field} />;
  return <SettingRow {...props} />;
}

function StateSetting<T extends string>({
  field,
  ...props
}: {
  label: string;
  values: Record<T, string>;
  field: StateField<T>;
}) {
  return (
    <SettingRow {...props} value={useStateValue(field)} onChange={(value) => field.set(value)} />
  );
}

function SettingRow<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 28,
      }}
    >
      <Text style={textStyle(theme, 'caption', theme.color.textSecondary)}>{label}</Text>
      <SegmentedControl<T>
        size="sm"
        styles={compactSegments}
        label={label}
        value={value}
        onChange={onChange}
        options={(Object.keys(values) as T[]).map((value) => ({ value, label: values[value] }))}
      />
    </View>
  );
}
