import { LOG_CATALOGUE, isLogId } from './logCatalogue.js';
import { type Language, renderText } from './messages.js';

/**
 * The text of a Log Entry in a language, from its Log ID and parameters (DEC-SR-09, NFR-LOC-10). A
 * parameter the entry lacks shows as a question mark rather than failing the whole Log; an unknown
 * Log ID shows as itself. A text that starts with a field name gets a capital; one that starts with
 * a name, such as the Display Name of a Resource, keeps its own spelling (NFR-LOC-11).
 */
export function renderLog(logId: string, params: Readonly<Record<string, string | number>>, language: Language): string {
  if (!isLogId(logId)) {
    return logId;
  }
  const type = LOG_CATALOGUE[logId];
  const values = Object.fromEntries(type.parameters.map((name) => [name, params[name] ?? '?']));
  const text = renderText(type.text[language], language, values);
  return type.text[language].startsWith('{field') ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
