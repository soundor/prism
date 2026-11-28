import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { launch, type Vst3Plugin } from '@soundor/driver/vst3';
import { afterEach, beforeAll, expect, test } from 'vitest';

// The editor and the audio together: a Debug build of the VST3 in Soundor's
// headless host, its native editor open and driven through DevTools, as a
// user in a DAW would. Build it first with `pnpm build:vst3:debug`; on Linux
// the editor needs a display (`xvfb-run`).
const PLUGIN = fileURLToPath(new URL('../../.soundor/debug/Soundor Prism.vst3', import.meta.url));
const RATE = 48_000;

beforeAll(() => {
  if (!existsSync(PLUGIN)) {
    throw new Error(`No Debug VST3 at ${PLUGIN}: run pnpm build:vst3:debug first`);
  }
});

let plugin: Vst3Plugin | undefined;
afterEach(async () => {
  await plugin?.close();
  plugin = undefined;
});

async function open() {
  plugin = await launch({ plugin: PLUGIN, sampleRate: RATE, blockSize: 512 });
  return plugin;
}

function sine(frequency: number, frames = RATE / 2) {
  return Float32Array.from(
    { length: frames },
    (_, i) => Math.sin((2 * Math.PI * frequency * i) / RATE) * 0.25,
  );
}

/** What the plugin does to a sine at `frequency`, in dB, once settled. */
async function gainAt(vst3: Vst3Plugin, frequency: number) {
  const input = sine(frequency);
  const { outputs } = await vst3.host.process({ inputs: [[input, input]] });
  const rms = (samples: Float32Array) => {
    const half = samples.subarray(samples.length / 2);
    return Math.sqrt(half.reduce((sum, s) => sum + s * s, 0) / half.length);
  };
  return 20 * Math.log10(rms(outputs[0]![0]!) / rms(input));
}

/** Waits until `read` gives what `check` accepts, as the editor catches up. */
async function until<T>(read: () => Promise<T>, check: (value: T) => boolean, timeout = 5000) {
  const end = Date.now() + timeout;
  let value = await read();
  while (!check(value) && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    value = await read();
  }
  return value;
}

/** The accessible value text of the node with this role and name. */
async function valueText(vst3: Vst3Plugin, role: string, name: string) {
  const node = await vst3.getByRole(role, { name, exact: true }).getAccessibility();
  return (node.value as { text?: string } | undefined)?.text;
}

/** Types `value` into a value field (`adjustable` natively, `slider` on the web), as a double-click opens it. */
async function enter(vst3: Vst3Plugin, name: string, value: string) {
  const box = await vst3.getByRole('adjustable', { name, exact: true }).getBounds();
  await vst3.pointer.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
  await vst3.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await vst3.keyboard.type(value);
  await vst3.keyboard.press('Enter');
}

async function isChecked(vst3: Vst3Plugin, role: string, name: string) {
  const node = await vst3.getByRole(role, { name, exact: true }).getAccessibility();
  // Natively, states come as text: 'true', 'false' or 'mixed'.
  return String((node.states as { checked?: unknown } | undefined)?.checked) === 'true';
}

test('the editor opens at its reference size, on the host’s track', async () => {
  const vst3 = await open();
  const editor = await vst3.host.getEditor();
  expect([editor.width, editor.height]).toEqual([1200, 720]);
  await vst3.getByRole('group', { name: 'Soundor VST3 Host, 48 kHz' }).waitFor();
});

test('a band added and boosted in the editor boosts the audio, and the meter shows it', async () => {
  const vst3 = await open();
  await vst3.getByRole('button', { name: 'Add band', exact: true }).click();
  expect((await vst3.parameter('Band 1 active').get()).plain).toBe(1);
  expect(await gainAt(vst3, 1000)).toBeCloseTo(0, 1);

  await enter(vst3, 'Gain', '6');
  expect((await vst3.parameter('Band 1 gain').get()).plain).toBeCloseTo(6, 3);
  expect(await gainAt(vst3, 1000)).toBeCloseTo(6, 1);

  // A sine at 0.25, 6 dB up: about -6 dBFS.
  const meter = () => valueText(vst3, 'progressbar', 'Output level, left');
  expect(await until(meter, (text) => text === '−6.0 dB')).toBe('−6.0 dB');
});

test('host automation shows in the editor', async () => {
  const vst3 = await open();
  await vst3.parameter('Band 2 active').set({ plain: 1 });
  await vst3.parameter('Band 2 frequency').set({ plain: 250 });
  await vst3.parameter('Band 2 gain').set({ plain: -9 });
  const marker = () => valueText(vst3, 'adjustable', 'Band 2, Bell');
  const expected = '250 Hz, −9.0 dB, Q 0.707';
  expect(await until(marker, (text) => text === expected)).toBe(expected);
  await vst3.getByText('1/24', { exact: true }).waitFor();
});

test('global bypass in the editor passes the audio through untouched', async () => {
  const vst3 = await open();
  await vst3.parameter('Band 1 active').set({ plain: 1 });
  await vst3.parameter('Band 1 gain').set({ plain: 12 });
  expect(await gainAt(vst3, 1000)).toBeCloseTo(12, 1);

  await vst3.getByRole('togglebutton', { name: 'Global bypass', exact: true }).click();
  expect((await vst3.parameter('Bypass').get()).plain).toBe(1);
  await gainAt(vst3, 1000); // the crossfade
  const input = sine(1000);
  const { outputs } = await vst3.host.process({ inputs: [[input, input]] });
  expect(outputs[0]![0]).toEqual(input);
});

test('a factory preset picked in the editor reaches the processor', async () => {
  const vst3 = await open();
  await vst3.getByRole('button', { name: 'Previous preset', exact: true }).click();
  await vst3.getByRole('button', { name: 'Preset menu: Rumble Cleanup', exact: true }).waitFor();
  expect((await vst3.parameter('Band 1 type').get()).display).toBe('Low cut');
  // An octave under its 48 dB/oct low cut at 40 Hz; the bell at 180 Hz
  // leaves 1 kHz alone.
  expect(await gainAt(vst3, 20)).toBeLessThan(-40);
  expect(Math.abs(await gainAt(vst3, 1000))).toBeLessThan(0.2);
});

test('undo and redo in the editor change what the processor does', async () => {
  const vst3 = await open();
  await vst3.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(vst3, 'Gain', '6');
  expect(await gainAt(vst3, 1000)).toBeCloseTo(6, 1);

  await vst3.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await gainAt(vst3, 1000)).toBeCloseTo(0, 1);
  await vst3.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await gainAt(vst3, 1000)).toBeCloseTo(6, 1);
});

test('A and B in the editor each keep what they do to the audio', async () => {
  const vst3 = await open();
  await vst3.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(vst3, 'Gain', '-9');
  expect(await gainAt(vst3, 1000)).toBeCloseTo(-9, 1);

  await vst3.getByRole('radio', { name: 'B', exact: true }).click();
  expect(await gainAt(vst3, 1000)).toBeCloseTo(0, 1);
  await vst3.getByRole('radio', { name: 'A', exact: true }).click();
  expect(await gainAt(vst3, 1000)).toBeCloseTo(-9, 1);
});

test('a saved session brings back the editor and the audio', async () => {
  const vst3 = await open();
  await vst3.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(vst3, 'Gain', '4');
  await vst3.getByRole('radio', { name: 'Off', exact: true }).click();
  await vst3.getByRole('radio', { name: 'B', exact: true }).click();
  const state = await vst3.host.getState();

  await vst3.host.recreate();
  expect(Math.abs(await gainAt(vst3, 1000))).toBeLessThan(0.01);
  await vst3.host.setState(state);
  await vst3.openEditor();

  // B was showing: flat, with A kept behind it.
  expect(await isChecked(vst3, 'radio', 'B')).toBe(true);
  expect(Math.abs(await gainAt(vst3, 1000))).toBeLessThan(0.01);
  await vst3.getByRole('radio', { name: 'A', exact: true }).click();
  expect(await gainAt(vst3, 1000)).toBeCloseTo(4, 1);
  await vst3.getByText('1/24', { exact: true }).waitFor();
  // The view comes back too.
  expect(await isChecked(vst3, 'radio', 'Off')).toBe(true);
});
