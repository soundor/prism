import { LevelMeter, ValueField } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, View, useNativeStream } from '@soundor/react';
import { streams } from 'soundor:native';
import { parameters } from 'soundor:parameters';

import { GRAPH_HEIGHT, METER_WIDTH } from '../app/layout';

export function MeterColumn() {
  return (
    <View
      style={{
        width: METER_WIDTH,
        height: GRAPH_HEIGHT,
        flexShrink: 0,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Gain input />
      <StereoMeter />
      <Gain input={false} />
    </View>
  );
}

function Gain({ input }: { input: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={textStyle(theme, 'technical', theme.color.textMuted)}>
        {input ? 'IN' : 'OUT'}
      </Text>
      <ValueField
        size="sm"
        width={METER_WIDTH - 2}
        label=""
        accessibilityLabel={input ? 'Input gain' : 'Output gain'}
        parameter={input ? parameters.inputGain : parameters.outputGain}
      />
    </View>
  );
}

const NO_LEVELS = [undefined, undefined];
const CHANNEL_LABELS = ['left', 'right'];
const METER_TICKS = [0, -6, -12, -24, -48];
const clipResetLabel = (channel: string | undefined) => `Output clip, ${channel}`;

/** The output's level, as the processor measures it: left and right, in dBFS. */
function StereoMeter() {
  const theme = useTheme();
  const levels = useNativeStream(streams.outputLevels);
  const value = levels && levels.length === 2 ? [levels[0]!, levels[1]!] : undefined;
  const peak = value ? Math.max(-60, ...value) : -60;
  return (
    <View style={{ alignItems: 'center', gap: 9 }}>
      <LevelMeter
        value={value ?? NO_LEVELS}
        label="Output level"
        channelLabels={CHANNEL_LABELS}
        clipResetLabel={clipResetLabel}
        min={-60}
        max={6}
        fallRate={24}
        peakHold={1.5}
        ticks={METER_TICKS}
        length={362}
        size="md"
      />
      <Text
        accessible={false}
        style={textStyle(
          theme,
          'technical',
          peak >= 0 ? theme.color.danger : theme.color.textSecondary,
        )}
      >
        {peak >= 0 ? '+' : '−'}
        {Math.abs(peak).toFixed(1)}
      </Text>
    </View>
  );
}
