import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { fumadocsMdx } from 'fumadocs-mdx/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.PRISM_SITE_BASE || '/',
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      pages: [{ path: '/search-index.json' }],
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
    }),
    react(),
  ],
});
