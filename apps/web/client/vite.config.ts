import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Builds the page into dist/client, which the server serves (src/page.ts). Run from apps/web:
// `pnpm build:client`. The tokens and the pictures come from docs/design, the one place for them;
// every file, fonts and pictures too, is a file of its own, as the page may load nothing inline.
export default defineConfig({
  root: 'client',
  plugins: [svelte()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
