import { describe, expect, it } from 'vitest';
import { renderLog } from './log.js';
import { LOG_CATALOGUE, isLogId } from './logCatalogue.js';
import { LANGUAGES, parseTemplate, type TemplateNode } from './messages.js';

/** Every placeholder a template asks for, in its choices too. */
function names(nodes: readonly TemplateNode[]): string[] {
  return nodes.flatMap((node) =>
    typeof node === 'string' ? [] : [node.name, ...('branches' in node ? Object.values(node.branches).flatMap(names) : [])],
  );
}

describe('the Log Catalogue', () => {
  it('names every kind of Log Entry by a fixed Log ID (FR-SR-12)', () => {
    for (const logId of Object.keys(LOG_CATALOGUE)) {
      expect(logId).toMatch(/^[A-Z]{3}-[0-9]{3}$/);
    }
  });

  it('has every template in Dutch and English, asking only for its own parameters (NFR-LOC-10)', () => {
    for (const [logId, type] of Object.entries(LOG_CATALOGUE)) {
      for (const language of LANGUAGES) {
        const asked = new Set(names(parseTemplate(type.text[language])));
        for (const name of asked) {
          expect(type.parameters, `${logId} in ${language} asks for {${name}}`).toContain(name);
        }
      }
      // Both languages ask for the same parameters.
      expect(new Set(names(parseTemplate(type.text.nl))), logId).toEqual(new Set(names(parseTemplate(type.text.en))));
    }
  });

  it('builds the text of an entry in the language of its reader, its names as they are (NFR-LOC-01)', () => {
    const params = { exposure: 'datahub_saved_searches', key: 'p.d.saved_searches', run: '70403104' };
    expect(renderLog('RES-001', params, 'en')).toBe('Registered through exposure datahub_saved_searches');
    expect(renderLog('RES-001', params, 'nl')).toBe('Geregistreerd via de exposure datahub_saved_searches');
    expect(renderLog('RES-002', { level: '1', reason: 'fields-undescribed' }, 'nl')).toBe('Maturiteit beoordeeld op Level 1');
    expect(renderLog('COL-004', { visibility: 'public', actor: 'Max' }, 'nl')).toBe('Publiek gemaakt door Max');
  });

  it('gives a field name a capital, and keeps the spelling of a name', () => {
    expect(renderLog('RES-005', { field: 'description', actor: 'Max' }, 'en')).toBe('Description updated by Max');
    expect(renderLog('COL-006', { resource: 'saved searches', actor: 'Max' }, 'en')).toBe('saved searches added by Max');
  });

  it('shows a missing parameter as a question mark, and an unknown Log ID as itself', () => {
    expect(renderLog('RES-003', { old: 'Orders' }, 'en')).toBe('Renamed from Orders to ?');
    expect(renderLog('XYZ-999', {}, 'en')).toBe('XYZ-999');
    expect(isLogId('RES-001')).toBe(true);
    expect(isLogId('toString')).toBe(false);
  });
});
