import { t } from '@datahub/ui/foundations/texts.svelte.js';
import type { Missing } from './query.js';

/** What a Broken Lens misses, as people read it in its callout: the table or the column (FR-LE-17). */
export function missingText(missing: Missing | null): string | null {
  if (!missing) return null;
  return t(missing.kind === 'table' ? 'lens.broken.table' : 'lens.broken.column', { name: missing.name });
}

/** What the red dot of a Broken Lens says on hover, wherever it is listed (DEC-UX-81). */
export function brokenText(missing: Missing | null): string | null {
  const what = missingText(missing);
  return what === null ? null : t('lens.broken.hover', { missing: what });
}
