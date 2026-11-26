import { render, screen, testParameters, waitFor } from '@soundor/testing-library/react';
import { presets } from 'soundor:presets';
import { state } from 'soundor:state';
import { expect, test } from 'vitest';

import { App } from '../../app/app';

// The band strip's chips have the same labels: markers are the ones that are not options.
const markers = () =>
  screen.queryAllByLabelText(/^Band \d+, /).filter((node) => node.accessibility.role !== 'option');
const markerText = (name: string) =>
  markers().find((node) => node.accessibility.label === name)?.accessibility.value?.text;

test('draws a marker for each active slot only', async () => {
  await render(<App />);
  expect(markers()).toHaveLength(0);

  testParameters.set('band3Active', true);
  testParameters.set('band3Type', 'highShelf');
  testParameters.set('band3Frequency', 11_500);
  testParameters.set('band3Gain', 3.4);
  testParameters.set('band3Q', 0.7);
  await waitFor(() => expect(markers()).toHaveLength(1));
  expect(markerText('Band 3, High shelf')).toBe('11.5 kHz, +3.4 dB, Q 0.700');

  testParameters.set('band3Active', false);
  await waitFor(() => expect(markers()).toHaveLength(0));
});

test('follows a factory preset', async () => {
  await render(<App />);
  presets.factory.load('vocal-presence');
  await waitFor(() => expect(markers()).toHaveLength(5));
  expect(markers().map((node) => node.accessibility.label)).toEqual([
    'Band 1, Low cut',
    'Band 2, Bell',
    'Band 3, Bell',
    'Band 4, Notch',
    'Band 5, High shelf',
  ]);
  expect(markerText('Band 4, Notch')).toBe('6.40 kHz, Q 6.00, Mid');
});

test('shows what a type uses, and when a band is off or soloed', async () => {
  await render(<App />);
  testParameters.set('band1Active', true);
  testParameters.set('band1Type', 'lowCut');
  testParameters.set('band1Frequency', 40);
  testParameters.set('band1Gain', 6);
  testParameters.set('band1Slope', 'db6');
  testParameters.set('band1Enabled', false);
  testParameters.set('band2Active', true);
  testParameters.set('band2Solo', true);
  await waitFor(() => expect(markers()).toHaveLength(2));
  expect(markerText('Band 1, Low cut')).toBe('40.0 Hz, 6 dB/oct, bypassed');
  expect(markerText('Band 2, Bell')).toBe('1.00 kHz, 0.0 dB, Q 0.707, solo');
});

test('labels the analyzer axis only while an analyzer is shown', async () => {
  await render(<App />);
  expect(screen.getByText('dB')).toBeDefined();
  expect(screen.getByText('Hz')).toBeDefined();
  expect(screen.queryByText('dBFS')).not.toBeNull();

  state.analyzerMode.set('off');
  await waitFor(() => expect(screen.queryByText('dBFS')).toBeNull());
  state.showSpectrogram.set(true);
  await waitFor(() => expect(screen.queryByText('dBFS')).not.toBeNull());
});
