import { act, render, screen, testHost } from '@soundor/testing-library/react';
import { expect, test } from 'vitest';

import { App } from '../app';
import { formatRate, shorten } from '../track-info';

test('shows the track the host reports, and the sample rate', async () => {
  await render(<App />);
  await act(() =>
    testHost.set({
      sampleRate: 48_000,
      hostName: 'Some DAW',
      track: { name: 'Lead Vox', index: 3, color: '#e0593cff' },
    }),
  );
  expect(screen.getByText('Lead Vox')).toBeTruthy();
  expect(screen.getByText('03')).toBeTruthy();
  expect(screen.getByText('48 kHz')).toBeTruthy();
  expect(screen.queryByText('Some DAW')).toBeNull();
  expect(screen.getByLabelText('Track 3: Lead Vox, 48 kHz')).toBeTruthy();
});

test('shows the host when it reports no track', async () => {
  await render(<App />);
  await act(() => testHost.set({ sampleRate: 44_100, hostName: 'Some DAW', track: undefined }));
  expect(screen.getByText('Some DAW')).toBeTruthy();
  expect(screen.getByText('44.1 kHz')).toBeTruthy();
});

test('formats sample rates', () => {
  expect(formatRate(44_100)).toBe('44.1 kHz');
  expect(formatRate(96_000)).toBe('96 kHz');
  expect(formatRate(88_200)).toBe('88.2 kHz');
});

test('cuts a long track name short', () => {
  expect(shorten('Lead Vox')).toBe('Lead Vox');
  expect(shorten('Lead Vox Double — Chorus Stack Left')).toBe('Lead Vox Double — Choru…');
});
