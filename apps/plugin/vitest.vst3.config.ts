import { defineConfig } from 'vitest/config';

// The built VST3 in Soundor's headless host (`pnpm test:vst3`, after
// `pnpm build:vst3`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/vst3/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
