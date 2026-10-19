import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLER_ICONS } from '@datahub/contracts/collection-icons';
import { defineConfig, type Plugin } from 'vite';

/**
 * Copies the drawing of every icon a Collection can carry into `icons/`, one file per icon, as
 * `@tabler/icons` ships it: the page fetches only the ones it shows, and its scripts hold none
 * (DEC-CO-14). They are copied next to the bundle rather than emitted into it, so that the build
 * does not list some 4,800 files.
 */
function collectionIcons(): Plugin {
  const outline = fileURLToPath(new URL('../node_modules/@tabler/icons/icons/outline/', import.meta.url));
  let icons = '';
  return {
    name: 'datahub:collection-icons',
    apply: 'build',
    configResolved(config) {
      icons = join(resolve(config.root, config.build.outDir), 'icons');
    },
    async writeBundle() {
      await mkdir(icons, { recursive: true });
      await Promise.all(TABLER_ICONS.map(([name]) => copyFile(join(outline, `${name}.svg`), join(icons, `${name}.svg`))));
    },
  };
}

// Builds the page into dist/client, which the server serves (src/page.ts). Run from apps/web:
// `pnpm build:client`. React's JSX needs no plugin: Vite compiles it with the automatic runtime.
export default defineConfig({
  root: 'client',
  plugins: [collectionIcons()],
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
