// Factory presets as band lists. soundor.config.ts turns each into a complete
// parameter snapshot: bands fill slots 1, 2, 3… in order, and every other slot
// keeps its defaults (inactive).

import type { BandSettings } from './src/bands/catalog';

type BandSpec = Partial<BandSettings> & Pick<BandSettings, 'type' | 'frequency'>;

export interface FactoryPreset {
  id: string;
  name: string;
  bands: readonly BandSpec[];
}

// Keep the order and ids stable once released: hosts list programs in config
// order, and may store a program's index.
export const factoryPresets: readonly FactoryPreset[] = [
  { id: 'init', name: 'Init', bands: [] },
  {
    id: 'vocal-presence',
    name: 'Vocal Presence',
    bands: [
      { type: 'lowCut', frequency: 85, q: 0.707, slope: 'db24' },
      { type: 'bell', frequency: 240, gain: -3.2, q: 1.4 },
      { type: 'bell', frequency: 3100, gain: 2.6, q: 0.9 },
      { type: 'notch', frequency: 6400, q: 6, channel: 'mid' },
      { type: 'highShelf', frequency: 11_500, gain: 3.4, q: 0.7 },
    ],
  },
  {
    id: 'kick-tighten',
    name: 'Kick Tighten',
    bands: [
      { type: 'lowShelf', frequency: 55, gain: 3, q: 0.8 },
      { type: 'bell', frequency: 380, gain: -5, q: 2.2 },
      { type: 'bell', frequency: 3800, gain: 3.5, q: 1.6 },
    ],
  },
  {
    id: 'gentle-master',
    name: 'Gentle Master',
    bands: [
      { type: 'lowCut', frequency: 24, q: 0.707, slope: 'db12' },
      { type: 'lowShelf', frequency: 90, gain: 1.2, q: 0.6 },
      { type: 'bell', frequency: 2200, gain: -0.8, q: 0.8 },
      { type: 'highShelf', frequency: 12_000, gain: 1.5, q: 0.6, channel: 'side' },
    ],
  },
  {
    id: 'rumble-cleanup',
    name: 'Rumble Cleanup',
    bands: [
      { type: 'lowCut', frequency: 40, q: 0.707, slope: 'db48' },
      { type: 'bell', frequency: 180, gain: -2, q: 1.2 },
    ],
  },
];
