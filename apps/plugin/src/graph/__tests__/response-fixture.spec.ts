import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import { expect, test } from 'vitest';

import { filterTypes, slopes, type BandSettings } from '../../bands/catalog';
import { responseAt, SAMPLE_RATE } from '../response';

// The graph's curves, written out for the processor's tests
// (lib/tests/filter.rs), which hold the audio to them. Run with
// UPDATE_FIXTURE=1 to rewrite the file after changing the curve math.

const FIXTURE = fileURLToPath(
  new URL('../../../lib/tests/fixtures/filter_response.rs', import.meta.url),
);
const FREQUENCIES = Array.from({ length: 31 }, (_, i) => 10 * 3000 ** (i / 30));

type Case = Pick<BandSettings, 'type' | 'frequency' | 'gain' | 'q' | 'slope'>;

function cases(): Case[] {
  const list: Case[] = [];
  for (const { value: type } of filterTypes) {
    if (type === 'lowCut' || type === 'highCut') {
      for (const { value: slope } of slopes)
        for (const [frequency, q] of [
          [30, 0.707],
          [1000, 3],
          [12_000, 0.4],
        ] as const)
          list.push({ type, frequency, gain: 0, q, slope });
      continue;
    }
    for (const [frequency, gain, q] of [
      [10, 30, 0.025],
      [80, 6, 0.707],
      [1000, -18, 4],
      [6000, 12, 40],
      [18_000, -30, 1.2],
      [30_000, 9, 0.5],
    ] as const)
      list.push({ type, frequency, gain, q, slope: 'db12' });
  }
  return list;
}

const number = (value: number) => {
  const text = value.toPrecision(10);
  return /[.e]/.test(text) ? text : `${text}.0`;
};

function render() {
  const index = <T>(options: readonly { value: T }[], value: T) =>
    options.findIndex((option) => option.value === value);
  const body = cases()
    .map((c) => {
      const decibels = FREQUENCIES.map((f) => number(Math.max(responseAt(c, f)[0], -180)));
      return [
        '    Case {',
        `        filter_type: ${index(filterTypes, c.type)},`,
        `        frequency: ${number(c.frequency)},`,
        `        gain: ${number(c.gain)},`,
        `        q: ${number(c.q)},`,
        `        slope: ${index(slopes, c.slope)},`,
        `        decibels: &[${decibels.join(', ')}],`,
        '    },',
      ].join('\n');
    })
    .join('\n');
  return `// Written by src/graph/__tests__/response-fixture.spec.ts; do not edit.
// The graph's band responses, in dB, from src/graph/response.ts.
// @generated

pub struct Case {
    pub filter_type: u32,
    pub frequency: f64,
    pub gain: f64,
    pub q: f64,
    pub slope: u32,
    pub decibels: &'static [f64],
}

pub const SAMPLE_RATE: f64 = ${number(SAMPLE_RATE)};

pub const FREQUENCIES: &[f64] = &[${FREQUENCIES.map(number).join(', ')}];

pub const CASES: &[Case] = &[
${body}
];
`;
}

test('the processor tests hold the graph’s current curves', async () => {
  const text = render();
  if (process.env.UPDATE_FIXTURE) await writeFile(FIXTURE, text);
  expect(await readFile(FIXTURE, 'utf8')).toBe(text);
});
