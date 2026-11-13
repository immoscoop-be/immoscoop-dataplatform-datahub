import { formatBytes } from '@datahub/ui/foundations/bytes.js';
import { currentLanguage, t } from '@datahub/ui/foundations/texts.svelte.js';
import type { Storage } from './query.js';

const UNIT_KEYS = { hour: 'grain.unit.hour', day: 'grain.unit.day', month: 'grain.unit.month', year: 'grain.unit.year' } as const;

/**
 * The size of a Resource in all, and about how much a partition holds where it has them (FR-SR-39), as the
 * Overview and its Summary say it; null when BigQuery does not tell it.
 */
export function sizeText(storage: Storage | null | undefined, unit: string | null | undefined): string | null {
  if (!storage || storage.bytes === null) return null;
  const language = currentLanguage();
  const bytes = formatBytes(storage.bytes, language);
  const key = unit && unit in UNIT_KEYS ? UNIT_KEYS[unit as keyof typeof UNIT_KEYS] : null;
  return storage.partitions && key ? t('resource.sizePer', { bytes, per: formatBytes(storage.bytes / storage.partitions, language), unit: t(key) }) : t('resource.sizeOf', { bytes });
}
