import { render, screen, testParameters, userEvent, waitFor } from '@soundor/testing-library/react';
import { state } from 'soundor:state';
import { expect, test } from 'vitest';

import { App } from '../../app/app';
import { setSelection } from '../../bands/selection';

/** The footer's toggle; the spectrogram itself has the same label. */
const toggle = (name: string) =>
  screen.getAllByLabelText(name).find((node) => node.accessibility.role === 'togglebutton')!;
const spectrogram = () =>
  screen.queryAllByLabelText('Spectrogram').find((node) => node.accessibility.role === 'image');

test('Display switches the graph to the phase response and back', async () => {
  const user = userEvent.setup();
  await render(<App />);
  expect(screen.getByText('dB')).toBeDefined();
  expect(screen.queryByText('PHASE RESPONSE')).toBeNull();

  await user.click(screen.getByRole('radio', { name: 'Phase' }));
  await waitFor(() => expect(state.displayMode.get()).toBe('phase'));
  expect(screen.getByText('DEG')).toBeDefined();
  expect(screen.getByText('PHASE RESPONSE')).toBeDefined();
  expect(screen.queryByText('dB')).toBeNull();

  await user.click(screen.getByRole('radio', { name: 'Magnitude' }));
  await waitFor(() => expect(screen.queryByText('PHASE RESPONSE')).toBeNull());
  expect(screen.getByText('dB')).toBeDefined();
});

test('the legend names the EQ curve once there is one, and the phase curve in that view', async () => {
  const user = userEvent.setup();
  await render(<App />);
  expect(screen.queryByText('EQ curve')).toBeNull();

  testParameters.set('band1Active', true);
  await screen.findByText('EQ curve');
  // Display's radios say Phase and Magnitude too; the legend adds one of each.
  const phaseTexts = screen.getAllByText('Phase').length;
  await user.click(screen.getByRole('radio', { name: 'Phase' }));
  await waitFor(() => expect(screen.queryByText('EQ curve')).toBeNull());
  expect(screen.getAllByText('Phase')).toHaveLength(phaseTexts + 1);
});

test('the spectrogram replaces the spectrum while it is on', async () => {
  const user = userEvent.setup();
  await render(<App />);
  expect(screen.getByText('Pre EQ')).toBeDefined();
  expect(spectrogram()).toBeUndefined();

  await user.click(toggle('Spectrogram'));
  await waitFor(() => expect(spectrogram()).toBeDefined());
  expect(state.showSpectrogram.get()).toBe(true);
  expect(toggle('Spectrogram').accessibility.state?.checked).toBe(true);
  expect(screen.queryByText('Pre EQ')).toBeNull();

  await user.click(toggle('Spectrogram'));
  await waitFor(() => expect(spectrogram()).toBeUndefined());
  expect(screen.getByText('Pre EQ')).toBeDefined();
});

test('the pitch keyboard runs along the frequency axis', async () => {
  const user = userEvent.setup();
  await render(<App />);
  testParameters.set('band1Active', true);
  setSelection([1]);
  expect(screen.queryByLabelText('Musical pitch keyboard')).toBeNull();

  await user.click(toggle('Pitch keyboard'));
  await waitFor(() => expect(screen.queryByLabelText('Musical pitch keyboard')).not.toBeNull());
  expect(state.showKeyboard.get()).toBe(true);
});
