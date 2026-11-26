import { defineSoundorConfig } from '@soundor/config';
import { vst3Runtime } from '@soundor/vst3-runtime';
import { webRuntime } from '@soundor/web-runtime';

import manifest from './package.json' with { type: 'json' };

const gain = (label: string) => ({
  type: 'float32' as const,
  label,
  min: -12,
  max: 12,
  default: 0,
});

export default defineSoundorConfig({
  plugin: {
    // Do not change: VST3 class IDs and saved sessions depend on this ID.
    id: 'dev.soundor.prism',
    name: 'Soundor Prism',
    version: manifest.version,
    vendor: { name: 'Soundor', website: 'https://soundor.dev' },
  },
  editor: { width: 640, height: 400 },
  runtimes: [vst3Runtime(), webRuntime({ inputs: './web/inputs.ts' })],
  parameters: {
    low: gain('Low'),
    lowMid: gain('Low mid'),
    highMid: gain('High mid'),
    high: gain('High'),
    bypass: { type: 'boolean', label: 'Bypass', default: false },
  },
});
