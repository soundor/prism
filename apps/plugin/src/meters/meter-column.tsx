import { LevelMeter, ValueField, type PlotSource } from '@soundor/components';
import { textStyle, useTheme } from '@soundor/components/theme';
import { Text, View } from '@soundor/react';
import { useSyncExternalStore } from 'react';
import { parameters } from 'soundor:parameters';

import { GRAPH_HEIGHT, METER_WIDTH } from '../app/layout';

export function MeterColumn({ levels }: { levels: PlotSource<[number, number]> }) {
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
      <StereoMeter levels={levels} />
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

function StereoMeter({ levels }: { levels: PlotSource<[number, number]> }) {
  const theme = useTheme();
  const value = useSyncExternalStore(levels.subscribe, levels.get);
  const peak = value ? Math.max(...value) : -60;
  return (
    <View style={{ alignItems: 'center', gap: 9 }}>
      <LevelMeter
        value={value ?? [undefined, undefined]}
        label="Output level"
        min={-60}
        max={6}
        fallRate={24}
        peakHold={1.5}
        ticks={[0, -6, -12, -24, -48]}
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
