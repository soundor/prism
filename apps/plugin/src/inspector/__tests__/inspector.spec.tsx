import {
  fireEvent,
  render,
  screen,
  testParameters,
  userEvent,
  waitFor,
} from '@soundor/testing-library/react';
import { history } from 'soundor:history';
import { parameters } from 'soundor:parameters';
import { beforeEach, expect, test } from 'vitest';

import { App } from '../../app/app';
import { clearSelection } from '../../bands/selection';

// The selection is editor state shared by the whole module, not per render.
beforeEach(() => clearSelection());

function addBand(slot: number, settings: Record<string, number | boolean | string> = {}) {
  testParameters.set(`band${slot}Active`, true);
  for (const [field, value] of Object.entries(settings)) {
    testParameters.set(`band${slot}${field[0]!.toUpperCase()}${field.slice(1)}`, value);
  }
}

const chip = (slot: number) => screen.getByRole('option', { name: new RegExp(`^Band ${slot},`) });
// Chips select as files do: Ctrl adds or removes one (Cmd on macOS; the tests
// run as Linux), Shift selects a range.
const ctrlClick = (slot: number) => fireEvent.click(chip(slot), { ctrlKey: true });
const shiftClick = (slot: number) => fireEvent.click(chip(slot), { shiftKey: true });
const valueText = (label: string) => screen.getByLabelText(label).accessibility.value?.text;

test('asks for a band, and Add puts one in the first free slot and selects it', async () => {
  const user = userEvent.setup();
  await render(<App />);
  expect(screen.getByText('Add a band to start')).toBeDefined();
  expect(screen.getByText('0/24')).toBeDefined();

  addBand(1);
  await screen.findByText('Select a band to edit it');

  await user.click(screen.getByLabelText('Add band'));
  await screen.findByText('Band 2');
  expect(screen.getByText('2/24')).toBeDefined();
  expect(parameters.band2Active.get()).toBe(true);
  expect(chip(2).accessibility.state?.selected).toBe(true);
  expect(valueText('Frequency')).toBe('1.00 kHz');
});

test('a chip press selects its band alone, Ctrl adds or removes one, Shift a range', async () => {
  const user = userEvent.setup();
  await render(<App />);
  addBand(2, { type: 'bell' });
  addBand(3, { type: 'bell' });
  addBand(5, { type: 'highShelf' });

  await user.click(await screen.findByRole('option', { name: /^Band 3,/ }));
  await screen.findByText('Band 3');
  ctrlClick(5);
  await screen.findByText('2 selected');
  expect(screen.getByText('Bands 3, 5')).toBeDefined();
  ctrlClick(3);
  await screen.findByText('Band 5');
  await user.click(chip(2));
  await screen.findByText('Band 2');
  shiftClick(5);
  await screen.findByText('3 selected');
  expect(screen.getByText('Bands 2, 3, 5')).toBeDefined();
  await user.click(chip(3));
  await screen.findByText('Band 3');
  ctrlClick(3);
  await screen.findByText('Select a band to edit it');
});

test('says which settings the type does not use', async () => {
  const user = userEvent.setup();
  await render(<App />);
  addBand(1, { type: 'notch' });
  addBand(2, { type: 'lowCut', slope: 'db6' });

  await user.click(await screen.findByRole('option', { name: /^Band 1,/ }));
  await screen.findByText('Not used by notch');
  expect(screen.getByText('Cut filters only')).toBeDefined();
  expect(valueText('Q')).toBe('0.707');

  await user.click(chip(2));
  await screen.findByText('Not used at 6 dB/oct');
  expect(screen.getByText('Not used by low cut')).toBeDefined();
  expect(screen.getByRole('radiogroup', { name: 'Slope' })).toBeDefined();
});

test('shows values the selected bands share, and Mixed for the others', async () => {
  const user = userEvent.setup();
  await render(<App />);
  addBand(1, { type: 'bell', gain: 3, frequency: 200 });
  addBand(2, { type: 'lowShelf', gain: 3, frequency: 800, channel: 'mid' });

  await user.click(await screen.findByRole('option', { name: /^Band 1,/ }));
  ctrlClick(2);
  await screen.findByText('2 selected');
  expect(valueText('Gain')).toBe('+3.0 dB');
  expect(valueText('Frequency offset')).toBe('Mixed');
  expect(screen.getByLabelText('Filter type').accessibility.value?.text).toBe('Mixed');
});

test('moves several bands by one offset, as one undo step', async () => {
  const user = userEvent.setup();
  await render(<App />);
  addBand(1, { gain: -2 });
  addBand(2, { gain: 4 });

  await user.click(await screen.findByRole('option', { name: /^Band 1,/ }));
  ctrlClick(2);
  await user.accessibilityAction(await screen.findByLabelText('Gain offset'), 'setValue', 3);
  await waitFor(() => expect(parameters.band2Gain.get()).toBeCloseTo(7));
  expect(parameters.band1Gain.get()).toBeCloseTo(1);

  history.undo();
  await waitFor(() => expect(parameters.band1Gain.get()).toBeCloseTo(-2));
  expect(parameters.band2Gain.get()).toBeCloseTo(4);
});

test('turns bands on and off together, solos one band, and deletes the selection', async () => {
  const user = userEvent.setup();
  await render(<App />);
  addBand(1);
  addBand(2, { enabled: false, solo: true });
  addBand(3);

  await user.click(await screen.findByRole('option', { name: /^Band 1,/ }));
  ctrlClick(2);
  const on = screen.getByLabelText('Bands on');
  expect(on.accessibility.state?.checked).toBe('mixed');
  await user.click(on);
  await waitFor(() => expect(parameters.band2Enabled.get()).toBe(true));
  expect(screen.getByLabelText('Solo band').accessibility.state?.disabled).toBe(true);

  ctrlClick(2);
  await screen.findByText('Band 1');
  await user.click(screen.getByLabelText('Solo band'));
  await waitFor(() => expect(parameters.band1Solo.get()).toBe(true));
  expect(parameters.band2Solo.get()).toBe(false);

  ctrlClick(3);
  await user.click(await screen.findByLabelText('Delete 2 bands'));
  await waitFor(() => expect(parameters.band1Active.get()).toBe(false));
  expect(parameters.band3Active.get()).toBe(false);
  expect(parameters.band1Solo.get()).toBe(false);
  await screen.findByText('Select a band to edit it');
});
