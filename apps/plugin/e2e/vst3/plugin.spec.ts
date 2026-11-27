import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { launchHost, type Vst3Host } from '@soundor/vst3-host';
import { afterEach, beforeAll, expect, test } from 'vitest';

// The built VST3, loaded in Soundor's headless host: the processor as a DAW
// runs it, through the VST3 adapter. Build it first with `pnpm build:vst3`.
const PLUGIN = fileURLToPath(
  new URL('../../.soundor/dist/vst3/Soundor Prism.vst3', import.meta.url),
);
const RATE = 48_000;

beforeAll(() => {
  if (!existsSync(PLUGIN)) throw new Error(`No VST3 at ${PLUGIN}: run pnpm build:vst3 first`);
});

let host: Vst3Host | undefined;
afterEach(async () => {
  await host?.close();
  host = undefined;
});

async function launch() {
  host = await launchHost({ plugin: PLUGIN, sampleRate: RATE, blockSize: 512 });
  return host;
}

function sine(frequency: number, frames = RATE) {
  return Float32Array.from(
    { length: frames },
    (_, i) => Math.sin((2 * Math.PI * frequency * i) / RATE) * 0.25,
  );
}

/** The level of `output` against `input`, in dB, over their second half. */
function gain(input: Float32Array, output: Float32Array) {
  const rms = (samples: Float32Array) => {
    const half = samples.subarray(samples.length / 2);
    return Math.sqrt(half.reduce((sum, s) => sum + s * s, 0) / half.length);
  };
  return 20 * Math.log10(rms(output) / rms(input));
}

async function process(vst3: Vst3Host, input: Float32Array) {
  const { outputs } = await vst3.process({ inputs: [[input, input]] });
  return outputs[0]!;
}

test('a new instance passes audio through unchanged', async () => {
  const vst3 = await launch();
  const input = sine(440, 4800);
  const [left, right] = await process(vst3, input);
  expect(left).toEqual(input);
  expect(right).toEqual(input);
});

test('a band filters as its parameters say, and bypass passes the audio through', async () => {
  const vst3 = await launch();
  await vst3.parameter('Band 1 active').set({ plain: 1 });
  await vst3.parameter('Band 1 frequency').set({ plain: 1000 });
  await vst3.parameter('Band 1 gain').set({ plain: 12 });
  const input = sine(1000);
  const [left, right] = await process(vst3, input);
  expect(gain(input, left!)).toBeCloseTo(12, 1);
  expect(gain(input, right!)).toBeCloseTo(12, 1);
  // Far below the bell, only its skirt is left.
  const low = sine(50);
  expect(Math.abs(gain(low, (await process(vst3, low))[0]!))).toBeLessThan(0.1);

  await vst3.parameter('Bypass').set({ plain: 1 });
  await process(vst3, input); // the 10 ms crossfade
  const bypassed = await process(vst3, input);
  expect(bypassed[0]).toEqual(input);
});

test('a saved state brings the bands back', async () => {
  const vst3 = await launch();
  await vst3.parameter('Band 4 active').set({ plain: 1 });
  await vst3.parameter('Band 4 type').set({ plain: 3 }); // low cut
  await vst3.parameter('Band 4 slope').set({ plain: 4 }); // 48 dB/oct
  await vst3.parameter('Band 4 frequency').set({ plain: 400 });
  const state = await vst3.getState();
  await vst3.recreate();
  await vst3.setState(state);
  const input = sine(100);
  const [left] = await process(vst3, input);
  // Two octaves under a 48 dB/oct cut.
  expect(gain(input, left!)).toBeLessThan(-80);
});
