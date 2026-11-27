import { act, publishStream, render, screen } from '@soundor/testing-library/react';
import { expect, test } from 'vitest';

import { App } from '../../app/app';

const peakText = () => screen.queryByText(/^[+−]\d+\.\d$/);

test('shows the output level the processor measures', async () => {
  await render(<App />);
  // Nothing measured yet: the meter rests at its floor.
  expect(peakText()?.text).toBe('−60.0');

  await act(() => publishStream('outputLevels', new Float32Array([-14.25, -3.5])));
  expect(peakText()?.text).toBe('−3.5');

  await act(() => publishStream('outputLevels', new Float32Array([0.4, -120])));
  expect(peakText()?.text).toBe('+0.4');
});
