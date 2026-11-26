import {
  render,
  screen,
  testParameters,
  userEvent,
  waitFor,
  type NodeTarget,
} from '@soundor/testing-library/react';
import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { App } from '../../app/app';
import { clearSelection, selectedSlots, setSelection } from '../../bands/selection';

beforeEach(() => clearSelection());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function addBand(slot: number, settings: Record<string, number | boolean | string> = {}) {
  testParameters.set(`band${slot}Active`, true);
  for (const [field, value] of Object.entries(settings)) {
    testParameters.set(`band${slot}${field[0]!.toUpperCase()}${field.slice(1)}`, value);
  }
}

/**
 * The simulated runtime has no layout, and the Plot measures itself on
 * every pointer move: every node is measured at the origin, so pointer
 * coordinates are the Plot's own.
 */
function stubLayout() {
  const node = screen.getByLabelText('Equalizer response and bands');
  vi.spyOn(Object.getPrototypeOf(node), 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
}

/** The Plot's background, where a press, a double-click or a drag lands off the markers. */
const background = () => screen.getByLabelText('Equalizer response and bands').nextSibling!;

const marker = (name: string) =>
  screen.getAllByLabelText(name).find((node) => node.accessibility.role !== 'option')!;

async function drag(node: NodeTarget, dx: number, dy: number) {
  const user = userEvent.setup();
  await user.pointer({ target: node, keys: '[MouseLeft>]', clientX: 100, clientY: 100 });
  await user.pointer({ target: node, clientX: 100 + dx / 2, clientY: 100 + dy / 2 });
  await user.pointer({ target: node, clientX: 100 + dx, clientY: 100 + dy });
  await user.pointer({ target: node, keys: '[/MouseLeft]', clientX: 100 + dx, clientY: 100 + dy });
}

test('a marker drag sets frequency and gain, as one undo step, and selects the band', async () => {
  await render(<App />);
  stubLayout();
  addBand(1, { type: 'bell', frequency: 1000, gain: 0 });

  await drag(await waitFor(() => marker('Band 1, Bell')), 80, -60);
  await waitFor(() => expect(parameters.band1Frequency.get()).toBeGreaterThan(1000));
  expect(parameters.band1Gain.get()).toBeGreaterThan(0);
  expect(selectedSlots()).toEqual([1]);
  expect(history.undoLabel()).toBe('Move band');

  history.undo();
  await waitFor(() => expect(parameters.band1Frequency.get()).toBeCloseTo(1000));
  expect(parameters.band1Gain.get()).toBe(0);
});

test('a drag of a selected marker moves the whole selection by the same amount', async () => {
  await render(<App />);
  stubLayout();
  addBand(1, { type: 'bell', frequency: 200, gain: -3 });
  addBand(2, { type: 'notch', frequency: 2000 });
  addBand(3, { type: 'bell', frequency: 5000, gain: 2 });
  setSelection([1, 2]);

  await drag(await waitFor(() => marker('Band 1, Bell')), 60, -40);
  await waitFor(() => expect(parameters.band1Frequency.get()).toBeGreaterThan(200));
  const ratio = parameters.band2Frequency.get() / 2000;
  expect(parameters.band1Frequency.get() / 200).toBeCloseTo(ratio, 3);
  expect(parameters.band1Gain.get()).toBeGreaterThan(-3);
  // A notch has no gain, and band 3 is not selected.
  expect(parameters.band2Gain.get()).toBe(0);
  expect(parameters.band3Frequency.get()).toBe(5000);
  expect(selectedSlots()).toEqual([1, 2]);

  expect(history.undoLabel()).toBe('Move bands');
  history.undo();
  await waitFor(() => expect(parameters.band1Frequency.get()).toBeCloseTo(200));
  expect(parameters.band2Frequency.get()).toBeCloseTo(2000);
});

test('the wheel sets Q, and a turn of it is one undo step', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
  await render(<App />);
  stubLayout();
  addBand(1, { type: 'bell', q: 1 });
  addBand(2, { type: 'lowCut', slope: 'db6', q: 1 });

  const bell = await waitFor(() => marker('Band 1, Bell'));
  await user.wheel(bell, { deltaY: -100 });
  await user.wheel(bell, { deltaY: -100 });
  await waitFor(() => expect(parameters.band1Q.get()).toBeCloseTo(1.12 ** 2, 2));
  await vi.advanceTimersByTimeAsync(500);
  expect(history.undoLabel()).toBe('Change Q');
  history.undo();
  await waitFor(() => expect(parameters.band1Q.get()).toBeCloseTo(1));

  // A 6 dB/oct cut has no Q.
  await user.wheel(marker('Band 2, Low cut'), { deltaY: -100 });
  expect(parameters.band2Q.get()).toBe(1);
});

test('a double-click on a marker puts its gain back to 0 dB', async () => {
  const user = userEvent.setup();
  await render(<App />);
  stubLayout();
  addBand(1, { type: 'lowShelf', gain: 4.5 });

  await user.dblClick(await waitFor(() => marker('Band 1, Low shelf')));
  await waitFor(() => expect(parameters.band1Gain.get()).toBe(0));
  expect(history.undoLabel()).toBe('Reset gain');
});

test('a double-click on the graph adds a band at the pointer, a cut near either end', async () => {
  const user = userEvent.setup();
  await render(<App />);
  stubLayout();
  expect(screen.getByText('Double-click anywhere on the graph to add a band')).toBeDefined();

  // Left of the plot's 20 Hz line, then in the middle, up from 0 dB.
  await user.pointer({ target: background(), keys: '[MouseLeft]', clientX: 70, clientY: 200 });
  await user.pointer({
    target: background(),
    keys: '[MouseLeft]',
    clientX: 70,
    clientY: 200,
    detail: 2,
  });
  await waitFor(() => expect(parameters.band1Active.get()).toBe(true));
  expect(parameters.band1Type.get()).toBe('lowCut');
  expect(parameters.band1Frequency.get()).toBeLessThan(30);

  await user.pointer({ target: background(), keys: '[MouseLeft]', clientX: 540, clientY: 150 });
  await user.pointer({
    target: background(),
    keys: '[MouseLeft]',
    clientX: 540,
    clientY: 150,
    detail: 2,
  });
  await waitFor(() => expect(parameters.band2Active.get()).toBe(true));
  expect(parameters.band2Type.get()).toBe('bell');
  expect(parameters.band2Gain.get()).toBeGreaterThan(0);
  expect(selectedSlots()).toEqual([2]);
  expect(screen.queryByText('Double-click anywhere on the graph to add a band')).toBeNull();
});

test('Delete removes the selection when its marker is in it, else that band; Escape clears', async () => {
  const user = userEvent.setup();
  await render(<App />);
  stubLayout();
  addBand(1);
  addBand(2);
  addBand(3);
  setSelection([1, 2]);

  const third = await waitFor(() => marker('Band 3, Bell'));
  third.focus();
  await user.keyboard('{Delete}');
  await waitFor(() => expect(parameters.band3Active.get()).toBe(false));
  expect(parameters.band1Active.get()).toBe(true);

  marker('Band 1, Bell').focus();
  await user.keyboard('{Delete}');
  await waitFor(() => expect(parameters.band1Active.get()).toBe(false));
  expect(parameters.band2Active.get()).toBe(false);

  addBand(4);
  setSelection([4]);
  marker('Band 4, Bell').focus();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(selectedSlots()).toEqual([]));
});

test('a hovered marker shows its settings only while Alt is held', async () => {
  const user = userEvent.setup();
  await render(<App />);
  stubLayout();
  addBand(1, { type: 'bell', frequency: 3100, gain: 2.6, q: 0.9 });
  // The tooltip is decorative: the marker's value says the same to
  // assistive technology.
  const tooltip = () => screen.queryByText('1 · Bell 3.10 kHz +2.6 dB Q 0.900', { hidden: true });

  const bell = await waitFor(() => marker('Band 1, Bell'));
  await user.pointer({ target: bell, clientX: 400, clientY: 200 });
  expect(tooltip()).toBeNull();

  await user.pointer({ target: bell, clientX: 401, clientY: 200, altKey: true });
  await waitFor(() => expect(tooltip()).not.toBeNull());
  await user.pointer({ target: bell, clientX: 402, clientY: 200 });
  await waitFor(() => expect(tooltip()).toBeNull());
});

test('the cursor readout shows only while Alt is held', async () => {
  const user = userEvent.setup();
  await render(<App />);
  stubLayout();
  const readout = () => screen.queryByText(/Hz .+ dB$/, { hidden: true });

  await user.pointer({ target: background(), clientX: 400, clientY: 200 });
  expect(readout()).toBeNull();
  await user.pointer({ target: background(), clientX: 401, clientY: 200, altKey: true });
  await waitFor(() => expect(readout()).not.toBeNull());
  await user.pointer({ target: background(), clientX: 402, clientY: 200 });
  await waitFor(() => expect(readout()).toBeNull());
});
