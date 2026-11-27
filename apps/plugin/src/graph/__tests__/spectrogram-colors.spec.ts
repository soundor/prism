import { defaultTheme } from '@soundor/components/theme';
import { expect, test } from 'vitest';

import { hexToOklab, oklabToHex } from '../oklab';
import { heatMap } from '../spectrogram';

test('OKLab round-trips sRGB colours', () => {
  for (const hex of ['#000000', '#ffffff', '#10121a', '#8654b5', '#fff1fa'])
    expect(oklabToHex(hexToOklab(hex))).toBe(hex);
  expect(hexToOklab('#ffffff')[0]).toBeCloseTo(1, 4);
});

test('the spectrogram ramp starts at the graph, ends near white and only gets lighter', () => {
  const color = heatMap(defaultTheme);
  expect(color(0)).toBe(defaultTheme.color.display);
  expect(color(4 / 7)).toBe('#8654b5');
  expect(color(1)).toBe('#fff1fa');
  expect(color(-1)).toBe(color(0));

  const lightness = Array.from({ length: 128 }, (_, i) => hexToOklab(color(i / 127))[0]);
  for (let i = 1; i < lightness.length; i++)
    expect(lightness[i]!).toBeGreaterThanOrEqual(lightness[i - 1]! - 0.002);
});
