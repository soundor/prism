import { audioFile, defineInput, microphone } from '@soundor/web-runtime/input';

import { drumLoop, pinkNoise, sineSweep, synthLoop, type Channels } from './signals';

/**
 * A source that loops `render`'s samples, rendered once per sample rate and
 * started where the transport is.
 */
function loop(id: string, label: string, render: (rate: number) => Channels) {
  const rendered = new Map<number, Channels>();
  return defineInput({
    id,
    label,
    start({ context, destination, timeInSeconds }) {
      const rate = context.sampleRate;
      let channels = rendered.get(rate);
      if (!channels) {
        channels = render(rate);
        rendered.set(rate, channels);
      }
      const buffer = context.createBuffer(channels.length, channels[0]!.length, rate);
      channels.forEach((samples, channel) => buffer.copyToChannel(samples, channel));
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(destination);
      source.start(0, timeInSeconds % buffer.duration);
      return () => {
        source.stop();
        source.disconnect();
      };
    },
  });
}

/** A steady sine: the built-in oscillator would be labelled only "Oscillator". */
function tone(frequency: number, label: string) {
  return defineInput({
    id: `prism-tone-${frequency}`,
    label,
    start({ context, destination }) {
      const oscillator = new OscillatorNode(context, { type: 'sine', frequency });
      const gain = new GainNode(context, { gain: 0.25 });
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      return () => {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
      };
    },
  });
}

export default [
  loop('prism-demo', 'Synth loop', synthLoop),
  loop('prism-drums', 'Drum loop', drumLoop),
  loop('prism-pink-noise', 'Pink noise', pinkNoise),
  loop('prism-sweep', 'Sine sweep', sineSweep),
  tone(1000, '1 kHz sine'),
  audioFile(),
  microphone(),
];
