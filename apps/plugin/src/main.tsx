import { Knob, SegmentedControl, registerFonts } from '@soundor/components';
import { Image, Text, View, render, useParameter } from '@soundor/react';
import { Circle, G, Line, Svg } from '@soundor/react/svg';
import { parameters } from 'soundor:parameters';

import logo from '../../../assets/brand/svg/soundor-prism-logo.svg';

const bands = [
  { parameter: parameters.low, frequency: '100 Hz', color: '#FF8F4D', x: 126 },
  { parameter: parameters.lowMid, frequency: '400 Hz', color: '#B8A3FF', x: 223 },
  { parameter: parameters.highMid, frequency: '2 kHz', color: '#C4EC6F', x: 336 },
  { parameter: parameters.high, frequency: '8 kHz', color: '#FFC043', x: 433 },
] as const;

function GainDisplay({ bypass }: { bypass: boolean }) {
  const gains = [
    useParameter(parameters.low),
    useParameter(parameters.lowMid),
    useParameter(parameters.highMid),
    useParameter(parameters.high),
  ];

  return (
    <View style={{ height: 154, borderRadius: 12, backgroundColor: '#10121A', padding: 14 }}>
      <Text style={{ fontSize: 12, color: '#B9BFCE' }}>Band gain · dB</Text>
      <Svg
        width={564}
        height={109}
        viewBox={[0, 0, 564, 109]}
        style={{ opacity: bypass ? 0.55 : 1 }}
      >
        {[11, 55, 99].map((y) => (
          <Line
            key={y}
            x1={0}
            y1={y}
            x2={564}
            y2={y}
            stroke={y === 55 ? '#686F85' : '#303547'}
            strokeWidth={1}
          />
        ))}
        {bands.map(({ color, x }, i) => {
          const y = 55 - ((gains[i] ?? 0) * 44) / 12;
          return (
            <G key={x}>
              <Line x1={x} y1={11} x2={x} y2={99} stroke="#303547" strokeWidth={1} />
              <Line x1={x} y1={55} x2={x} y2={y} stroke={color} strokeWidth={3} />
              <Circle cx={x} cy={y} r={5} fill={color} />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function App() {
  const bypass = useParameter(parameters.bypass);
  return (
    <View style={{ flex: 1, backgroundColor: '#F2F4F7', padding: 24, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Image
          source={logo}
          accessibilityLabel="Soundor Prism"
          style={{ width: 152, height: 55, resizeMode: 'contain' }}
        />
        <SegmentedControl
          label="Compare audio"
          options={[
            { value: 'dry', label: 'Original' },
            { value: 'eq', label: 'Prism' },
          ]}
          value={bypass ? 'dry' : 'eq'}
          onChange={(value) => parameters.bypass.set(value === 'dry', { history: true })}
        />
      </View>
      <GainDisplay bypass={bypass} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        {bands.map(({ parameter, frequency, color }) => (
          <View key={frequency} style={{ alignItems: 'center', gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: color,
                  borderWidth: 1,
                  borderColor: '#686F85',
                }}
              />
              <Text style={{ color: '#42495E', fontSize: 12 }}>{frequency}</Text>
            </View>
            <Knob
              parameter={parameter}
              format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`}
              history={{ label: `Adjust ${parameter.info.label}` }}
              accessibilityHint={`${frequency}. Drag or use the arrow keys. Home resets to 0 dB.`}
              resetOnHome
              wheelStep={0.25}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

void registerFonts().catch((error: unknown) => console.warn('Prism fonts could not load', error));
render(<App />);
