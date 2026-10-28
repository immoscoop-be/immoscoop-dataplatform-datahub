import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'datahub',
          include: ['packages/*/src/**/*.test.ts', 'services/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
          // The tests of Svelte components and modules with runes run in the project of the web app.
          exclude: ['**/node_modules/**', '**/*.svelte.test.ts'],
        },
      },
      'apps/web/client/vitest.config.ts',
      {
        extends: true,
        test: {
          name: 'semgraph',
          include: ['services/semgraph/test/**/*.test.ts'],
          // Some tests draw every example of every chart, in every size and theme: seconds, not milliseconds.
          testTimeout: 60_000,
        },
      },
    ],
  },
});
