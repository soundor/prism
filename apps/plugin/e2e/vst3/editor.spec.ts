import { launchPlugin, rms, sine, type Vst3Plugin as Plugin } from '@soundor/vitest-e2e';
import { expect, test } from 'vitest';

// The editor and the audio together: the Debug build in Soundor's VST3 host,
// its native editor open and driven as a user in a DAW would. Build it first
// with `pnpm build:vst3:debug`; on Linux the editor needs a display
// (`xvfb-run`).

const open = () => launchPlugin({ sampleRate: 48_000, blockSize: 512 });

/** What the plugin does to a sine at `frequency`, in dB, once settled. */
async function gainAt(plugin: Plugin, frequency: number) {
  const input = sine(frequency, { seconds: 0.5, amplitude: 0.25 });
  const { outputs } = await plugin.host.process({ inputs: [[input, input]] });
  const settled = (samples: Float32Array) => samples.subarray(samples.length / 2);
  return 20 * Math.log10(rms(settled(outputs[0]![0]!)) / rms(settled(input)));
}

/** The accessible value text of the node with this role and name. */
async function valueText(plugin: Plugin, role: string, name: string) {
  const node = await plugin.getByRole(role, { name, exact: true }).getAccessibility();
  return (node.value as { text?: string } | undefined)?.text;
}

/** Types `value` into a value field (`adjustable` natively, `slider` on the web), as a double-click opens it. */
async function enter(plugin: Plugin, name: string, value: string) {
  const box = await plugin.getByRole('adjustable', { name, exact: true }).getBounds();
  await plugin.pointer.click(box.x + box.width / 2, box.y + box.height / 2, { clickCount: 2 });
  await plugin.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await plugin.keyboard.type(value);
  await plugin.keyboard.press('Enter');
}

test('the editor opens at its reference size, on the host’s track', async () => {
  const plugin = await open();
  const editor = await plugin.host.getEditor();
  expect([editor.width, editor.height]).toEqual([1200, 720]);
  await expect(plugin.getByRole('group', { name: 'Soundor VST3 Host, 48 kHz' })).toBeVisible();
});

test('a band added and boosted in the editor boosts the audio, and the meter shows it', async () => {
  const plugin = await open();
  await plugin.getByRole('button', { name: 'Add band', exact: true }).click();
  expect((await plugin.parameter('Band 1 active').get()).plain).toBe(1);
  expect(await gainAt(plugin, 1000)).toBeCloseTo(0, 1);

  await enter(plugin, 'Gain', '6');
  expect((await plugin.parameter('Band 1 gain').get()).plain).toBeCloseTo(6, 3);
  expect(await gainAt(plugin, 1000)).toBeCloseTo(6, 1);

  // A sine at 0.25, 6 dB up: about -6 dBFS.
  await expect.poll(() => valueText(plugin, 'progressbar', 'Output level, left')).toBe('−6.0 dB');
});

test('host automation shows in the editor', async () => {
  const plugin = await open();
  await plugin.parameter('Band 2 active').set({ plain: 1 });
  await plugin.parameter('Band 2 frequency').set({ plain: 250 });
  await plugin.parameter('Band 2 gain').set({ plain: -9 });
  await expect
    .poll(() => valueText(plugin, 'adjustable', 'Band 2, Bell'))
    .toBe('250 Hz, −9.0 dB, Q 0.707');
  await expect(plugin.getByText('1/24', { exact: true })).toBeVisible();
});

test('global bypass in the editor passes the audio through untouched', async () => {
  const plugin = await open();
  await plugin.parameter('Band 1 active').set({ plain: 1 });
  await plugin.parameter('Band 1 gain').set({ plain: 12 });
  expect(await gainAt(plugin, 1000)).toBeCloseTo(12, 1);

  await plugin.getByRole('togglebutton', { name: 'Global bypass', exact: true }).click();
  expect((await plugin.parameter('Bypass').get()).plain).toBe(1);
  await gainAt(plugin, 1000); // the crossfade
  const input = sine(1000, { seconds: 0.5, amplitude: 0.25 });
  const { outputs } = await plugin.host.process({ inputs: [[input, input]] });
  expect(outputs[0]![0]).toEqual(input);
});

test('a factory preset picked in the editor reaches the processor', async () => {
  const plugin = await open();
  await plugin.getByRole('button', { name: 'Previous preset', exact: true }).click();
  await expect(
    plugin.getByRole('button', { name: 'Preset menu: Rumble Cleanup', exact: true }),
  ).toBeVisible();
  expect((await plugin.parameter('Band 1 type').get()).display).toBe('Low cut');
  // An octave under its 48 dB/oct low cut at 40 Hz; the bell at 180 Hz
  // leaves 1 kHz alone.
  expect(await gainAt(plugin, 20)).toBeLessThan(-40);
  expect(Math.abs(await gainAt(plugin, 1000))).toBeLessThan(0.2);
});

test('undo and redo in the editor change what the processor does', async () => {
  const plugin = await open();
  await plugin.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(plugin, 'Gain', '6');
  expect(await gainAt(plugin, 1000)).toBeCloseTo(6, 1);

  await plugin.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await gainAt(plugin, 1000)).toBeCloseTo(0, 1);
  await plugin.getByRole('button', { name: 'Redo', exact: true }).click();
  expect(await gainAt(plugin, 1000)).toBeCloseTo(6, 1);
});

test('A and B in the editor each keep what they do to the audio', async () => {
  const plugin = await open();
  await plugin.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(plugin, 'Gain', '-9');
  expect(await gainAt(plugin, 1000)).toBeCloseTo(-9, 1);

  await plugin.getByRole('radio', { name: 'B', exact: true }).click();
  expect(await gainAt(plugin, 1000)).toBeCloseTo(0, 1);
  await plugin.getByRole('radio', { name: 'A', exact: true }).click();
  expect(await gainAt(plugin, 1000)).toBeCloseTo(-9, 1);
});

test('a saved session brings back the editor and the audio', async () => {
  const plugin = await open();
  await plugin.getByRole('button', { name: 'Add band', exact: true }).click();
  await enter(plugin, 'Gain', '4');
  await plugin.getByRole('radio', { name: 'Off', exact: true }).click();
  await plugin.getByRole('radio', { name: 'B', exact: true }).click();
  const state = await plugin.host.getState();

  await plugin.host.recreate();
  expect(Math.abs(await gainAt(plugin, 1000))).toBeLessThan(0.01);
  await plugin.host.setState(state);
  await plugin.openEditor();

  // B was showing: flat, with A kept behind it.
  await expect(plugin.getByRole('radio', { name: 'B', exact: true })).toBeChecked();
  expect(Math.abs(await gainAt(plugin, 1000))).toBeLessThan(0.01);
  await plugin.getByRole('radio', { name: 'A', exact: true }).click();
  expect(await gainAt(plugin, 1000)).toBeCloseTo(4, 1);
  await expect(plugin.getByText('1/24', { exact: true })).toBeVisible();
  // The view comes back too.
  await expect(plugin.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
});
