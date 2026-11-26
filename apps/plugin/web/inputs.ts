import { audioFile, defineInput } from '@soundor/web-runtime/input';

// A repeatable two-bar synth pattern with bass, harmonics and a noise hat.
const demo = defineInput({
  id: 'prism-demo',
  label: 'Synth loop',
  start({ context, destination, timeInSeconds }) {
    const rate = context.sampleRate;
    const buffer = context.createBuffer(1, rate * 4, rate);
    const samples = buffer.getChannelData(0);
    const pitches = [55, 55, 65.4, 73.4, 49, 49, 65.4, 82.4];
    let seed = 9;
    for (let i = 0; i < samples.length; i++) {
      const time = i / rate;
      const t = time % 0.5;
      const phase = 2 * Math.PI * pitches[Math.floor(time * 2)]! * t;
      const bass =
        (Math.sin(phase) + 0.4 * Math.sin(phase * 7) + 0.2 * Math.sin(phase * 31)) *
        Math.exp(-t * 12);
      const h = time % 0.25;
      seed = (seed * 16807) % 2147483647;
      const hat = (seed / 1073741823.5 - 1) * Math.exp(-h * 42);
      samples[i] = 0.12 * bass * Math.min(t * 500, 1) + 0.07 * hat * Math.min(h * 500, 1);
    }
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

export default [demo, audioFile()];
