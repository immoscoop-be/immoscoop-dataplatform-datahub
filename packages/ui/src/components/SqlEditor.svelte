<script module lang="ts">
  /** A column the editor suggests: of a Resource of the query, with its type and its descriptions (DEC-UX-115). */
  export interface Suggestion {
    name: string;
    type: string | null;
    /** The Display Name of its Resource. */
    resource: string;
    /** Partition or cluster column: these come first, marked as such (FR-SR-42). */
    role: { kind: 'partition' } | { kind: 'cluster'; place: number } | null;
    description: string;
    businessDescription: string;
  }

  /** A stretch of the SQL that stands out as an error, such as a table outside the Resources of the query. */
  export interface ErrorMark {
    from: number;
    to: number;
    message: string;
  }

  /** The CTEs of the SQL: a line that ends in `name as (`. */
  export const CTE_LINE = /\bas\s*\(\s*$/i;
</script>

<script lang="ts">
  import { autocompletion, type Completion, type CompletionContext, completionKeymap } from '@codemirror/autocomplete';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { SQLDialect } from '@codemirror/lang-sql';
  import { codeFolding, foldedRanges, foldEffect, foldGutter, foldKeymap, foldNodeProp, foldService, HighlightStyle, LanguageSupport, syntaxHighlighting } from '@codemirror/language';
  import { EditorState, type Range, StateEffect, StateField } from '@codemirror/state';
  import { Decoration, type DecorationSet, EditorView, keymap, lineNumbers } from '@codemirror/view';
  import { tags } from '@lezer/highlight';
  import { bigquery, formatDialect } from 'sql-formatter';
  import { onMount } from 'svelte';
  import { ICONS } from '../foundations/icons.js';
  import { t } from '../foundations/texts.svelte.js';

  /**
   * The SQL of a query, at the full width of its box (SQL editor, DEC-UX-70): BigQuery SQL, with backtick
   * names, `#` comments and `@` Parameters. It folds every CTE to its first line, with an arrow in the
   * gutter and "⋯ n lines" in its place, and the line numbers keep their count; a folded CTE with an error
   * in it shows it on its "⋯ n lines". It suggests the columns of the Resources of the query, partition
   * and cluster columns first and marked, and beside the list the type and descriptions of the one that
   * is selected (FR-SR-42, DEC-UX-115). It formats on request, Shift+Alt+F (sql-formatter, which knows
   * BigQuery). What stands out as an error is given by the Pre-flight.
   */
  let {
    value = $bindable(),
    suggestions,
    marks = [],
    label,
    readonly = false,
    nonce,
  }: {
    value: string;
    suggestions: readonly Suggestion[];
    marks?: readonly ErrorMark[];
    label: string;
    readonly?: boolean;
    /** The nonce of the page: CodeMirror adds its own styles, which the Content Security Policy allows by it. */
    nonce?: string;
  } = $props();

  let host: HTMLDivElement;
  let view: EditorView | undefined;

  /** BigQuery as a dialect of SQL: its keywords, functions and types, backtick names, double-quoted strings, `#` comments and `@` Parameters. */
  const BIGQUERY = SQLDialect.define({
    keywords:
      'all and any array as asc assert_rows_modified at between by case cast collate contains create cross cube current default define desc distinct else end enum escape except exclude exists extract false fetch following for from full group grouping groups hash having if ignore in inner intersect interval into is join lateral left like limit lookup merge natural new no not null nulls of offset on or order outer over partition preceding proto qualify range recursive respect right rollup rows select set some struct tablesample then to treat true unbounded union unnest using when where window with within replace pivot unpivot',
    builtin:
      'count sum avg min max any_value array_agg string_agg countif logical_and logical_or approx_count_distinct coalesce ifnull nullif if safe_cast safe_divide date_trunc date_add date_sub date_diff timestamp_trunc timestamp_add timestamp_sub timestamp_diff datetime_trunc datetime_add datetime_sub format_date parse_date current_date current_timestamp current_datetime extract lower upper concat length substr trim regexp_contains regexp_extract split round floor ceil abs mod div row_number rank dense_rank lag lead first_value last_value generate_date_array',
    types: 'int64 float64 numeric bignumeric bool string bytes date datetime time timestamp geography json interval',
    identifierQuotes: '`',
    doubleQuotedStrings: true,
    backslashEscapes: true,
    hashComments: true,
    specialVar: '@',
    caseInsensitiveIdentifiers: true,
  });
  // The language folds a whole statement from its first line; here only the CTEs fold.
  const language = new LanguageSupport(BIGQUERY.language.configure({ props: [foldNodeProp.add({ Statement: () => null })] }));

  /** Where the parenthesis that opens at `open` closes, strings and comments skipped; -1 when it does not. */
  function closing(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i += 1) {
      const c = text[i];
      if (c === '-' && text[i + 1] === '-') i = text.indexOf('\n', i) < 0 ? text.length : text.indexOf('\n', i);
      else if (c === "'" || c === '"' || c === '`') {
        const end = text.indexOf(c, i + 1);
        i = end < 0 ? text.length : end;
      } else if (c === '(') depth += 1;
      else if (c === ')') {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  /** Each CTE folds from its opening parenthesis to its closing one. */
  const ctes = foldService.of((state, from, to) => {
    const line = state.doc.sliceString(from, to);
    if (!CTE_LINE.test(line)) return null;
    const open = from + line.lastIndexOf('(');
    const close = closing(state.doc.toString(), open);
    return close > state.doc.lineAt(open).to ? { from: open + 1, to: close } : null;
  });

  const setMarks = StateEffect.define<readonly ErrorMark[]>();
  const errors = StateField.define<{ marks: readonly ErrorMark[]; decorations: DecorationSet }>({
    create: () => ({ marks: [], decorations: Decoration.none }),
    update(field, transaction) {
      let next = { marks: field.marks, decorations: field.decorations.map(transaction.changes) };
      for (const effect of transaction.effects) {
        if (!effect.is(setMarks)) continue;
        const length = transaction.state.doc.length;
        const ranges: Range<Decoration>[] = effect.value
          .filter((mark) => mark.from < mark.to && mark.to <= length)
          .map((mark) => Decoration.mark({ class: 'cm-outside', attributes: { title: mark.message } }).range(mark.from, mark.to));
        next = { marks: effect.value, decorations: Decoration.set(ranges, true) };
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
  });

  /** "⋯ n lines" in the place of a folded CTE, marked when an error is in it. */
  const folding = codeFolding({
    preparePlaceholder(state, range) {
      const lines = state.doc.lineAt(range.to).number - state.doc.lineAt(range.from).number + 1;
      const error = state.field(errors).marks.some((mark) => mark.from < range.to && mark.to > range.from);
      return { lines, error };
    },
    placeholderDOM(_view, onclick, prepared: { lines: number; error: boolean }) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = prepared.error ? 'cm-fold-lines cm-fold-error' : 'cm-fold-lines';
      button.textContent = t('editor.lines', { count: String(prepared.lines) });
      button.setAttribute('aria-label', t('editor.unfold'));
      button.onclick = onclick;
      return button;
    },
  });

  const arrow = (open: boolean) => {
    const span = document.createElement('span');
    span.className = open ? 'cm-fold-arrow' : 'cm-fold-arrow cm-fold-closed';
    span.innerHTML = ICONS['caret-down'];
    span.title = t(open ? 'editor.fold' : 'editor.unfold');
    return span;
  };

  const style = HighlightStyle.define([
    { tag: tags.special(tags.string), class: 'cm-key' },
    { tag: tags.special(tags.name), class: 'cm-param' },
    { tag: [tags.lineComment, tags.blockComment], class: 'cm-comment' },
    { tag: tags.string, class: 'cm-string' },
  ]);

  const ROLE_ORDER = (suggestion: Suggestion) => (suggestion.role?.kind === 'partition' ? 0 : suggestion.role?.kind === 'cluster' ? suggestion.role.place : 99);

  /** The beside of a suggestion: its type, its Resource and both its descriptions, each with where it comes from. */
  function info(suggestion: Suggestion): HTMLElement {
    const box = document.createElement('div');
    box.className = 'cm-field-info';
    const head = document.createElement('div');
    head.className = 'cm-field-head';
    const name = document.createElement('span');
    name.className = 'cm-field-name';
    name.textContent = suggestion.name;
    const meta = document.createElement('span');
    meta.className = 'cm-field-meta';
    meta.textContent = [suggestion.type, suggestion.resource].filter(Boolean).join(' · ');
    head.append(name, meta);
    box.append(head);
    const describe = (origin: string, text: string, dbt: boolean) => {
      const paragraph = document.createElement('p');
      if (dbt) paragraph.className = 'cm-field-dbt';
      const tag = document.createElement('span');
      tag.className = 'cm-origin';
      tag.textContent = origin;
      paragraph.append(tag, document.createTextNode(text));
      box.append(paragraph);
    };
    if (suggestion.businessDescription) describe(t('origin.owner'), suggestion.businessDescription, false);
    describe(t('origin.dbt'), suggestion.description || '–', true);
    return box;
  }

  type Suggested = Completion & { role: Suggestion['role'] };

  function complete(context: CompletionContext) {
    const word = context.matchBefore(/[\w]+/);
    if (!word && !context.explicit) return null;
    const options: Suggested[] = [...suggestions]
      .sort((a, b) => ROLE_ORDER(a) - ROLE_ORDER(b))
      .map((suggestion, index) => ({
        label: suggestion.name,
        detail: suggestion.type ?? undefined,
        boost: 99 - index,
        role: suggestion.role,
        info: () => info(suggestion),
      }));
    return { from: word?.from ?? context.pos, options, validFor: /^\w*$/ };
  }

  /** Writes the SQL in the layout of sql-formatter, for BigQuery; SQL it cannot read stays as it is. */
  export function formatSql(): boolean {
    if (!view || readonly) return false;
    try {
      // Only the dialect of BigQuery, so that the page carries no other.
      const formatted = formatDialect(view.state.doc.toString(), { dialect: bigquery, keywordCase: 'lower', tabWidth: 2, paramTypes: { named: ['@'] } });
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
      return true;
    } catch {
      return false;
    }
  }

  /** Folds every CTE to its first line (Fold all). */
  export function foldAll(): void {
    if (!view) return;
    const { state } = view;
    const folded = foldedRanges(state);
    const effects: StateEffect<{ from: number; to: number }>[] = [];
    for (let number = 1; number <= state.doc.lines; number += 1) {
      const line = state.doc.line(number);
      const range = state.facet(foldService)[0]?.(state, line.from, line.to);
      if (!range) continue;
      let already = false;
      folded.between(range.from, range.to, (from, to) => {
        if (from === range.from && to === range.to) already = true;
      });
      if (!already) effects.push(foldEffect.of(range));
    }
    if (effects.length) view.dispatch({ effects });
  }

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...(nonce ? [EditorView.cspNonce.of(nonce)] : []),
          lineNumbers(),
          errors,
          folding,
          ctes,
          foldGutter({ markerDOM: arrow }),
          history(),
          language,
          syntaxHighlighting(style),
          autocompletion({
            override: [complete],
            icons: false,
            addToOptions: [
              {
                render(completion) {
                  const role = (completion as Suggested).role;
                  if (!role) return null;
                  const pill = document.createElement('span');
                  pill.className = 'cm-role';
                  pill.textContent = role.kind === 'partition' ? t('editor.partition') : t('editor.cluster', { place: String(role.place) });
                  return pill;
                },
                position: 85,
              },
            ],
          }),
          keymap.of([{ key: 'Shift-Alt-f', run: () => formatSql() }, indentWithTab, ...completionKeymap, ...foldKeymap, ...historyKeymap, ...defaultKeymap]),
          EditorState.readOnly.of(readonly),
          EditorView.editable.of(!readonly),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) value = update.state.doc.toString();
          }),
        ],
      }),
    });
    view.dispatch({ effects: setMarks.of(marks) });
    return () => view?.destroy();
  });

  // The SQL changed from outside, such as a Parameter defined or a filter added: the editor follows.
  $effect(() => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  });
  $effect(() => {
    view?.dispatch({ effects: setMarks.of(marks) });
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor { font-size: 12.5px; }
  .editor :global(.cm-editor) { background: none; color: var(--text-primary); }
  .editor :global(.cm-editor.cm-focused) { outline: none; }
  .editor :global(.cm-scroller) { font-family: var(--font-mono); line-height: 1.65; }
  .editor :global(.cm-content) { padding: 0; caret-color: var(--text-primary); }
  .editor :global(.cm-line) { padding-left: 12px; }
  .editor :global(.cm-cursor) { border-left-color: var(--text-primary); }
  .editor :global(.cm-selectionBackground), .editor :global(.cm-focused .cm-selectionBackground) { background: var(--tint-active); }
  .editor :global(.cm-activeLine) { background: none; }
  .editor :global(.cm-gutters) { background: none; border-right: 1px solid var(--tint-active); color: var(--text-muted); }
  .editor :global(.cm-lineNumbers .cm-gutterElement) { min-width: 26px; padding: 0 8px 0 0; text-align: right; }
  .editor :global(.cm-foldGutter .cm-gutterElement) { width: 22px; display: flex; align-items: center; justify-content: center; }
  .editor :global(.cm-fold-arrow) { display: inline-flex; width: 18px; height: 18px; align-items: center; justify-content: center; border-radius: var(--radius-sm); cursor: pointer; color: var(--text-muted); }
  .editor :global(.cm-fold-arrow:hover) { background: var(--tint-active); color: var(--text-primary); }
  .editor :global(.cm-fold-arrow svg) { width: 12px; height: 12px; fill: currentColor; transition: transform var(--motion-fold) ease; }
  .editor :global(.cm-fold-closed svg) { transform: rotate(-90deg); }
  .editor :global(.cm-fold-lines) { font: var(--text-meta) var(--font-family); color: var(--text-secondary); background: var(--tint-active); border: 0; border-radius: var(--radius-sm); padding: 0 7px; margin: 0 3px; cursor: pointer; vertical-align: 1px; }
  .editor :global(.cm-fold-lines:hover) { color: var(--text-primary); }
  .editor :global(.cm-fold-error) { color: var(--signal-warn); outline: 1.5px solid var(--signal-warn); }
  .editor :global(.cm-key) { color: var(--col-slate); }
  .editor :global(.cm-param) { color: var(--col-magenta); }
  .editor :global(.cm-comment) { color: var(--text-muted); }
  .editor :global(.cm-string) { color: var(--col-teal-ink); }
  .editor :global(.cm-outside) { color: var(--signal-warn); text-decoration: underline wavy var(--signal-warn); text-underline-offset: 3px; background: color-mix(in srgb, var(--signal-warn) 12%, transparent); border-radius: var(--radius-sm); }
  .editor :global(.cm-tooltip) { border: 0; background: none; }
  .editor :global(.cm-tooltip-autocomplete) { padding: 5px; border-radius: var(--radius-sm); background: var(--surface-solid); box-shadow: var(--sheet-shadow); outline: 1px solid var(--tint-active); font-family: var(--font-family); font-size: var(--text-small); }
  .editor :global(.cm-tooltip-autocomplete > ul) { font-family: var(--font-family); max-height: 16em; min-width: 300px; }
  .editor :global(.cm-tooltip-autocomplete > ul > li) { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: var(--radius-sm); color: var(--text-primary); }
  .editor :global(.cm-tooltip-autocomplete > ul > li[aria-selected]) { background: var(--tint-hover); color: var(--text-primary); }
  .editor :global(.cm-completionLabel) { flex: 1; font-family: var(--font-mono); }
  .editor :global(.cm-completionMatchedText) { text-decoration: none; font-weight: var(--weight-medium); }
  .editor :global(.cm-completionDetail) { margin-left: auto; font-style: normal; color: var(--text-muted); font-size: var(--text-meta); }
  .editor :global(.cm-role) { font-size: 10px; color: var(--text-primary); background: var(--tint-active); padding: 2px 7px; border-radius: var(--radius-pill); white-space: nowrap; }
  .editor :global(.cm-completionInfo) { width: 270px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-solid); box-shadow: var(--sheet-shadow); outline: 1px solid var(--tint-active);
    font-family: var(--font-family); font-size: var(--text-meta); line-height: 1.5; color: var(--text-primary); white-space: normal; }
  .editor :global(.cm-field-head) { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .editor :global(.cm-field-name) { font-family: var(--font-mono); }
  .editor :global(.cm-field-meta) { color: var(--text-muted); }
  .editor :global(.cm-field-info p) { margin: 8px 0 0; }
  .editor :global(.cm-field-dbt) { color: var(--text-secondary); }
  .editor :global(.cm-origin) { display: table; margin: 0 0 3px; font-size: 10px; color: var(--text-muted); background: var(--surface-sub); padding: 1px 8px; border-radius: var(--radius-pill); }
</style>
