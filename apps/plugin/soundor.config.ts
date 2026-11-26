import { defineSoundorConfig, type Formatter, type Parser } from '@soundor/config';
import { vst3Runtime } from '@soundor/vst3-runtime';
import { webRuntime } from '@soundor/web-runtime';

import manifest from './package.json' with { type: 'json' };
import {
  FREQUENCY_MAX,
  FREQUENCY_MIN,
  GAIN_LIMIT,
  IO_GAIN_LIMIT,
  Q_MAX,
  Q_MIN,
  bandParameterId,
  bandSlots,
  channels,
  defaultBand,
  filterTypes,
  slopes,
  type BandSettings,
} from './src/catalog';
import { factoryPresets } from './src/factory-presets';

// Host-facing text. The UI formats values itself (true minus signs, signed
// gains); hosts and typed input use these, which read back what they write.
const decibels = {
  unit: 'dB',
  format: ((e) => e.concat(e.fixed(e.value, 1), ' dB')) satisfies Formatter<'float32'>,
  parse: ((e) =>
    e.parseFloat32(e.removeSuffix(e.lower(e.trim(e.text)), 'db'))) satisfies Parser<'float32'>,
} as const;

const frequency = {
  type: 'float32',
  min: FREQUENCY_MIN,
  max: FREQUENCY_MAX,
  default: defaultBand.frequency,
  mapping: 'log',
  unit: 'Hz',
  // 31.5 Hz, 240 Hz, 3.10 kHz, 11.5 kHz
  format: ((e) =>
    e.if(
      e.gte(e.value, 10_000),
      e.concat(e.fixed(e.div(e.value, 1000), 1), ' kHz'),
      e.if(
        e.gte(e.value, 1000),
        e.concat(e.fixed(e.div(e.value, 1000), 2), ' kHz'),
        e.if(
          e.gte(e.value, 100),
          e.concat(e.fixed(e.value, 0), ' Hz'),
          e.concat(e.fixed(e.value, 1), ' Hz'),
        ),
      ),
    )) satisfies Formatter<'float32'>,
  // "3.1 kHz", "3.1k", "3100", "440 hz"
  parse: ((e) =>
    e.let(e.lower(e.trim(e.text)), (text) =>
      e.if(
        e.endsWith(text, 'khz'),
        e.map(e.parseFloat32(e.removeSuffix(text, 'khz')), (v) => e.mul(v, 1000)),
        e.if(
          e.endsWith(text, 'k'),
          e.map(e.parseFloat32(e.removeSuffix(text, 'k')), (v) => e.mul(v, 1000)),
          e.parseFloat32(e.removeSuffix(text, 'hz')),
        ),
      ),
    )) satisfies Parser<'float32'>,
} as const;

const q = {
  type: 'float32',
  min: Q_MIN,
  max: Q_MAX,
  default: defaultBand.q,
  mapping: 'log',
  // Three significant figures: 0.707, 1.40, 12.0
  format: ((e) =>
    e.if(
      e.gte(e.value, 10),
      e.fixed(e.value, 1),
      e.if(e.gte(e.value, 1), e.fixed(e.value, 2), e.fixed(e.value, 3)),
    )) satisfies Formatter<'float32'>,
  parse: 'default',
} as const;

function bandParameters(slot: number) {
  const group = `band${slot}`;
  const label = (name: string) => `Band ${slot} ${name}`;
  return {
    [bandParameterId(slot, 'active')]: {
      type: 'boolean',
      label: label('active'),
      default: defaultBand.active,
      access: 'manual',
      group,
    },
    [bandParameterId(slot, 'enabled')]: {
      type: 'boolean',
      label: label('on'),
      default: defaultBand.enabled,
      group,
    },
    [bandParameterId(slot, 'type')]: {
      type: 'choice',
      label: label('type'),
      options: filterTypes,
      default: defaultBand.type,
      group,
    },
    [bandParameterId(slot, 'frequency')]: { ...frequency, label: label('frequency'), group },
    [bandParameterId(slot, 'gain')]: {
      type: 'float32',
      label: label('gain'),
      min: -GAIN_LIMIT,
      max: GAIN_LIMIT,
      default: defaultBand.gain,
      ...decibels,
      group,
    },
    [bandParameterId(slot, 'q')]: { ...q, label: label('Q'), group },
    [bandParameterId(slot, 'slope')]: {
      type: 'choice',
      label: label('slope'),
      options: slopes,
      default: defaultBand.slope,
      group,
    },
    [bandParameterId(slot, 'channel')]: {
      type: 'choice',
      label: label('channel'),
      options: channels,
      default: defaultBand.channel,
      group,
    },
    [bandParameterId(slot, 'solo')]: {
      type: 'boolean',
      label: label('solo'),
      default: defaultBand.solo,
      access: 'manual',
      group,
    },
  } as const;
}

function presetParameters(bands: readonly Partial<BandSettings>[]) {
  return Object.fromEntries(
    bands.flatMap((band, i) =>
      Object.entries({ ...defaultBand, ...band, active: true }).map(([field, value]) => [
        bandParameterId(i + 1, field as keyof BandSettings),
        value,
      ]),
    ),
  );
}

export default defineSoundorConfig({
  plugin: {
    // Do not change: VST3 class IDs and saved sessions depend on this ID.
    id: 'dev.soundor.prism',
    name: 'Soundor Prism',
    version: manifest.version,
    vendor: { name: 'Soundor', website: 'https://soundor.dev' },
    categories: ['eq'],
  },
  // One reference layout, zoomed as a whole from 75 % to 200 %.
  editor: {
    width: 1200,
    height: 720,
    resizable: true,
    resize: 'scale',
    minWidth: 900,
    minHeight: 540,
    maxWidth: 2400,
    maxHeight: 1440,
  },
  runtimes: [vst3Runtime(), webRuntime({ inputs: './web/inputs.ts' })],
  parameterGroups: {
    global: { label: 'Global' },
    ...Object.fromEntries(bandSlots.map((slot) => [`band${slot}`, { label: `Band ${slot}` }])),
  },
  parameters: {
    bypass: { type: 'boolean', label: 'Bypass', default: false, role: 'bypass', group: 'global' },
    inputGain: {
      type: 'float32',
      label: 'Input gain',
      min: -IO_GAIN_LIMIT,
      max: IO_GAIN_LIMIT,
      default: 0,
      ...decibels,
      group: 'global',
    },
    outputGain: {
      type: 'float32',
      label: 'Output gain',
      min: -IO_GAIN_LIMIT,
      max: IO_GAIN_LIMIT,
      default: 0,
      ...decibels,
      group: 'global',
    },
    ...Object.assign({}, ...bandSlots.map(bandParameters)),
  },
  native: {
    types: {
      FilterType: { enum: filterTypes.map((option) => option.value) },
      Slope: { enum: slopes.map((option) => option.value) },
      Channel: { enum: channels.map((option) => option.value) },
      Band: {
        struct: {
          active: 'boolean',
          enabled: 'boolean',
          type: 'FilterType',
          frequency: 'float32',
          gain: 'float32',
          q: 'float32',
          slope: 'Slope',
          channel: 'Channel',
          solo: 'boolean',
        },
      },
      // Everything A/B compares: the band slots and the two gains.
      CompareSnapshot: {
        struct: { bands: 'Band[]', inputGain: 'float32', outputGain: 'float32' },
      },
      CompareSide: { enum: ['a', 'b'] },
      AnalyzerMode: { enum: ['off', 'pre', 'post', 'prePost'] },
      AnalyzerFftSize: { enum: ['fft2048', 'fft4096', 'fft8192', 'fft16384'] },
      AnalyzerWindow: { enum: ['hann', 'blackmanHarris', 'hamming', 'flatTop'] },
      AnalyzerSmoothing: { enum: ['off', 'oct12', 'oct6', 'oct3'] },
      AnalyzerSpeed: { enum: ['slow', 'medium', 'fast'] },
      AnalyzerFloor: { enum: ['db60', 'db90', 'db120'] },
      DisplayMode: { enum: ['magnitude', 'phase'] },
      DisplayRange: { enum: ['db3', 'db6', 'db12', 'db24', 'db30'] },
    },
  },
  // Saved with the DAW project. Field names are persistent identities.
  state: {
    // A/B: the slot on screen, and the other one. Null until B is first used,
    // when it starts from the default setup.
    compareSide: { type: 'CompareSide', default: 'a' },
    compareOther: { type: 'CompareSnapshot?', default: null },
    // View settings, kept per track.
    analyzerMode: { type: 'AnalyzerMode', default: 'prePost' },
    analyzerFftSize: { type: 'AnalyzerFftSize', default: 'fft8192' },
    analyzerWindow: { type: 'AnalyzerWindow', default: 'hann' },
    analyzerSmoothing: { type: 'AnalyzerSmoothing', default: 'oct6' },
    analyzerSpeed: { type: 'AnalyzerSpeed', default: 'medium' },
    analyzerTilt: { type: 'float32', default: 4.5 },
    analyzerFloor: { type: 'AnalyzerFloor', default: 'db90' },
    analyzerPeakHold: { type: 'boolean', default: false },
    displayMode: { type: 'DisplayMode', default: 'magnitude' },
    displayRange: { type: 'DisplayRange', default: 'db12' },
    showSpectrogram: { type: 'boolean', default: false },
    showKeyboard: { type: 'boolean', default: false },
  },
  presets: factoryPresets.map(({ id, name, bands }) => ({
    id,
    name,
    parameters: presetParameters(bands),
  })),
});
