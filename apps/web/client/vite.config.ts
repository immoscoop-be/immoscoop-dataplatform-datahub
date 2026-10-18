import { defineConfig } from 'vite';

// Builds the page into dist/client, which the server serves (src/page.ts). Run from apps/web:
// `pnpm build:client`. React's JSX needs no plugin: Vite compiles it with the automatic runtime.
export default defineConfig({
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rolldownOptions: {
      onwarn(warning, warn) {
        // Mantine marks its modules "use client" for React Server Components; a page bundle has no use for it.
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') {
          warn(warning);
        }
      },
    },
  },
});
