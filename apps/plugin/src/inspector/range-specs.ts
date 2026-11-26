import { FREQUENCY_MAX, FREQUENCY_MIN, GAIN_LIMIT, Q_MAX, Q_MIN } from '../bands/catalog';
import { formatFrequency, formatGain, formatQ } from '../bands/format';
import type { RangeSpec } from './range-cell';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The first number in the text, with a true minus or a comma decimal allowed. */
export function parseNumber(text: string): number | null {
  const match = /[+\-−]?\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)/.exec(text);
  if (!match) return null;
  const value = Number(match[0].replace('−', '-').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** "3.1k", "3.1 kHz", "440", "440 Hz". */
export function parseFrequency(text: string): number | null {
  const value = parseNumber(text);
  if (value === null) return null;
  return /\d\s*k/i.test(text) ? value * 1000 : value;
}

const signed = (value: number, digits: number) => {
  const shown = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return `${shown < 0 ? '−' : '+'}${Math.abs(shown).toFixed(digits)}`;
};

export const frequencySpec: RangeSpec = {
  field: 'frequency',
  label: 'Frequency',
  fieldWidth: 94,
  min: FREQUENCY_MIN,
  max: FREQUENCY_MAX,
  scale: 'log',
  format: formatFrequency,
  parse: parseFrequency,
  offset: {
    min: -4,
    max: 4,
    step: 0.01,
    format: (octaves) => `${signed(octaves, 2)} oct`,
    parse: parseNumber,
    apply: (start, octaves) => clamp(start * 2 ** octaves, FREQUENCY_MIN, FREQUENCY_MAX),
  },
};

export const gainSpec: RangeSpec = {
  field: 'gain',
  label: 'Gain',
  fieldWidth: 74,
  min: -GAIN_LIMIT,
  max: GAIN_LIMIT,
  scale: 'linear',
  format: formatGain,
  parse: parseNumber,
  offset: {
    min: -2 * GAIN_LIMIT,
    max: 2 * GAIN_LIMIT,
    step: 0.1,
    format: formatGain,
    parse: parseNumber,
    apply: (start, decibels) => clamp(start + decibels, -GAIN_LIMIT, GAIN_LIMIT),
  },
};

export const qSpec: RangeSpec = {
  field: 'q',
  label: 'Q',
  fieldWidth: 64,
  min: Q_MIN,
  max: Q_MAX,
  scale: 'log',
  format: formatQ,
  parse: parseNumber,
  offset: {
    // log2 of the ratio: ×0.125 to ×8.
    min: -3,
    max: 3,
    step: 0.01,
    format: (octaves) => `×${(2 ** octaves).toFixed(2)}`,
    parse: (text) => {
      const ratio = parseNumber(text);
      return ratio !== null && ratio > 0 ? Math.log2(ratio) : null;
    },
    apply: (start, octaves) => clamp(start * 2 ** octaves, Q_MIN, Q_MAX),
  },
};
