/** A locale file: nested maps of texts, addressed with dotted keys such as "footer.howToRead". */
export type Catalog = { [key: string]: Catalog | string };

export type Params = Record<string, string | number>;

export interface Translator {
  (key: string, params?: Params): string;
  has(key: string): boolean;
  readonly locale: string;
}

export const BASE_LOCALE = 'en';

export function lookup(catalog: Catalog | undefined, key: string): string | undefined {
  let node: Catalog | string | undefined = catalog;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

/** Exact match first, then the same language (nl -> nl-BE), else the base locale. */
export function resolveLocale(
  requested: string | undefined,
  available: Iterable<string>,
): { locale: string; matched: boolean } {
  if (requested === undefined) return { locale: BASE_LOCALE, matched: true };
  const locales = [...available];
  const exact = locales.find((locale) => locale.toLowerCase() === requested.toLowerCase());
  if (exact) return { locale: exact, matched: true };
  const language = requested.split('-')[0]!.toLowerCase();
  const sameLanguage = locales.find((locale) => locale.split('-')[0]!.toLowerCase() === language);
  if (sameLanguage) return { locale: sameLanguage, matched: true };
  return { locale: BASE_LOCALE, matched: false };
}

/** Texts come from the requested locale, then from English. An unknown key is returned as is. */
export function createTranslator(catalogs: ReadonlyMap<string, Catalog>, locale: string): Translator {
  const primary = catalogs.get(locale);
  const base = catalogs.get(BASE_LOCALE);
  const text = (key: string) => lookup(primary, key) ?? lookup(base, key);
  const t = (key: string, params?: Params) => {
    const template = text(key);
    return template === undefined ? key : interpolate(template, params);
  };
  return Object.assign(t, { has: (key: string) => text(key) !== undefined, locale });
}

/** All dotted keys in a catalog, used by the conformance checks and tests. */
export function keysOf(catalog: Catalog, prefix = ''): string[] {
  return Object.entries(catalog).flatMap(([name, value]) => {
    const key = prefix ? `${prefix}.${name}` : name;
    return typeof value === 'string' ? [key] : keysOf(value, key);
  });
}
