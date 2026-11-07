/** The locale of each language of Data Hub, for numbers. */
const LOCALES = { nl: 'nl-BE', en: 'en-GB' } as const;

const UNITS = [
  [1e12, 'TB'],
  [1e9, 'GB'],
  [1e6, 'MB'],
  [1e3, 'kB'],
] as const;

/**
 * What a query reads, as people say it: in units of 1000, as BigQuery bills, with one decimal below 10,
 * such as 840 MB, 4,8 GB in Dutch and 4.8 GB in English (DEC-SR-29).
 */
export function formatBytes(bytes: number, language: keyof typeof LOCALES): string {
  const [size, unit] = UNITS.find(([threshold]) => bytes >= threshold) ?? [1, 'B'];
  const value = bytes / size;
  const digits = unit !== 'B' && value < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(LOCALES[language], { maximumFractionDigits: digits }).format(value)} ${unit}`;
}
