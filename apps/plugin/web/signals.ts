// The browser demo's built-in sources, rendered once into channels of
// samples that loop seamlessly. Pure functions of the sample rate, so they
// can be tested without Web Audio.

/** One channel per entry, all the same length. */
export type Channels = Float32Array<ArrayBuffer>[];

/** A seeded pseudo-random source: the same noise on every run. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 1073741823.5 - 1;
  };
}

/** A fade over `length` samples at both ends, so a loop does not click. */
function fadeEnds(samples: Float32Array, length: number) {
  for (let i = 0; i < length; i++) {
    const gain = i / length;
    samples[i]! *= gain;
    samples[samples.length - 1 - i]! *= gain;
  }
}

/** A two-bar synth pattern with bass, harmonics and a noise hat: 4 s, mono. */
export function synthLoop(rate: number): Channels {
  const samples = new Float32Array(rate * 4);
  const pitches = [55, 55, 65.4, 73.4, 49, 49, 65.4, 82.4];
  const noise = random(9);
  for (let i = 0; i < samples.length; i++) {
    const time = i / rate;
    const t = time % 0.5;
    const phase = 2 * Math.PI * pitches[Math.floor(time * 2)]! * t;
    const bass =
      (Math.sin(phase) + 0.4 * Math.sin(phase * 7) + 0.2 * Math.sin(phase * 31)) *
      Math.exp(-t * 12);
    const h = time % 0.25;
    const hat = noise() * Math.exp(-h * 42);
    samples[i] = 0.12 * bass * Math.min(t * 500, 1) + 0.07 * hat * Math.min(h * 500, 1);
  }
  return [samples];
}

/** Two bars of kick, snare and hats at 120 BPM: 4 s, mono. */
export function drumLoop(rate: number): Channels {
  const samples = new Float32Array(rate * 4);
  const noise = random(23);
  const sixteenth = rate / 8;
  // Adds `voice(t)` from sixteenth `step` on, for `seconds`.
  const hit = (step: number, seconds: number, voice: (t: number) => number) => {
    const start = Math.round(step * sixteenth);
    const end = Math.min(samples.length, start + Math.round(seconds * rate));
    for (let i = start; i < end; i++) {
      const t = (i - start) / rate;
      samples[i]! += voice(t) * Math.min(t * 2000, 1);
    }
  };
  for (let step = 0; step < 32; step++) {
    if ([0, 6, 8, 10, 16, 22, 24, 27].includes(step)) {
      // A sine whose pitch drops from 158 Hz to 48 Hz; its phase in closed form.
      hit(step, 0.45, (t) => {
        const phase = 2 * Math.PI * (48 * t + (110 / 30) * (1 - Math.exp(-t * 30)));
        return 0.5 * Math.sin(phase) * Math.exp(-t * 7);
      });
    }
    if (step % 8 === 4) {
      hit(step, 0.25, (t) => {
        const body = 0.15 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30);
        return body + 0.22 * noise() * Math.exp(-t * 22);
      });
    }
    // Closed hats on every sixteenth, accented on the off-beats; the
    // difference of two noise samples makes them bright.
    const accent = step % 4 === 2 ? 0.06 : 0.027;
    let previous = 0;
    hit(step, 0.06, (t) => {
      const white = noise();
      const bright = white - previous;
      previous = white;
      return accent * bright * Math.exp(-t * 60);
    });
  }
  return [samples];
}

/**
 * Pink noise, -3 dB an octave, as engineers tune an EQ by: 8 s, stereo,
 * with the channels uncorrelated so mid and side both carry it.
 */
export function pinkNoise(rate: number): Channels {
  return [11, 29].map((seed) => {
    const samples = new Float32Array(rate * 8);
    const white = random(seed);
    // Paul Kellet's refined filter: within 0.05 dB of -3 dB/oct above 9 Hz.
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < samples.length; i++) {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      samples[i] = 0.05 * (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362);
      b6 = w * 0.115926;
    }
    fadeEnds(samples, Math.round(rate * 0.01));
    return samples;
  });
}

/** The sweep's range, in Hz. */
export const SWEEP_FROM = 20;
export const SWEEP_TO = 20_000;
/** How long one sweep takes, in seconds. */
export const SWEEP_SECONDS = 8;

/**
 * A sine gliding from 20 Hz to 20 kHz at an even rate per octave, at
 * -12 dBFS, then a short rest: 9 s, mono.
 */
export function sineSweep(rate: number): Channels {
  const samples = new Float32Array(rate * (SWEEP_SECONDS + 1));
  const length = rate * SWEEP_SECONDS;
  const octaves = Math.log(SWEEP_TO / SWEEP_FROM);
  // The phase of an exponential chirp, in closed form.
  const scale = (2 * Math.PI * SWEEP_FROM * SWEEP_SECONDS) / octaves;
  for (let i = 0; i < length; i++) {
    const time = i / rate;
    samples[i] = 0.25 * Math.sin(scale * (Math.exp((time / SWEEP_SECONDS) * octaves) - 1));
  }
  fadeEnds(samples.subarray(0, length), Math.round(rate * 0.005));
  return [samples];
}
