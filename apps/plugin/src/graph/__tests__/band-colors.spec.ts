import { defaultTheme } from '@soundor/components/theme';
import { expect, test } from 'vitest';

import {
  bandColor,
  bandColorOnLight,
  bandForeground,
  bandPalette,
  contrastRatio,
  GRAPHIC_CONTRAST,
} from '../band-colors';

const theme = defaultTheme;

test('contrast ratios follow WCAG 2', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  expect(contrastRatio('#777777', '#777777')).toBe(1);
  expect(contrastRatio('#ffffff', '#000000')).toBe(contrastRatio('#000000', '#ffffff'));
});

test('twelve distinct colours, so 24 bands repeat each once', () => {
  const palette = bandPalette(theme);
  expect(new Set(palette).size).toBe(12);
  expect(bandColor(theme, 13)).toBe(bandColor(theme, 1));
  expect(bandColor(theme, 24)).toBe(bandColor(theme, 12));
});

test('every band number reads at AAA contrast on its face', () => {
  for (let slot = 1; slot <= 12; slot++)
    expect(
      contrastRatio(bandColor(theme, slot), bandForeground(theme, slot)),
    ).toBeGreaterThanOrEqual(7);
});

test('the foreground is the better of dark and light', () => {
  for (let slot = 1; slot <= 12; slot++) {
    const color = bandColor(theme, slot);
    const best = Math.max(
      contrastRatio(color, theme.color.display),
      contrastRatio(color, theme.color.textInverse),
    );
    expect(contrastRatio(color, bandForeground(theme, slot))).toBe(best);
  }
});

test('every colour stands out on the graph, as curves and hollow faces need', () => {
  for (const color of bandPalette(theme))
    expect(contrastRatio(color, theme.color.display)).toBeGreaterThanOrEqual(4.5);
});

test('deepens each band colour enough to show on the light chrome', () => {
  const { surfaceInset, surfaceElevated } = defaultTheme.color;
  for (let slot = 1; slot <= 12; slot++) {
    const color = bandColorOnLight(defaultTheme, slot, surfaceInset);
    expect(contrastRatio(color, surfaceInset)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(contrastRatio(color, surfaceElevated)).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
  }
});
