import type { PlotBandSamples, PlotSamples, PlotSource, SpectrumFrame } from '@soundor/components';
import { analyze, streams } from 'soundor:native';
import { state } from 'soundor:state';

import { FREQUENCY_MAX, FREQUENCY_MIN } from '../bands/catalog';
import { GRID_POINTS, gridFrequencies, toPoints } from '../graph/response';
import { createStore } from '../store';

// The analyzer's traces and the spectrogram, from what the processor
// measures (see lib/src/analyzer) about 60 times a second: the pre and post
// spectrum at the graph's grid frequencies, already averaged at the chosen
// speed, and the latest post frame at the FFT's own resolution. Here the
// spectra are smoothed across frequency, tilted, held at their peaks and
// frozen, as the analyzer settings ask; the spectrogram is tilted and frozen.

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
/** Each spectrogram bin's octaves from 1 kHz, for the tilt. */
const binOctaves = Float32Array.from({ length: SPECTROGRAM_BINS }, (_, i) =>
  Math.log2(
    (FREQUENCY_MIN + ((FREQUENCY_MAX - FREQUENCY_MIN) * i) / (SPECTROGRAM_BINS - 1)) / 1000,
  ),
);
/** The settings the processor measures with: a change is passed on to it. */
const processorSettings = [
  state.analyzerMode,
  state.analyzerFftSize,
  state.analyzerWindow,
  state.analyzerSpeed,
  state.showSpectrogram,
] as const;

/** A source the plot reads, published as each frame comes: always new, if often the same object. */
function channel<T>(initial: T) {
  const store = createStore(initial, () => false);
  const source: PlotSource<T> = store;
  return { source, publish: store.set };
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
  // The post frame (the pre one while bypassed), tilted.
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
    if (state.analyzerMode.get() === 'off') return;
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
  }

  function showFrame(values: Float32Array) {
    if (frozen || !state.showSpectrogram.get()) return;
    const tilt = state.analyzerTilt.get();
    const into = frame.values as Float32Array;
    const count = Math.min(values.length, SPECTROGRAM_BINS);
    for (let i = 0; i < count; i++) {
      const level = values[i]!;
      into[i] = level <= SILENCE ? SILENCE : level + tilt * binOctaves[i]!;
    }
    spectrogram.publish(frame);
  }

  return {
    pre: pre.source,
    post: post.source,
    postFill: postFill.source,
    peak: peak.source,
    spectrogram: spectrogram.source,
    /** Shows `spectrum` as if the processor had just published it, at `now` seconds. */
    show,
    /** Shows a spectrogram frame as if the processor had just published it. */
    showFrame,
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
      stops.push(streams.spectrogram.subscribe(showFrame));
      return () => {
        for (const stop of stops) stop();
        analyze(false);
      };
    },
  };
}

export type Analyzer = ReturnType<typeof createAnalyzer>;
