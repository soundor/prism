import { channels, hasGain, hasQ, hasSlope, slopes, type BandSettings } from './catalog';

// How the editor writes values: true minus signs and signed gains. Hosts
// get the parameters' own text (soundor.config.ts), which they read back.

const minus = (text: string) => text.replace('-', '−');

/** "31.5 Hz", "240 Hz", "3.10 kHz", "11.5 kHz". */
export function formatFrequency(hz: number): string {
  if (hz >= 10_000) return `${(hz / 1000).toFixed(1)} kHz`;
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  if (hz >= 100) return `${Math.round(hz)} Hz`;
  return `${hz.toFixed(1)} Hz`;
}

/** "+2.6 dB", "−3.2 dB", "0.0 dB". */
export function formatGain(db: number): string {
  const value = Math.abs(db) < 0.05 ? 0 : db;
  return minus(`${value > 0 ? '+' : ''}${value.toFixed(1)} dB`);
}

/** Three significant figures: "0.707", "1.40", "12.0". */
export function formatQ(q: number): string {
  if (q >= 10) return q.toFixed(1);
  if (q >= 1) return q.toFixed(2);
  return q.toFixed(3);
}

/**
 * Every setting that applies to the band's type, as assistive technology
 * reads a marker: "3.10 kHz, +2.6 dB, Q 0.900".
 */
export function describeBand(band: BandSettings): string {
  const parts = [formatFrequency(band.frequency)];
  if (hasGain(band.type)) parts.push(formatGain(band.gain));
  if (hasQ(band.type, band.slope)) parts.push(`Q ${formatQ(band.q)}`);
  if (hasSlope(band.type)) parts.push(slopes.find((s) => s.value === band.slope)!.label);
  if (band.channel !== 'stereo') parts.push(channels.find((c) => c.value === band.channel)!.label);
  if (!band.enabled) parts.push('bypassed');
  if (band.solo) parts.push('solo');
  return parts.join(', ');
}

const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** The nearest equal-tempered note (A4 = 440 Hz) and how far off it is: "A4", "C♯3 +12¢", "E2 −30¢". */
export function formatNote(hz: number): string {
  const midi = 69 + 12 * Math.log2(hz / 440);
  const nearest = Math.round(midi);
  const cents = Math.round((midi - nearest) * 100);
  const name = `${noteNames[((nearest % 12) + 12) % 12]}${Math.floor(nearest / 12) - 1}`;
  return cents === 0 ? name : `${name} ${cents > 0 ? '+' : '−'}${Math.abs(cents)}¢`;
}
