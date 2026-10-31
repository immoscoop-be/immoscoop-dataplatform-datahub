import { t } from '@datahub/ui/foundations/texts.svelte.js';
import type { Missing } from './query.js';

/**
 * What a Broken query misses, as its callout names it (FR-SR-53, DEC-UX-160): a table by the Resource it is the
 * table of, when the query reads it; a column as BigQuery names it, which does not say of which Resource.
 */
export function missingOfQuery(missing: Missing | null, resources: readonly { key?: string; displayName: string }[]): string | null {
  if (!missing) return null;
  const resource = missing.kind === 'table' ? resources.find((one) => one.key !== undefined && one.key === missing.name.toLowerCase()) : undefined;
  return resource ? t('query.broken.resource', { name: resource.displayName }) : missingText(missing);
}

/** What a Broken Lens misses, as people read it in its callout: the table or the column (FR-LE-17). */
export function missingText(missing: Missing | null): string | null {
  if (!missing) return null;
  return t(missing.kind === 'table' ? 'lens.broken.table' : 'lens.broken.column', { name: missing.name });
}

/** What the red dot of a Broken Lens or query says on hover, wherever it is listed (DEC-UX-81). */
export function brokenText(missing: Missing | null): string | null {
  const what = missingText(missing);
  return what === null ? null : t('lens.broken.hover', { missing: what });
}
