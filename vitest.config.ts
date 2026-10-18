import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'datahub',
          include: ['packages/*/src/**/*.test.ts', 'services/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'apps/*/client/src/**/*.test.{ts,tsx}'],
        },
      },
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
