import type { Theme } from '@soundor/components/theme';

// Band identity colours on the dark graph, cycled by band number: the
// palette's lavender, lime, coral and amber, completed with hues of the same
// lightness that the palette has no tokens for (the design's sky, teal, rose
// and periwinkle, then orange, mint, orchid and azure). Neighbours alternate
// warm and cool. Twelve colours, so 24 bands repeat each once; the number on
// the marker is the identifier.

const extra = {
  sky: '#8ccff0',
  teal: '#7fdcc5',
  rose: '#f2a0c8',
  periwinkle: '#a3b5ff',
  orange: '#f5b56b',
  mint: '#8fe3a0',
  orchid: '#e09cf2',
  azure: '#7fa7ff',
} as const;

/**
 * A value worked out once per theme and key: the colours below are asked for
 * at every render of every marker, chip and curve, and some take dozens of
 * contrast measurements.
 */
function perTheme<K, V>(compute: (theme: Theme, key: K) => V): (theme: Theme, key: K) => V {
  const caches = new WeakMap<Theme, Map<K, V>>();
  return (theme, key) => {
    let cache = caches.get(theme);
    if (!cache) caches.set(theme, (cache = new Map()));
    let value = cache.get(key);
    if (value === undefined) cache.set(key, (value = compute(theme, key)));
    return value;
  };
}

const palettes = new WeakMap<Theme, readonly string[]>();

export function bandPalette(theme: Theme): readonly string[] {
  let palette = palettes.get(theme);
  if (!palette) palettes.set(theme, (palette = makePalette(theme)));
  return palette;
}

function makePalette(theme: Theme): readonly string[] {
  const c = theme.color;
  return [
    c.lavender,
    c.lime,
    c.coral,
    extra.sky,
    c.displayWarning,
    extra.teal,
    extra.rose,
    extra.periwinkle,
    extra.orange,
    extra.mint,
    extra.orchid,
    extra.azure,
  ];
}

export function bandColor(theme: Theme, slot: number): string {
  const palette = bandPalette(theme);
  return palette[(slot - 1) % palette.length]!;
}

/**
 * The text colour for a band's number on its filled face: whichever of the
 * graph's dark surface and the light inverse text contrasts more with the
 * band's colour.
 */
export const bandForeground = perTheme((theme, slot: number): string => {
  const background = bandColor(theme, slot);
  const dark = theme.color.display;
  const light = theme.color.textInverse;
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
});

/** WCAG 2 relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** WCAG 2's minimum contrast for graphics, such as a band's dot. */
export const GRAPHIC_CONTRAST = 3;

/**
 * The band's colour on the light chrome: its graph colour, darkened toward
 * black in small steps until it has GRAPHIC_CONTRAST with `background`. The
 * graph colours are pastels for the dark display and barely show there.
 */
export function bandColorOnLight(theme: Theme, slot: number, background: string): string {
  return onLight(theme, `${slot} ${background}`);
}

const onLight = perTheme((theme, key: string): string => {
  const [slot, background] = key.split(' ') as [string, string];
  const color = bandColor(theme, Number(slot));
  for (let shade = 1; shade > 0; shade -= 0.02) {
    const darker = scale(color, shade);
    if (contrastRatio(darker, background) >= GRAPHIC_CONTRAST) return darker;
  }
  return '#000000';
});

/** Each channel times `factor`, as `#rrggbb`. */
function scale(hex: string, factor: number): string {
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * factor)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
