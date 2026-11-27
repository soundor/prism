// Colour blending in OKLab (Björn Ottosson, 2020), a space in which equal
// steps look about equally different, so that a ramp's lightness rises
// evenly between its stops. Colours are sRGB hex strings.

export type Lab = readonly [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** "#rrggbb" to OKLab: lightness 0–1, then the two opponent axes. */
export function hexToOklab(hex: string): Lab {
  const value = parseInt(hex.slice(1), 16);
  const r = toLinear(((value >> 16) & 255) / 255);
  const g = toLinear(((value >> 8) & 255) / 255);
  const b = toLinear((value & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab to "#rrggbb", clipped to the sRGB gamut. */
export function oklabToHex([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const channel = (linear: number) =>
    Math.round(Math.min(1, Math.max(0, fromLinear(linear))) * 255);
  const r = channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** The colour a fraction `t` of the way from `from` to `to`, in OKLab. */
export function mixOklab(from: Lab, to: Lab, t: number): string {
  return oklabToHex([
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ]);
}
