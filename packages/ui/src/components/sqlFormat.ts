import { bigquery, formatDialect } from 'sql-formatter';

/** One level of the house layout of the Data Team for dbt (`docs/sql-formatting.md` in immoscoop-dataplatform-data). */
const INDENT = '    ';

/** Date parts, as `interval 30 day` and `date_diff(…, day)` name them: in lower case, as every keyword (DEC-UX-228). */
const DATE_PARTS = /\b(?:MICROSECOND|MILLISECOND|SECOND|MINUTE|HOUR|DAYOFWEEK|DAYOFYEAR|DAY|ISOWEEK|WEEK|MONTH|QUARTER|ISOYEAR|YEAR)\b/g;

/** The SQL in pieces: code, and what stays as written: text in quotes, comments and names in backticks. */
function pieces(sql: string): { code: boolean; text: string }[] {
  const found: { code: boolean; text: string }[] = [];
  let code = '';
  let i = 0;
  const keep = (end: number) => {
    if (code) found.push({ code: true, text: code });
    code = '';
    found.push({ code: false, text: sql.slice(i, end) });
    i = end;
  };
  while (i < sql.length) {
    const c = sql[i] as string;
    if ((c === '-' && sql[i + 1] === '-') || c === '#') {
      const end = sql.indexOf('\n', i);
      keep(end < 0 ? sql.length : end);
    } else if (c === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      keep(end < 0 ? sql.length : end + 2);
    } else if (c === "'" || c === '"' || c === '`') {
      let end = i + 1;
      while (end < sql.length && sql[end] !== c) end += sql[end] === '\\' ? 2 : 1;
      keep(Math.min(end + 1, sql.length));
    } else {
      code += c;
      i += 1;
    }
  }
  if (code) found.push({ code: true, text: code });
  return found;
}

/** `with` on a line of its own, a blank line, the CTEs not indented with a blank line between them, and one before the query that reads them. */
function ctesUnindented(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (!/^with( recursive)?$/i.test(line)) {
      out.push(line);
      continue;
    }
    out.push(line, '');
    let j = i + 1;
    for (; j < lines.length && ((lines[j] as string).startsWith(INDENT) || lines[j] === ''); j += 1) {
      const inner = (lines[j] as string).slice(INDENT.length);
      out.push(inner);
      if (inner === '),') out.push('');
    }
    if (j < lines.length) out.push('');
    i = j - 1;
  }
  return out.join('\n');
}

/**
 * The SQL in the house layout of the Data Team for dbt, as far as a formatter goes (DEC-UX-228): sql-formatter for
 * BigQuery with keywords, functions and types in lower case, an indent of 4 spaces and a function call on one line up to
 * 100 characters; then the date parts in lower case, `interval (…)` with its space, and `with` with the CTEs not indented.
 * Throws when sql-formatter cannot read the SQL.
 */
export function formatBigQuery(sql: string): string {
  const formatted = formatDialect(sql, {
    dialect: bigquery,
    keywordCase: 'lower',
    functionCase: 'lower',
    dataTypeCase: 'lower',
    tabWidth: 4,
    expressionWidth: 100,
    paramTypes: { named: ['@'] },
  });
  const cased = pieces(formatted)
    .map((piece) => (piece.code ? piece.text.replace(DATE_PARTS, (part) => part.toLowerCase()).replace(/\binterval\(/gi, 'interval (') : piece.text))
    .join('');
  return ctesUnindented(cased);
}
