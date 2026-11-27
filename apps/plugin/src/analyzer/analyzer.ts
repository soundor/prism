import type { PlotBandSamples, PlotSamples, PlotSource, SpectrumFrame } from '@soundor/components';
import { analyze, streams } from 'soundor:native';
import { state } from 'soundor:state';

import { FREQUENCY_MAX, FREQUENCY_MIN } from '../bands/catalog';
import { GRID_POINTS, gridFrequencies, toPoints } from '../graph/response';

// The analyzer's traces, from the spectra the processor measures (see
// lib/src/analyzer): it publishes the pre and post spectrum at the graph's
// grid frequencies, already averaged at the chosen speed, about 60 times a
// second. Here they are smoothed across frequency, tilted, held at their
// peaks and frozen, as the analyzer settings ask.

/** Grid points on each side averaged, per smoothing setting (320 points span 11.6 octaves). */
const smoothingPoints = { off: 0, oct12: 1, oct6: 2, oct3: 5 };
/** How long a peak holds before it falls, in seconds, and how fast it falls, in dB per second. */
const PEAK_HOLD = 1.5;
const PEAK_FALL = 6;
const SILENCE = -120;
/**
 * Bins in a spectrogram frame, equally spaced across the graph's range as an
 * FFT's are: about 7 Hz apart, so that the lowest octaves keep some detail.
 */
export const SPECTROGRAM_BINS = 4096;
/** The settings the processor measures with: a change is passed on to it. */
const processorSettings = [
  state.analyzerMode,
  state.analyzerFftSize,
  state.analyzerWindow,
  state.analyzerSpeed,
  state.showSpectrogram,
] as const;

function channel<T>(initial: T) {
  let current = initial;
  const listeners = new Set<() => void>();
  const source: PlotSource<T> = {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    source,
    publish(next: T) {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}

/** Averages `values` over `width` points on each side, tilted by `tilt` dB per octave around 1 kHz. */
function shape(values: ArrayLike<number>, offset: number, width: number, tilt: number) {
  const out = new Float64Array(GRID_POINTS);
  for (let i = 0; i < GRID_POINTS; i++) {
    const start = Math.max(0, i - width);
    const end = Math.min(GRID_POINTS - 1, i + width);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += values[offset + j]!;
    const level = sum / (end - start + 1);
    // Silence stays at the floor, untilted.
    out[i] = level <= SILENCE ? SILENCE : level + tilt * Math.log2(gridFrequencies[i]! / 1000);
  }
  return out;
}

export function createAnalyzer() {
  const initial = () => toPoints(new Float64Array(GRID_POINTS).fill(SILENCE));
  const prePoints = initial();
  const postPoints = initial();
  const peakPoints = initial();
  const peakUntil = new Float64Array(GRID_POINTS);
  const pre = channel<PlotSamples>({ points: prePoints });
  const post = channel<PlotSamples>({ points: postPoints });
  // The plot clips this band to the current analyzer floor.
  const postBand = { lower: initial(), upper: postPoints };
  const postFill = channel<PlotBandSamples>(postBand);
  const peak = channel<PlotSamples>({ points: peakPoints });
  // The post spectrum (the pre one while bypassed), resampled to linear bins.
  const frame: SpectrumFrame = {
    values: new Float32Array(SPECTROGRAM_BINS).fill(SILENCE),
    frequencyRange: [FREQUENCY_MIN, FREQUENCY_MAX],
  };
  const spectrogram = channel<SpectrumFrame>(frame);
  let frozen = false;
  let lastTime: number | null = null;

  function show(spectrum: Float32Array, now = performance.now() / 1000) {
    const elapsed = lastTime === null ? 0 : Math.max(0, now - lastTime);
    lastTime = now;
    if (frozen || spectrum.length < 2 * GRID_POINTS) return;
    if (state.analyzerMode.get() === 'off' && !state.showSpectrogram.get()) return;
    const width = smoothingPoints[state.analyzerSmoothing.get()];
    const tilt = state.analyzerTilt.get();
    const hold = state.analyzerPeakHold.get();
    const before = shape(spectrum, 0, width, tilt);
    const after = shape(spectrum, GRID_POINTS, width, tilt);
    for (let i = 0; i < GRID_POINTS; i++) {
      prePoints[i]![1] = before[i]!;
      const level = after[i]!;
      postPoints[i]![1] = level;
      const k = peakPoints[i]!;
      if (!hold || level >= k[1]) {
        k[1] = level;
        peakUntil[i] = now + PEAK_HOLD;
      } else if (now >= peakUntil[i]!) {
        k[1] = Math.max(level, k[1] - PEAK_FALL * elapsed);
      }
    }
    pre.publish({ points: prePoints });
    post.publish({ points: postPoints });
    postFill.publish(postBand);
    peak.publish({ points: peakPoints });
    if (state.showSpectrogram.get()) {
      resample(postPoints, frame.values as Float32Array);
      spectrogram.publish(frame);
    }
  }

  return {
    pre: pre.source,
    post: post.source,
    postFill: postFill.source,
    peak: peak.source,
    spectrogram: spectrogram.source,
    /** Shows `spectrum` as if the processor had just published it, at `now` seconds. */
    show,
    setFrozen(value: boolean) {
      frozen = value;
    },
    /** Asks the processor to analyze, and follows its spectra, until the returned function is called. */
    start() {
      const sync = () => analyze(true);
      sync();
      const stops = processorSettings.map((field) => field.subscribe(sync));
      const latest = streams.spectrum.get();
      if (latest) show(latest);
      stops.push(streams.spectrum.subscribe((spectrum) => show(spectrum)));
      return () => {
        for (const stop of stops) stop();
        analyze(false);
      };
    },
  };
}

/** Log-spaced [Hz, dB] points, linearly interpolated onto equally spaced bins. */
export function resample(points: readonly (readonly [number, number])[], into: Float32Array) {
  const step = (FREQUENCY_MAX - FREQUENCY_MIN) / (into.length - 1);
  let j = 0;
  for (let i = 0; i < into.length; i++) {
    const hz = FREQUENCY_MIN + i * step;
    while (j < points.length - 2 && points[j + 1]![0] < hz) j++;
    const [x0, y0] = points[j]!;
    const [x1, y1] = points[j + 1]!;
    const t = Math.min(1, Math.max(0, (hz - x0) / (x1 - x0)));
    into[i] = y0 + (y1 - y0) * t;
  }
}

export type Analyzer = ReturnType<typeof createAnalyzer>;
