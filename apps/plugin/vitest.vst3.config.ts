import { soundor } from '@soundor/vitest-e2e';
import { defineConfig } from 'vitest/config';

// The built VST3 in Soundor's VST3 host (`pnpm test:vst3`, after
// `pnpm build:vst3` and `pnpm build:vst3:debug`). Tests with the editor open
// load the Debug build, which needs a display; the processor's own tests load
// the Release build, headless.
export default defineConfig({
  plugins: [soundor({ vst3: '.soundor/debug/vst3/Soundor Prism.vst3' })],
  test: { include: ['e2e/vst3/*.spec.ts'] },
});
