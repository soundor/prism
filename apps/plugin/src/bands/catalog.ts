// Prism's band model as plain data, shared by soundor.config.ts and the UI.
// The order of every list here is persistent: hosts store a choice parameter
// as its option's index, so add new entries at the end only.

export const MAX_BANDS = 24;

export const FREQUENCY_MIN = 10;
export const FREQUENCY_MAX = 30_000;
export const GAIN_LIMIT = 30;
export const Q_MIN = 0.025;
export const Q_MAX = 40;
export const IO_GAIN_LIMIT = 24;

export const filterTypes = [
  { value: 'bell', label: 'Bell' },
  { value: 'lowShelf', label: 'Low shelf' },
  { value: 'highShelf', label: 'High shelf' },
  { value: 'lowCut', label: 'Low cut' },
  { value: 'highCut', label: 'High cut' },
  { value: 'notch', label: 'Notch' },
  { value: 'bandPass', label: 'Band pass' },
] as const;

export const slopes = [
  { value: 'db6', label: '6 dB/oct' },
  { value: 'db12', label: '12 dB/oct' },
  { value: 'db24', label: '24 dB/oct' },
  { value: 'db36', label: '36 dB/oct' },
  { value: 'db48', label: '48 dB/oct' },
] as const;

export const channels = [
  { value: 'stereo', label: 'Stereo' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'mid', label: 'Mid' },
  { value: 'side', label: 'Side' },
] as const;

export type FilterType = (typeof filterTypes)[number]['value'];
export type Slope = (typeof slopes)[number]['value'];
export type Channel = (typeof channels)[number]['value'];

/** One band slot's settings, as its parameters hold them. */
export interface BandSettings {
  /** Whether the slot holds a band at all; inactive slots are hidden. */
  active: boolean;
  /** On, or bypassed. */
  enabled: boolean;
  type: FilterType;
  frequency: number;
  gain: number;
  q: number;
  slope: Slope;
  channel: Channel;
  solo: boolean;
}

export const defaultBand: BandSettings = {
  active: false,
  enabled: true,
  type: 'bell',
  frequency: 1000,
  gain: 0,
  q: 0.707,
  slope: 'db24',
  channel: 'stereo',
  solo: false,
};

export const bandFields = [
  'active',
  'enabled',
  'type',
  'frequency',
  'gain',
  'q',
  'slope',
  'channel',
  'solo',
] as const satisfies readonly (keyof BandSettings)[];

export type BandField = (typeof bandFields)[number];

const capitalize = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

/** The parameter id of a band slot's field: `band1Frequency` for slot 1. */
export const bandParameterId = (slot: number, field: BandField) =>
  `band${slot}${capitalize(field)}` as const;

/** Slot numbers, 1 to MAX_BANDS. */
export const bandSlots = Array.from({ length: MAX_BANDS }, (_, i) => i + 1);

/** One slot's band: its number (1 to MAX_BANDS) and settings. */
export interface Band extends BandSettings {
  slot: number;
}

/** Bell and shelves boost and cut; the other types sit on the 0 dB line. */
export const hasGain = (type: FilterType) =>
  type === 'bell' || type === 'lowShelf' || type === 'highShelf';

/** Cuts have a slope, and a rounded-square marker. */
export const hasSlope = (type: FilterType) => type === 'lowCut' || type === 'highCut';

/** Every type uses Q but a 6 dB/oct cut, a first-order section. */
export const hasQ = (type: FilterType, slope: Slope) => !(hasSlope(type) && slope === 'db6');

/** dB per octave for each slope. */
export const slopeDecibels: Record<Slope, number> = {
  db6: 6,
  db12: 12,
  db24: 24,
  db36: 36,
  db48: 48,
};

/** The badge on a marker that is not stereo. */
export const channelBadges: Record<Channel, string | null> = {
  stereo: null,
  left: 'L',
  right: 'R',
  mid: 'M',
  side: 'S',
};

export const filterTypeLabel = (type: FilterType) =>
  filterTypes.find((option) => option.value === type)!.label;
