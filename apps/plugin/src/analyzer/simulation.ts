import type { PlotBandSamples, PlotSamples, PlotSource } from '@soundor/components';
import { parameters } from 'soundor:parameters';
import { state } from 'soundor:state';

import { gridFrequencies, toPoints } from '../graph/response';

const TICK_MS = 33;
const smoothingBins = { off: 0, oct12: 1, oct6: 2, oct3: 5 };
const responseRates = { slow: 0.12, medium: 0.3, fast: 0.6 };
const fftSizes = { fft2048: 2048, fft4096: 4096, fft8192: 8192, fft16384: 16384 };
const windowRipple = { hann: 1.8, blackmanHarris: 1, hamming: 2.4, flatTop: 0.6 };

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

const bump = (octave: number, center: number, width: number) =>
  Math.exp(-(((octave - center) / width) ** 2));

/** A deterministic moving spectrum for the UI, not a measurement from the audio processor. */
function program(hz: number, t: number, resolution: number, ripple: number) {
  const oct = Math.log2(hz / 1000);
  const bin = Math.max(1, Math.round(hz / resolution));
  return (
    -39 -
    3 * oct -
    (oct > 0 ? 1.8 : 0.7) * oct * oct +
    14 * bump(oct, -4.1, 0.5) * (0.75 + 0.25 * Math.sin(t * 7.1)) +
    9 * bump(oct, -3, 0.55) +
    6 * bump(oct, 1.7, 0.4) +
    4 * Math.sin(oct * 5.3 - t * 1.7) +
    ripple * Math.sin(bin * 2.4 + t * 6)
  );
}

export function createSimulation() {
  const initial = () => toPoints(new Float64Array(gridFrequencies.length).fill(-120));
  const prePoints = initial();
  const postPoints = initial();
  const peakPoints = initial();
  const peakUntil = new Float64Array(gridFrequencies.length);
  const raw = new Float64Array(gridFrequencies.length);
  const postRaw = new Float64Array(gridFrequencies.length);
  const pre = channel<PlotSamples>({ points: prePoints });
  const post = channel<PlotSamples>({ points: postPoints });
  // The plot clips this band to the current analyzer floor.
  const postBand = { lower: initial(), upper: postPoints };
  const postFill = channel<PlotBandSamples>(postBand);
  const peak = channel<PlotSamples>({ points: peakPoints });
  const meters = channel<[number, number]>([-60, -60]);
  let frozen = false;
  let response: readonly (readonly [number, number])[] = [];
  let t = 0;

  function step() {
    t += TICK_MS / 1000;
    const bypassed = parameters.bypass.get();
    const input = bypassed ? 0 : parameters.inputGain.get();
    const output = bypassed ? 0 : parameters.outputGain.get();
    const base = -12 + input + output + 3 * Math.sin(t * 2.3) + Math.sin(t * 7);
    const clampMeter = (db: number) => Math.min(6, Math.max(-90, db));
    meters.publish([
      clampMeter(base + 1.2 * Math.sin(t * 9)),
      clampMeter(base + 1.2 * Math.cos(t * 8)),
    ]);
    if (frozen || (state.analyzerMode.get() === 'off' && !state.showSpectrogram.get())) return;

    const width = smoothingBins[state.analyzerSmoothing.get()];
    const rate = responseRates[state.analyzerSpeed.get()];
    const resolution = 48_000 / fftSizes[state.analyzerFftSize.get()];
    const ripple = windowRipple[state.analyzerWindow.get()];
    const tilt = state.analyzerTilt.get();
    const hold = state.analyzerPeakHold.get();
    for (const [i, hz] of gridFrequencies.entries()) {
      raw[i] = program(hz, t, resolution, ripple) + tilt * Math.log2(hz / 1000) + input;
      postRaw[i] = raw[i]! + (bypassed ? 0 : (response[i]?.[1] ?? 0) + output);
    }
    for (let i = 0; i < raw.length; i++) {
      const start = Math.max(0, i - width);
      const end = Math.min(raw.length - 1, i + width);
      let before = 0;
      let after = 0;
      for (let j = start; j <= end; j++) {
        before += raw[j]!;
        after += postRaw[j]!;
      }
      const n = end - start + 1;
      const p = prePoints[i]!;
      const q = postPoints[i]!;
      p[1] += (before / n - p[1]) * rate;
      q[1] += (after / n - q[1]) * rate;
      const k = peakPoints[i]!;
      if (!hold || q[1] >= k[1]) {
        k[1] = q[1];
        peakUntil[i] = t + 1.5;
      } else if (t >= peakUntil[i]!) {
        k[1] = Math.max(q[1], k[1] - 0.2);
      }
    }
    pre.publish({ points: prePoints });
    post.publish({ points: postPoints });
    postFill.publish(postBand);
    peak.publish({ points: peakPoints });
  }

  return {
    pre: pre.source,
    post: post.source,
    postFill: postFill.source,
    peak: peak.source,
    meters: meters.source,
    setFrozen(value: boolean) {
      frozen = value;
    },
    setResponse(points: typeof response) {
      response = points;
    },
    start() {
      step();
      const timer = setInterval(step, TICK_MS);
      return () => clearInterval(timer);
    },
  };
}

export type Simulation = ReturnType<typeof createSimulation>;
