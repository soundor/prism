import { launchHost, rms, sine, type Vst3Host } from '@soundor/vitest-e2e';
import { expect, test } from 'vitest';

// The Release build, loaded in Soundor's headless host: the processor as a
// DAW runs it, through the VST3 adapter. Build it first with `pnpm build:vst3`.
const RELEASE = '.soundor/dist/vst3/Soundor Prism.vst3';

const launch = () => launchHost({ plugin: RELEASE, sampleRate: 48_000, blockSize: 512 });

const tone = (frequency: number, seconds = 1) => sine(frequency, { seconds, amplitude: 0.25 });

/** The level of `output` against `input`, in dB, over their second half. */
function gain(input: Float32Array, output: Float32Array) {
  const settled = (samples: Float32Array) => samples.subarray(samples.length / 2);
  return 20 * Math.log10(rms(settled(output)) / rms(settled(input)));
}

async function process(vst3: Vst3Host, input: Float32Array) {
  const { outputs } = await vst3.process({ inputs: [[input, input]] });
  return outputs[0]!;
}

test('a new instance passes audio through unchanged', async () => {
  const vst3 = await launch();
  const input = tone(440, 0.1);
  const [left, right] = await process(vst3, input);
  expect(left).toEqual(input);
  expect(right).toEqual(input);
});

test('a band filters as its parameters say, and bypass passes the audio through', async () => {
  const vst3 = await launch();
  await vst3.parameter('Band 1 active').set({ plain: 1 });
  await vst3.parameter('Band 1 frequency').set({ plain: 1000 });
  await vst3.parameter('Band 1 gain').set({ plain: 12 });
  const input = tone(1000);
  const [left, right] = await process(vst3, input);
  expect(gain(input, left!)).toBeCloseTo(12, 1);
  expect(gain(input, right!)).toBeCloseTo(12, 1);
  // Far below the bell, only its skirt is left.
  const low = tone(50);
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
  const input = tone(100);
  const [left] = await process(vst3, input);
  // Two octaves under a 48 dB/oct cut.
  expect(gain(input, left!)).toBeLessThan(-80);
});
