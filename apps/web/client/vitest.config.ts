import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

// The tests of the browser side of the web app, and those of the Svelte components and the modules
// with runes of @datahub/ui (named *.svelte.test.ts): in a browser-like document (jsdom), compiled by
// Svelte, each test on an empty page.
export default defineProject({
  plugins: [svelte(), svelteTesting({ resolveBrowser: false })],
  resolve: { conditions: ['browser'] },
  test: {
    name: 'web',
    dir: fileURLToPath(new URL('../../..', import.meta.url)),
    environment: 'jsdom',
    include: ['apps/web/client/src/**/*.test.ts', 'packages/ui/src/**/*.svelte.test.ts'],
  },
});
