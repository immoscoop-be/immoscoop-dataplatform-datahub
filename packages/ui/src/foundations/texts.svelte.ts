import { renderText, type Language } from '@datahub/contracts/messages';
import en from '../texts/en.js';
import nl from '../texts/nl.js';

export type { Language };

/** A translation file: a sentence per key, never a name (NFR-LOC-02). */
export type Texts = Readonly<Record<string, string>>;

/**
 * The sentences of the interface, in the language of the User: Dutch by default, English available
 * (DEC-DH-65, NFR-LOC-06). No sentence is written into a component; it asks for it by its key, and a
 * name goes in as a value, never translated (NFR-LOC-01). The sentences of this package come first;
 * an application adds its own with `addTexts`.
 */
class Sentences {
  language = $state<Language>('nl');
  readonly #files: Record<Language, Record<string, string>> = { nl: { ...nl }, en: { ...en } };

  add(texts: Readonly<Record<Language, Texts>>): void {
    Object.assign(this.#files.nl, texts.nl);
    Object.assign(this.#files.en, texts.en);
  }

  has(key: string): boolean {
    return key in this.#files.nl && key in this.#files.en;
  }

  text(key: string, values?: Readonly<Record<string, string | number>>): string {
    const template = this.#files[this.language][key];
    if (template === undefined) {
      throw new Error(`No sentence "${key}" in the translation files`);
    }
    return renderText(template, this.language, values);
  }
}

const sentences = new Sentences();

/** The sentence of a key, in the language of the User; it follows a change of language. */
export function t(key: string, values?: Readonly<Record<string, string | number>>): string {
  return sentences.text(key, values);
}

export function addTexts(texts: Readonly<Record<Language, Texts>>): void {
  sentences.add(texts);
}

export function hasText(key: string): boolean {
  return sentences.has(key);
}

export function currentLanguage(): Language {
  return sentences.language;
}

/** Switches every sentence on screen to the language, and tells the browser which it is. */
export function setLanguage(language: Language): void {
  sentences.language = language;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}
