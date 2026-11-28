import { defineConfig } from 'vitest/config';

// The built VST3 in Soundor's VST3 host (`pnpm test:vst3`, after
// `pnpm build:vst3` and `pnpm build:vst3:debug`): its audio headless, and a
// Debug build with its editor open, which needs a display.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/vst3/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
