/**
 * What Data Hub reads from the SQL of a query before BigQuery sees it (DEC-UX-73, DEC-SR-35): the tables
 * it names, so that a query reads only its own Resources, and whether it filters on a partition column.
 * BigQuery has no parser to ask, so this reads the SQL as words: comments and strings are skipped, so a
 * keyword in them counts for nothing. The dry run of BigQuery checks the same query again (TR-SR-15).
 */

export interface Token {
  kind: 'word' | 'quoted' | 'string' | 'number' | 'param' | 'symbol';
  /** The text; for a quoted name, without its backticks. */
  text: string;
  start: number;
  end: number;
}

/** A table named in the SQL, or a table function, where it stands in the SQL. */
export interface Named {
  /** The name as written, its parts joined by dots, without backticks: `project.dataset.table`. */
  name: string;
  start: number;
  end: number;
}

export interface Tables {
  tables: Named[];
  /** Functions in the place of a table, such as `ML.PREDICT(...)` or `EXTERNAL_QUERY(...)`: never allowed. */
  functions: Named[];
}

/** The SQL as tokens, without whitespace and comments. */
export function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const at = (offset = 0) => sql[i + offset] ?? '';
  while (i < sql.length) {
    const c = at();
    if (/\s/.test(c)) {
      i += 1;
    } else if ((c === '-' && at(1) === '-') || c === '#') {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end + 1;
    } else if (c === '/' && at(1) === '*') {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
    } else if (c === '`') {
      const start = i;
      i += 1;
      let text = '';
      while (i < sql.length && at() !== '`') {
        if (at() === '\\' && i + 1 < sql.length) {
          text += at(1);
          i += 2;
        } else {
          text += at();
          i += 1;
        }
      }
      i += 1;
      tokens.push({ kind: 'quoted', text, start, end: Math.min(i, sql.length) });
    } else if (c === "'" || c === '"' || (/[rRbB]/.test(c) && stringPrefix(sql, i) > 0)) {
      const start = i;
      const prefix = c === "'" || c === '"' ? 0 : stringPrefix(sql, i);
      const raw = /r/i.test(sql.slice(i, i + prefix));
      i += prefix;
      const quote = at() === at(1) && at() === at(2) ? at().repeat(3) : at();
      i += quote.length;
      while (i < sql.length && !sql.startsWith(quote, i)) {
        i += !raw && at() === '\\' ? 2 : 1;
      }
      i = Math.min(i + quote.length, sql.length);
      tokens.push({ kind: 'string', text: sql.slice(start, i), start, end: i });
    } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(at(1)) && !/[\w`]/.test(sql[i - 1] ?? ''))) {
      // A dot followed by a name belongs to a path, as in `my-project-398214.dataset`, not to the number.
      const match = /^(?:\d+(?:\.(?![A-Za-z_`])\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(sql.slice(i)) as RegExpExecArray;
      tokens.push({ kind: 'number', text: match[0], start: i, end: i + match[0].length });
      i += match[0].length;
    } else if (c === '@') {
      const match = /^@@?[A-Za-z_][A-Za-z0-9_.]*/.exec(sql.slice(i));
      const text = match ? match[0] : '@';
      tokens.push({ kind: match ? 'param' : 'symbol', text, start: i, end: i + text.length });
      i += text.length;
    } else if (/[A-Za-z_]/.test(c)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i)) as RegExpExecArray;
      tokens.push({ kind: 'word', text: match[0], start: i, end: i + match[0].length });
      i += match[0].length;
    } else {
      tokens.push({ kind: 'symbol', text: c, start: i, end: i + 1 });
      i += 1;
    }
  }
  return tokens;
}

/** The length of the prefix of a string, such as r'…', b"…" or rb'''…''', or 0 where there is none. */
function stringPrefix(sql: string, i: number): number {
  const match = /^(?:[rR][bB]?|[bB][rR]?)(?=['"])/.exec(sql.slice(i, i + 3));
  // A prefix only where no word goes on before it, so that `bar'` is not read as a string.
  return match && !/[A-Za-z0-9_]/.test(sql[i - 1] ?? '') ? match[0].length : 0;
}

const is = (token: Token | undefined, ...words: string[]) => token?.kind === 'word' && words.includes(token.text.toLowerCase());
const symbol = (token: Token | undefined, text: string) => token?.kind === 'symbol' && token.text === text;
const isName = (token: Token | undefined) => token?.kind === 'word' || token?.kind === 'quoted';

/** Words after a table that end it rather than name it: the alias of a table is never one of them. */
const NOT_AN_ALIAS = new Set([
  'where', 'join', 'inner', 'left', 'right', 'full', 'cross', 'outer', 'on', 'using', 'group', 'order', 'limit', 'union',
  'except', 'intersect', 'window', 'qualify', 'having', 'tablesample', 'for', 'pivot', 'unpivot', 'with', 'select', 'from',
  'natural', 'lateral', 'offset',
]);

/** The index of the parenthesis that closes the one at `open`, or the end. */
function closing(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i += 1) {
    if (symbol(tokens[i], '(')) depth += 1;
    if (symbol(tokens[i], ')')) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return tokens.length;
}

/** The names of the CTEs, lowercase: `with a as (…), b as (…)`. */
function cteNames(tokens: Token[]): Set<string> {
  const names = new Set<string>();
  tokens.forEach((token, i) => {
    if (!is(token, 'with') || is(tokens[i + 1], 'offset')) return;
    let j = is(tokens[i + 1], 'recursive') ? i + 2 : i + 1;
    while (isName(tokens[j]) && is(tokens[j + 1], 'as') && symbol(tokens[j + 2], '(')) {
      names.add((tokens[j] as Token).text.toLowerCase());
      j = closing(tokens, j + 2) + 1;
      if (!symbol(tokens[j], ',')) break;
      j += 1;
    }
  });
  return names;
}

/** Whether two tokens touch, as the parts of `my-project.dataset.table` do. */
const touch = (a: Token | undefined, b: Token | undefined) => !!a && !!b && a.end === b.start;

/**
 * Reads a path from `i`: names joined by dots, and an unquoted project with dashes, as BigQuery allows.
 * Returns its parts, split at every dot also within backticks, and the index after it.
 */
function path(tokens: Token[], i: number): { parts: string[]; next: number } | null {
  if (!isName(tokens[i])) return null;
  let text = (tokens[i] as Token).text;
  let j = i + 1;
  for (;;) {
    const token = tokens[j];
    const after = tokens[j + 1];
    if (symbol(token, '.') && (isName(after) || after?.kind === 'number')) {
      text += `.${(after as Token).text}`;
      j += 2;
    } else if (symbol(token, '-') && touch(tokens[j - 1], token) && touch(token, after) && (after?.kind === 'word' || after?.kind === 'number')) {
      text += `-${(after as Token).text}`;
      j += 2;
    } else if (tokens[j - 1]?.kind === 'word' && token?.kind === 'number' && touch(tokens[j - 1], token)) {
      // A number that goes on a name, as in `my-project-123`, is read as a number token of its own.
      text += token.text;
      j += 1;
    } else {
      break;
    }
  }
  return { parts: text.split('.'), next: j };
}

/**
 * The tables a query names: every name after `from` and `join`, and after a comma in a list of `from`,
 * leaving out its CTEs, a subquery, `unnest(…)`, a path that starts at an alias (an array of a row) and the
 * `from` of `extract(… from …)` and `is distinct from`.
 */
export function tablesOf(sql: string): Tables {
  const tokens = tokenize(sql);
  const ctes = cteNames(tokens);
  const aliases = new Set<string>();
  const tables: Named[] = [];
  const functions: Named[] = [];
  // For each open parenthesis, the word before it: `extract(` holds a `from` that names no table.
  const openers: string[] = [];

  function item(i: number, list: boolean): void {
    const token = tokens[i];
    if (!token || symbol(token, '(') || (is(token, 'unnest') && symbol(tokens[i + 1], '('))) return;
    const found = path(tokens, i);
    if (!found) return;
    const { parts, next } = found;
    const named: Named = { name: parts.join('.'), start: token.start, end: (tokens[next - 1] as Token).end };
    if (symbol(tokens[next], '(')) {
      functions.push(named);
      return;
    }
    const first = (parts[0] as string).toLowerCase();
    const correlated = parts.length > 1 && aliases.has(first);
    const cte = parts.length === 1 && ctes.has(first);
    if (!correlated && !cte) tables.push(named);
    let j = next;
    if (is(tokens[j], 'as') && isName(tokens[j + 1])) {
      aliases.add((tokens[j + 1] as Token).text.toLowerCase());
      j += 2;
    } else if (isName(tokens[j]) && !NOT_AN_ALIAS.has((tokens[j] as Token).text.toLowerCase())) {
      aliases.add((tokens[j] as Token).text.toLowerCase());
      j += 1;
    }
    if (list && symbol(tokens[j], ',')) item(j + 1, true);
  }

  tokens.forEach((token, i) => {
    if (symbol(token, '(')) openers.push(tokens[i - 1]?.kind === 'word' ? (tokens[i - 1] as Token).text.toLowerCase() : '');
    if (symbol(token, ')')) openers.pop();
    if (is(token, 'from')) {
      if (openers.at(-1) === 'extract') return;
      if (is(tokens[i - 1], 'distinct') && is(tokens[i - 2], 'is', 'not')) return;
      item(i + 1, true);
    }
    if (is(token, 'join')) item(i + 1, false);
  });
  return { tables, functions };
}

/** Words that end a `where` at its own depth. */
const END_OF_WHERE = new Set(['group', 'having', 'qualify', 'window', 'order', 'limit', 'union', 'intersect', 'except']);

/**
 * Whether the query filters on this column: it is named in a `where` (DEC-SR-35, FR-SR-40). It does not
 * tell which table the `where` is about, nor whether the condition lets BigQuery read fewer partitions;
 * BigQuery's own check holds for a table that requires the filter.
 */
export function filtersOn(sql: string, column: string): boolean {
  const tokens = tokenize(sql);
  const wanted = column.toLowerCase();
  for (let i = 0; i < tokens.length; i += 1) {
    if (!is(tokens[i], 'where')) continue;
    let depth = 0;
    for (let j = i + 1; j < tokens.length; j += 1) {
      const token = tokens[j] as Token;
      if (symbol(token, '(')) depth += 1;
      if (symbol(token, ')')) depth -= 1;
      if (depth < 0 || symbol(token, ';') || (depth === 0 && token.kind === 'word' && END_OF_WHERE.has(token.text.toLowerCase()))) break;
      if (isName(token) && token.text.toLowerCase() === wanted) return true;
    }
  }
  return false;
}

/** The @names a query uses: its Parameters, which BigQuery needs a value for. */
export function parametersOf(sql: string): string[] {
  return [...new Set(tokenize(sql).filter((token) => token.kind === 'param' && !token.text.startsWith('@@')).map((token) => token.text.slice(1)))];
}

export interface TemplateResource {
  key: string;
  /** The full name of its table in its own case, which the SQL names. */
  fullName: string;
  fields: { name: string; dataType: string | null }[];
  partition: { field: string; unit: string | null } | null;
}

/** How far back the filter of a template looks, per unit of the partitions: about four weeks of days. */
const WINDOW: Record<string, [number, string]> = { hour: [24, 'hour'], day: [28, 'day'], month: [3, 'month'], year: [1, 'year'] };

/** A filter on the partition column that reads its recent partitions, for its type in BigQuery. */
export function recent(field: string, dataType: string | null, unit: string | null): string | null {
  const [count, part] = WINDOW[unit ?? 'day'] ?? [28, 'day'];
  const type = (dataType ?? 'DATE').toUpperCase();
  if (type === 'DATE') return `${field} >= date_sub(current_date(), interval ${part === 'hour' ? 1 : count} ${part === 'hour' ? 'day' : part})`;
  // timestamp_sub goes up to days only.
  const days = part === 'month' ? count * 30 : part === 'year' ? count * 365 : count;
  const unitOfTime = part === 'hour' ? 'hour' : 'day';
  if (type === 'TIMESTAMP') return `${field} >= timestamp_sub(current_timestamp(), interval ${days} ${unitOfTime})`;
  if (type === 'DATETIME') return `${field} >= datetime_sub(current_datetime(), interval ${days} ${unitOfTime})`;
  return null;
}

/** A name for a table in the SQL: the last part of its Key, as a CTE is named after it. */
const cteName = (key: string) => {
  const name = (key.split('.').at(-1) ?? 'resource').replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(name) ? name : `t_${name}`;
};

/**
 * The SQL a new query starts with (FR-SR-46): its fields from each Resource, with a filter on the
 * partition column where it has one; with more than one Resource, a CTE each.
 */
export function template(resources: TemplateResource[]): string {
  const select = (resource: TemplateResource, indent: string) => {
    const fields = resource.fields.length > 0 ? resource.fields.map((field) => field.name) : ['*'];
    const partitionType = resource.partition ? (resource.fields.find((field) => field.name === resource.partition?.field)?.dataType ?? null) : null;
    const filter = resource.partition ? recent(resource.partition.field, partitionType, resource.partition.unit) : null;
    return [
      `${indent}select ${fields.join(`,\n${indent}       `)}`,
      `${indent}from \`${resource.fullName}\``,
      ...(filter ? [`${indent}where ${filter}`] : []),
    ].join('\n');
  };
  if (resources.length === 0) return '';
  if (resources.length === 1) return `${select(resources[0] as TemplateResource, '')}\n`;
  const ctes = resources.map((resource) => `${cteName(resource.key)} as (\n${select(resource, '  ')}\n)`);
  return `with ${ctes.join(',\n')}\n\nselect *\nfrom ${cteName((resources[0] as TemplateResource).key)}\n`;
}

/**
 * Whether a name in the SQL is this Key: in full, or without its project when that is the project the query
 * runs in. In any case: the Key is in lower case, and BigQuery itself tells a name in the wrong case.
 */
export function names(written: string, key: string, project: string): boolean {
  const name = written.toLowerCase();
  if (name === key) return true;
  const [keyProject, ...rest] = key.split('.');
  return keyProject === project.toLowerCase() && name === rest.join('.');
}

/**
 * The SQL with every table that names one of these Resources written as BigQuery knows it: its full name in
 * its own case, quoted (DEC-SR-44). Data Hub knows a Resource whatever the case it is written in; BigQuery
 * names are case-sensitive, so this is the SQL it gets. Everything else stays as it was written.
 */
export function inOwnCase(sql: string, resources: readonly { key: string; fullName: string }[], project: string): string {
  const named = tablesOf(sql)
    .tables.flatMap((table) => {
      const resource = resources.find((candidate) => names(table.name, candidate.key, project));
      return resource && table.name !== resource.fullName ? [{ table, fullName: resource.fullName }] : [];
    })
    .toSorted((a, b) => b.table.start - a.table.start);
  return named.reduce((text, { table, fullName }) => `${text.slice(0, table.start)}\`${fullName}\`${text.slice(table.end)}`, sql);
}

/** Words that may follow a table where a `where` can still go in between. */
const BEFORE_WHERE = new Set(['group', 'having', 'qualify', 'window', 'order', 'limit', 'union', 'intersect', 'except']);

/**
 * The SQL with a filter added where it reads this table (DEC-SR-35, "Add the filter"): into the `where`
 * that follows the table and its alias, or as a new `where` when none does. Null where Data Hub cannot
 * tell where it goes, such as before a join.
 */
export function withFilter(sql: string, matches: (name: string) => boolean, filter: string): string | null {
  const table = tablesOf(sql).tables.find((named) => matches(named.name));
  if (!table) return null;
  const tokens = tokenize(sql).filter((token) => token.start >= table.end);
  let i = 0;
  if (is(tokens[0], 'as') && isName(tokens[1])) i = 2;
  else if (isName(tokens[0]) && !NOT_AN_ALIAS.has((tokens[0] as Token).text.toLowerCase())) i = 1;
  const after = i > 0 ? (tokens[i - 1] as Token).end : table.end;
  const next = tokens[i];
  if (is(next, 'where')) {
    const at = (next as Token).end;
    return `${sql.slice(0, at)} ${filter} and${sql.slice(at)}`;
  }
  if (!next || symbol(next, ')') || symbol(next, ';') || (next.kind === 'word' && BEFORE_WHERE.has(next.text.toLowerCase()))) {
    return `${sql.slice(0, after)}\nwhere ${filter}${sql.slice(after)}`;
  }
  return null;
}

/** Comparisons an @name stands in, each a symbol of its own: `<=` is `<` and `=`. */
const COMPARING = new Set(['=', '<', '>', '!']);

/**
 * The column an @name is compared with, as in `lead_channel = @leadChannel` or `week_start between @from and
 * @to`, and whether it stands for a list, as in `lead_channel in unnest(@channels)`. The kind of a new
 * Parameter is suggested from it (DEC-UX-71).
 */
export function comparedWith(sql: string, start: number): { column: string | null; list: boolean } {
  const tokens = tokenize(sql);
  const at = tokens.findIndex((token) => token.kind === 'param' && token.start === start);
  if (at < 0) return { column: null, list: false };
  const nameAt = (i: number) => (isName(tokens[i]) ? (tokens[i] as Token).text : null);
  if (symbol(tokens[at - 1], '(') && is(tokens[at - 2], 'unnest') && is(tokens[at - 3], 'in')) {
    return { column: nameAt(is(tokens[at - 4], 'not') ? at - 5 : at - 4), list: true };
  }
  let i = at - 1;
  if (tokens[i]?.kind === 'symbol' && COMPARING.has((tokens[i] as Token).text)) {
    while (tokens[i]?.kind === 'symbol' && COMPARING.has((tokens[i] as Token).text)) i -= 1;
    return { column: nameAt(i), list: false };
  }
  if (is(tokens[i], 'between')) return { column: nameAt(i - 1), list: false };
  if (is(tokens[i], 'and') && tokens[i - 1]?.kind === 'param' && is(tokens[i - 2], 'between')) return { column: nameAt(i - 3), list: false };
  // Written the other way round: `@leadChannel = lead_channel`.
  let j = at + 1;
  if (tokens[j]?.kind === 'symbol' && COMPARING.has((tokens[j] as Token).text)) {
    while (tokens[j]?.kind === 'symbol' && COMPARING.has((tokens[j] as Token).text)) j += 1;
    // The last part of a path, as in `v.lead_channel`.
    while (isName(tokens[j]) && symbol(tokens[j + 1], '.') && isName(tokens[j + 2])) j += 2;
    return { column: nameAt(j), list: false };
  }
  return { column: null, list: false };
}
