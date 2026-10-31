import { describe, expect, it } from 'vitest';
import { MESSAGE_CATALOGUE } from './messageCatalogue.js';
import {
  contextPath,
  implicitParameters,
  markedPieces,
  textBlocks,
  LANGUAGES,
  parseTemplate,
  renderMessage,
  renderText,
  templateParameters,
  type MessageParameter,
  type MessageTexts,
  type MessageType,
  type TemplateNode,
} from './messages.js';

const REQUIREMENT_ID = /^(?:FR|TR|NFR|DEC|EC|OP)-[A-Z]{2,3}-\d{2,3}$/;
const PREFIXES = { CNV: undefined, COL: 'collection', RES: 'resource', LEN: 'lens', QRY: 'query', RPT: 'report', KEY: 'excelKey' } as const;

const parametersOf = (type: MessageType): Map<string, MessageParameter> =>
  new Map([...implicitParameters(type), ...type.parameters].map((p) => [p.name, p]));

const choices = (nodes: readonly TemplateNode[]): Extract<TemplateNode, { form: string }>[] =>
  nodes.flatMap((node) => (typeof node === 'string' || !node.form ? [] : [node, ...Object.values(node.branches).flatMap(choices)]));

/** Checks the texts against the parameters they may use, and that the laid-out text uses those it must. */
function checkTexts(where: string, texts: MessageTexts, parameters: ReadonlyMap<string, MessageParameter>, mustUse: readonly MessageParameter[]): void {
  for (const layout of ['plain', 'rich'] as const) {
    const used = LANGUAGES.map((language) => new Set(texts[language][layout].split('\n').flatMap(templateParameters)));
    expect(used[0], `${where} ${layout}: nl and en use the same parameters (NFR-LOC-10)`).toEqual(used[1]);
    for (const name of used[0] ?? []) {
      expect(parameters.has(name), `${where} ${layout}: {${name}} is a parameter`).toBe(true);
    }
    for (const language of LANGUAGES) {
      // A choice stays on one line, as a line is filled in on its own.
      for (const line of texts[language][layout].split('\n')) {
        for (const choice of choices(parseTemplate(line))) {
          const parameter = parameters.get(choice.name);
          const keys = Object.keys(choice.branches);
          if (choice.form === 'plural') {
            expect(parameter?.type, `${where}: {${choice.name}, plural} is a count`).toBe('count');
            expect(keys, `${where}: {${choice.name}, plural} has other`).toContain('other');
          } else if (choice.name !== 'subjectKind') {
            expect(parameter?.type, `${where}: {${choice.name}, select} is a choice`).toBe('choice');
            expect(keys.filter((key) => key !== 'other' && !parameter?.values?.includes(key)), `${where}: {${choice.name}} keys`).toEqual([]);
            expect(keys.includes('other') || parameter?.values?.every((value) => keys.includes(value)), `${where}: {${choice.name}} covers every value`).toBe(true);
          }
        }
      }
      if (layout === 'plain') {
        expect(texts[language].plain, `${where}: plain text has no formatting`).not.toMatch(/\*\*|~~|`|^> |^- /m);
      }
    }
  }
  const rich = new Set(LANGUAGES.flatMap((language) => texts[language].rich.split('\n').flatMap(templateParameters)));
  for (const parameter of mustUse) {
    expect(rich.has(parameter.name), `${where}: the laid-out text uses {${parameter.name}}`).toBe(true);
  }
  for (const parameter of parameters.values()) {
    if (parameter.item) {
      const fields = parameter.item.fields;
      checkTexts(`${where} {${parameter.name}}`, parameter.item.text, new Map(fields.map((f) => [f.name, f])), fields);
    }
  }
}

describe('the Message Catalogue (FR-CV-10)', () => {
  it('gives every type of Message a fixed Message ID of its own', () => {
    const ids = MESSAGE_CATALOGUE.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const type of MESSAGE_CATALOGUE) {
      const match = /^MSG-([A-Z]{3})-\d{2}$/.exec(type.id);
      expect(match, type.id).not.toBeNull();
      const prefix = match?.[1] as keyof typeof PREFIXES;
      expect(Object.keys(PREFIXES), type.id).toContain(prefix);
      if (PREFIXES[prefix]) {
        expect(type.subjects, `${type.id}: its prefix names its object`).toEqual([PREFIXES[prefix]]);
      }
    }
  });

  it('says where every type of Message comes from, with the IDs of requirements, decisions and open points', () => {
    for (const type of MESSAGE_CATALOGUE) {
      expect(type.sources.length, type.id).toBeGreaterThan(0);
      for (const id of [...type.sources, ...(type.openPoints ?? [])]) {
        expect(id, type.id).toMatch(REQUIREMENT_ID);
      }
      expect(type.openPoints?.every((id) => id.startsWith('OP-')) ?? true, type.id).toBe(true);
    }
  });

  it('has a plain and a laid-out text in Dutch and English, with the same parameters (FR-CV-11, FR-CV-12)', () => {
    for (const type of MESSAGE_CATALOGUE) {
      checkTexts(type.id, type.text, parametersOf(type), type.parameters);
    }
  });

  it('gives what Data Hub writes itself a Learning Card, and leaves it to the writer otherwise (FR-CV-14, FR-LR-38)', () => {
    for (const type of MESSAGE_CATALOGUE) {
      if (type.from === 'dataHub') {
        expect(type.learningCard.fit, type.id).not.toBe('byWriter');
      } else {
        expect(type.kind, `${type.id}: a person writes it`).not.toBe('dataHub');
      }
      expect(type.learningCard.why, type.id).not.toBe('');
    }
  });

  it('says what every type of Message asks, and links the action to it with its buttons (FR-CV-13)', () => {
    for (const type of MESSAGE_CATALOGUE) {
      const { action } = type;
      expect(action.what, type.id).not.toBe('');
      expect(action.done, type.id).not.toBe('');
      if (action.asks !== 'nothing') {
        expect(action.buttons.length, `${type.id}: an action has a way to it`).toBeGreaterThan(0);
        expect(action.states?.length ?? 0, `${type.id}: it shows how far the action is`).toBeGreaterThan(1);
      }
      for (const who of [...(action.of ?? []), ...action.buttons.flatMap((button) => button.for ?? [])]) {
        expect(type.to, `${type.id}: ${who} receives it`).toContain(who);
      }
      for (const button of action.buttons) {
        expect(button.label.nl && button.label.en && button.opens, type.id).toBeTruthy();
      }
    }
  });

  it('fills in its example in both languages and both layouts', () => {
    for (const type of MESSAGE_CATALOGUE) {
      for (const language of LANGUAGES) {
        for (const layout of ['plain', 'rich'] as const) {
          const text = renderMessage(type, language, layout, type.example);
          expect(text, `${type.id} ${language} ${layout}`).not.toMatch(/[{}]|undefined|NaN|\n\n\n/);
          expect(text.length, `${type.id} ${language} ${layout}`).toBeGreaterThan(20);
        }
      }
    }
  });
});

describe('filling in a text', () => {
  const type: MessageType = {
    ...(MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-RES-03') as MessageType),
  };

  it('chooses the words of a count, and writes numbers, sizes and dates as the language does', () => {
    const one = renderMessage(type, 'en', 'rich', { ...type.example, count: 1, changes: [{ field: 'lead_channel', change: 'added' }] });
    expect(one).toMatch(/^\*\*A field of Weekly lead volume changed since you confirmed it on 12 September 2026\*\*/);
    expect(renderMessage(type, 'nl', 'rich', type.example)).toMatch(/^\*\*2 velden van Weekly lead volume zijn gewijzigd sinds je de resource bekrachtigde op 12 september 2026\*\*/);
    const lens = MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-LEN-01') as MessageType;
    expect(renderMessage(lens, 'en', 'plain', lens.example)).toContain('one run reads 6.2 GB, above 1 GB');
    expect(renderMessage(lens, 'nl', 'plain', lens.example)).toContain('één run leest 6,2 GB, boven 1 GB');
    const logic = MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-RES-04') as MessageType;
    expect(renderMessage(logic, 'en', 'rich', { ...logic.example, distance: 0 })).toContain('the table of the resource itself');
    expect(renderMessage(logic, 'en', 'rich', { ...logic.example, distance: 3 })).toContain('3 steps upstream');
  });

  it('writes a list one item per line laid out, and as one line in plain text', () => {
    expect(renderMessage(type, 'en', 'rich', type.example)).toContain('- `lead_channel`: added\n- `lead_count`: its type changed from `INT64` to `NUMERIC`');
    expect(renderMessage(type, 'en', 'plain', type.example)).toContain('changed since you confirmed it: lead_channel added; lead_count retyped from INT64 to NUMERIC.');
  });

  it('leaves out a line whose optional value is empty, and the blank lines it leaves', () => {
    const lens = MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-LEN-01') as MessageType;
    const without = renderMessage(lens, 'en', 'rich', { ...lens.example, smaller: '' });
    expect(without).not.toContain('With a default for From');
    expect(without).toContain('- It reads 312 of 312 partitions\n\nUntil the data team decides');
    const decision = MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-CNV-05') as MessageType;
    expect(renderMessage(decision, 'en', 'plain', { ...decision.example, text: '' })).toBe('Dirk Vos accepted the request on the lens Credit funnel by region.');
  });

  it('refuses a required value that is missing, and a parameter it does not know', () => {
    expect(() => renderMessage(type, 'en', 'plain', { ...type.example, level: '' })).toThrow('no value for {level}');
    expect(() => renderMessage({ ...type, text: { ...type.text, en: { plain: '{nope}', rich: '' } } }, 'en', 'plain', type.example)).toThrow('unknown parameter {nope}');
  });

  it('lets a channel write each value its own way', () => {
    const remark = MESSAGE_CATALOGUE.find((t) => t.id === 'MSG-CNV-02') as MessageType;
    const slack = renderMessage(remark, 'en', 'plain', remark.example, { value: (value, name) => (name === 'subject' ? `<https://datahub/r|${value}>` : value) });
    expect(slack).toContain('the resource <https://datahub/r|Weekly lead volume>');
  });

  it('parses the part of the ICU message format it uses, and refuses the rest', () => {
    expect(parseTemplate('a {b} {c, plural, =0 {none} one {# x} other {# xs}}')).toEqual([
      'a ',
      { name: 'b' },
      ' ',
      { name: 'c', form: 'plural', branches: { '=0': ['none'], one: ['# x'], other: ['# xs'] } },
    ]);
    expect(() => parseTemplate('a {b')).toThrow('{b not closed');
    expect(() => parseTemplate('a }')).toThrow('unexpected }');
    expect(() => parseTemplate('{c, select, x {y}')).toThrow('without a key');
  });
});

describe('filling in a sentence of the interface (NFR-LOC-02)', () => {
  it('puts in a name as it is, and writes a number as its language writes it', () => {
    expect(renderText('Welkom, {name}', 'nl', { name: 'creditLead' })).toBe('Welkom, creditLead');
    expect(renderText('{count} rijen', 'nl', { count: 1234 })).toBe('1.234 rijen');
    expect(renderText('{count} rows', 'en', { count: 1234 })).toBe('1,234 rows');
  });

  it('chooses by a count or a value', () => {
    const template = '{count, plural, one {# kaart} other {# kaarten}}';
    expect(renderText(template, 'nl', { count: 1 })).toBe('1 kaart');
    expect(renderText(template, 'nl', { count: 14 })).toBe('14 kaarten');
    expect(renderText('{theme, select, dark {nacht} other {dag}}', 'nl', { theme: 'dark' })).toBe('nacht');
  });

  it('refuses a sentence without the value it needs', () => {
    expect(() => renderText('Welkom, {name}', 'en')).toThrow(/no value for \{name\}/);
  });
});

describe('the laid-out text of a Message (FR-CV-11)', () => {
  it('marks strong, struck and names as code, also a name in strong, and keeps an escaped mark as text', () => {
    expect(markedPieces('**`lead_count`** was ~~old~~ \\*not\\* `a*b`')).toEqual([
      { text: 'lead_count', strong: true, struck: false, code: true },
      { text: ' was ', strong: false, struck: false, code: false },
      { text: 'old', strong: false, struck: true, code: false },
      { text: ' *not* ', strong: false, struck: false, code: false },
      { text: 'a*b', strong: false, struck: false, code: true },
    ]);
    // A mark that does not close is text.
    expect(markedPieces('5 ** 2')).toEqual([{ text: '5 ** 2', strong: false, struck: false, code: false }]);
  });

  it('keeps paragraphs, items and quotes in the order they come', () => {
    const laid = textBlocks('**Two changed**\n\n> Why?\n\n**`lead_count`**\n- Before: x\n- Now: y');
    expect(laid.map((block) => block.kind)).toEqual(['paragraph', 'quote', 'paragraph', 'items']);
    expect(laid[3]).toMatchObject({ kind: 'items', items: [[{ text: 'Before: x' }], [{ text: 'Now: y' }]] });
  });
});

describe('the address of a Message in context (FR-CV-09)', () => {
  it('is the page of its object with the Message, or the Message Centre for an object without a page', () => {
    expect(contextPath({ kind: 'lens', id: 'l-1' }, 'm-1')).toBe('/lenses/l-1/messages/m-1');
    expect(contextPath({ kind: 'query', id: 'q 1' }, 'm-1')).toBe('/query/q%201/messages/m-1');
    expect(contextPath({ kind: 'learningCard', id: 'K3.4' }, 'm-1')).toBe('/learning/K3.4/messages/m-1');
    expect(contextPath({ kind: 'report', id: 'r-1' }, 'm-1')).toBe('/messages/m-1');
  });
});
