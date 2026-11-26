import { soundor } from '@soundor/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [soundor()],
  test: {
    environment: 'soundor',
    include: ['src/**/__tests__/*.spec.{ts,tsx}'],
    // Libraries that import soundor:* run through Vite, as @soundor/react
    // does, so the simulated runtime serves those imports. @soundor/vitest
    // 0.21 inlines only its own packages.
    server: { deps: { inline: ['@soundor/components'] } },
  },
});
