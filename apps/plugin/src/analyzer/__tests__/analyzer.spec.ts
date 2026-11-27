import type { PlotSamples, PlotSource } from '@soundor/components';
import { mockNative, publishStream } from '@soundor/testing-library/react';
import { state } from 'soundor:state';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { GRID_POINTS, gridFrequencies } from '../../graph/response';
import { createAnalyzer, SPECTROGRAM_BINS } from '../analyzer';

const analyze = vi.fn();
beforeEach(() => {
  analyze.mockClear();
  mockNative('analyze', analyze);
  state.analyzerTilt.set(0);
  state.analyzerSmoothing.set('off');
});

/** A published spectrum: `pre` dBFS everywhere before the EQ, `post` after. */
const spectrum = (pre: number, post: number) => {
  const values = new Float32Array(2 * GRID_POINTS);
  values.fill(pre, 0, GRID_POINTS);
  values.fill(post, GRID_POINTS);
  return values;
};
// The analyzer publishes [Hz, dB] pairs.
const levels = (source: PlotSource<PlotSamples>) =>
  (source.get()!.points as readonly (readonly [number, number])[]).map(([, db]) => db);

let stop: (() => void) | undefined;
afterEach(() => stop?.());

test('asks the processor to analyze while it runs, and again when a setting changes', () => {
  const analyzer = createAnalyzer();
  stop = analyzer.start();
  expect(analyze).toHaveBeenLastCalledWith(true);
  analyze.mockClear();
  state.analyzerFftSize.set('fft16384');
  expect(analyze).toHaveBeenLastCalledWith(true);
  stop();
  stop = undefined;
  expect(analyze).toHaveBeenLastCalledWith(false);
});

test('draws the spectra the processor publishes, tilted', () => {
  const analyzer = createAnalyzer();
  stop = analyzer.start();
  publishStream('spectrum', spectrum(-40, -30));
  expect(levels(analyzer.pre).every((db) => db === -40)).toBe(true);
  expect(levels(analyzer.post).every((db) => db === -30)).toBe(true);

  state.analyzerTilt.set(3);
  publishStream('spectrum', spectrum(-40, -30));
  const at = (hz: number) =>
    levels(analyzer.pre)[gridFrequencies.findIndex((frequency) => frequency >= hz)]!;
  expect(at(2000)).toBeCloseTo(-37, 0);
  expect(at(250)).toBeCloseTo(-46, 0);
});

test('smooths across frequency', () => {
  const analyzer = createAnalyzer();
  state.analyzerSmoothing.set('oct6');
  const values = spectrum(-120, -120);
  values[100] = -20;
  analyzer.show(values, 0);
  const pre = levels(analyzer.pre);
  expect(pre[100]).toBeCloseTo(-20 / 5 + (-120 * 4) / 5);
  expect(pre[102]).toBe(pre[100]);
  expect(pre[103]).toBe(-120);
});

test('holds peaks, then lets them fall', () => {
  const analyzer = createAnalyzer();
  state.analyzerPeakHold.set(true);
  analyzer.show(spectrum(-60, -10), 0);
  analyzer.show(spectrum(-60, -50), 1);
  expect(levels(analyzer.peak)[0]).toBe(-10);
  analyzer.show(spectrum(-60, -50), 2);
  expect(levels(analyzer.peak)[0]).toBeCloseTo(-16);
  state.analyzerPeakHold.set(false);
  analyzer.show(spectrum(-60, -50), 2.1);
  expect(levels(analyzer.peak)[0]).toBe(-50);
});

test('freezing holds the spectrum, and nothing is drawn with the analyzer off', () => {
  const analyzer = createAnalyzer();
  stop = analyzer.start();
  publishStream('spectrum', spectrum(-40, -30));
  analyzer.setFrozen(true);
  publishStream('spectrum', spectrum(-20, -10));
  expect(levels(analyzer.pre)[0]).toBe(-40);
  analyzer.setFrozen(false);
  publishStream('spectrum', spectrum(-20, -10));
  expect(levels(analyzer.pre)[0]).toBe(-20);

  state.analyzerMode.set('off');
  publishStream('spectrum', spectrum(-50, -50));
  expect(levels(analyzer.pre)[0]).toBe(-20);
});

test('draws the spectrogram frames the processor publishes, tilted, while it is shown', () => {
  const analyzer = createAnalyzer();
  stop = analyzer.start();
  const values = () => Array.from(analyzer.spectrogram.get()!.values);
  publishStream('spectrogram', new Float32Array(SPECTROGRAM_BINS).fill(-30));
  expect(values().every((db) => db === -120)).toBe(true);

  state.showSpectrogram.set(true);
  state.analyzerTilt.set(3);
  const frame = new Float32Array(SPECTROGRAM_BINS).fill(-30);
  frame[0] = -120;
  publishStream('spectrogram', frame);
  const shown = values();
  // Silence stays at the floor; 1 kHz is where the tilt is 0.
  expect(shown[0]).toBe(-120);
  const kilohertz = Math.round(((1000 - 10) / (30_000 - 10)) * (SPECTROGRAM_BINS - 1));
  expect(shown[kilohertz]).toBeCloseTo(-30, 1);
  expect(shown[SPECTROGRAM_BINS - 1]).toBeCloseTo(-30 + 3 * Math.log2(30), 3);

  analyzer.setFrozen(true);
  publishStream('spectrogram', new Float32Array(SPECTROGRAM_BINS).fill(-60));
  expect(values()[kilohertz]).toBeCloseTo(-30, 1);
});

test('asks the processor again when the spectrogram is shown or hidden', () => {
  const analyzer = createAnalyzer();
  stop = analyzer.start();
  analyze.mockClear();
  state.showSpectrogram.set(true);
  expect(analyze).toHaveBeenLastCalledWith(true);
});
