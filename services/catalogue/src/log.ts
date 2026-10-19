/**
 * The Log IDs of a Collection, from the Log catalogue (docs/requirements/functional/log-catalogue.md),
 * with their templates. A Log Entry keeps the Log ID and its parameters; the text is built only
 * when it is read (DEC-SR-09, FR-SR-12).
 */
export const COLLECTION_LOG = {
  'COL-001': 'Collection created by {actor}',
  'COL-002': '{field} changed by {actor}',
  'COL-003': 'Owner Unit changed from {old} to {new} by {actor}',
  'COL-004': 'Made {visibility} by {actor}',
  'COL-005': 'Collection dissolved by {actor}',
  'COL-006': '{resource} added by {actor}',
  'COL-007': '{resource} removed by {actor}',
} as const;

export type CollectionLogId = keyof typeof COLLECTION_LOG;

/** The Log IDs of a Resource, from the same Log catalogue. */
export const RESOURCE_LOG = {
  'RES-001': 'Registered through exposure {exposure}',
  'RES-003': 'Renamed from {old} to {new}',
  'RES-004': 'Withdrawn: no exposure with the tag datahub depends on it any more',
  'RES-006': 'Back through exposure {exposure}',
  'COL-030': 'Added to collection {collection} by {actor}',
  'COL-031': 'Removed from collection {collection} by {actor}',
} as const;

export type ResourceLogId = keyof typeof RESOURCE_LOG;

const TEMPLATES: Record<string, string> = { ...COLLECTION_LOG, ...RESOURCE_LOG };

/** Fills in the template of a Log ID; the text starts with a capital, as a field name may not. */
export function logText(logId: string, params: Record<string, string>): string {
  const template = TEMPLATES[logId] ?? logId;
  const text = template.replace(/\{(\w+)\}/g, (_match, name: string) => params[name] ?? `{${name}}`);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
