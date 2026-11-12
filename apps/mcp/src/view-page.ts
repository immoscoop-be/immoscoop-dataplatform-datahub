/**
 * The page of the MCP App of Data Hub (FR-CL-01): one page that shows a Resource (FR-CL-07), a Preview
 * (FR-CL-09), a publication (FR-CL-12) or the result of a query (FR-CL-21), by the `view` of the tool result.
 * It stands on its own, without the navigation of Data Hub, and carries "Open in Data Hub" (FR-CL-06). The
 * buttons that approve, send a Request or publish call tools only the MCP App may call (DEC-CL-07). For a User
 * whose results show in a card only, it reads the rows itself, through tools only it may call, says under the grid
 * that Claude does not read them, and tells Claude no value of them (FR-CL-28, DEC-UX-193).
 *
 * The sandbox in Claude loads nothing from outside, so the MCP Apps SDK is inlined at `BUNDLE` (view.ts),
 * and the values below are those of docs/design/tokens.css, which a test keeps in step (DEC-PF-28).
 */
export const VIEW_PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Data Hub</title>
<style>
:root {
  --font-family: 'Poppins', system-ui, sans-serif;
  --font-mono: ui-monospace, Menlo, monospace;
  --weight-medium: 500;
  --text-body: 13px;
  --text-small: 12px;
  --text-meta: 11px;
  --radius-chip: 7px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-pill: 999px;
  --col-magenta: #DD2C88;
  --col-teal-ink: #2A9690;
  --surface-solid: #FFFFFF;
  --surface-sub: #F7F5F2;
  --tint-hover: #EFECE8;
  --tint-active: #E3DFD9;
  --text-primary: #34302C;
  --text-secondary: #5E5852;
  --text-muted: #8C857E;
  --signal-warn: #B07A28;
  --signal-urgent: #C4432F;
}
[data-theme="dark"] {
  --surface-solid: #322E2A;
  --surface-sub: #3A3632;
  --tint-hover: #3B3732;
  --tint-active: #4A453F;
  --text-primary: #EDE9E4;
  --text-secondary: #BDB6AE;
  --text-muted: #8F877F;
  --signal-warn: #D9A453;
  --signal-urgent: #E2725E;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; background: transparent; }
body { font-family: var(--font-family); font-size: var(--text-body); color: var(--text-primary); line-height: 1.5; }
#root { border-radius: 16px; background: var(--surface-solid); outline: 1px solid var(--tint-active); outline-offset: -1px; padding: 14px 16px 16px; display: grid; gap: 12px; }
.meta { font-size: var(--text-meta); color: var(--text-muted); display: block; }
.ci { display: inline-flex; vertical-align: -2px; margin-right: 4px; }
.ci svg { width: 14px; height: 14px; }
.mono { font-family: var(--font-mono); }
.title { font-size: 15px; font-weight: var(--weight-medium); }
.head { display: flex; align-items: flex-start; gap: 10px; }
.head > div { flex: 1; min-width: 0; }
.row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.status { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-sub); padding: 4px 10px; border-radius: var(--radius-pill); }
.status.warn { color: var(--signal-warn); }
.bars { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 11px; }
.bars i { width: 3px; border-radius: 1px; background: var(--tint-active); }
.bars i.on { background: var(--text-primary); }
.alert { display: flex; gap: 10px; padding: 10px 14px; border-radius: var(--radius-md); background: color-mix(in srgb, var(--signal-warn) 13%, var(--surface-solid)); font-size: var(--text-small); }
.tabs { display: flex; gap: 2px; }
.tab { font: inherit; background: none; border: 0; padding: 6px 12px; border-radius: var(--radius-sm); color: var(--text-muted); cursor: pointer; }
.tab.on { background: var(--surface-sub); color: var(--text-primary); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.tile { border-radius: var(--radius-md); padding: 12px 14px; background: var(--surface-sub); font-size: var(--text-small); }
.tile.wide { grid-column: 1 / -1; }
.label { font-size: var(--text-meta); color: var(--text-muted); margin-bottom: 6px; }
.origin { font-size: 10px; color: var(--text-muted); background: var(--surface-solid); padding: 1px 8px; border-radius: var(--radius-pill); margin-left: 6px; }
.pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.pair p { margin: 4px 0 0; }
.chip { display: inline-block; font: var(--text-meta) var(--font-mono); color: var(--text-secondary); background: var(--surface-solid); padding: 3px 8px; border-radius: var(--radius-chip); margin: 0 4px 4px 0; }
.pill { font-size: 10px; color: var(--text-secondary); background: var(--tint-hover); padding: 2px 7px; border-radius: var(--radius-pill); margin-right: 4px; white-space: nowrap; }
dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
dt { color: var(--text-muted); }
dd { margin: 0; }
table { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
th { text-align: left; font-weight: var(--weight-medium); color: var(--text-secondary); padding: 6px 8px; border-bottom: 1px solid var(--tint-active); vertical-align: bottom; }
td { padding: 6px 8px; border-bottom: 1px solid var(--tint-hover); vertical-align: top; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
th small { display: block; font: 10px var(--font-mono); color: var(--text-muted); }
.scroll { overflow: auto; max-height: 420px; border-radius: var(--radius-md); outline: 1px solid var(--tint-active); }
.params { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-sub); }
.params label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-small); color: var(--text-muted); }
select, input, textarea { font: var(--text-small) var(--font-family); color: var(--text-primary); background: var(--surface-solid); border: 1px solid var(--tint-active); border-radius: var(--radius-sm); padding: 5px 8px; }
textarea { width: 100%; resize: vertical; }
.preflight { margin-left: auto; font-size: var(--text-meta); color: var(--text-secondary); background: var(--surface-solid); padding: 4px 10px; border-radius: var(--radius-pill); }
.foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; border-top: 1px solid var(--tint-hover); padding-top: 12px; font-size: var(--text-meta); color: var(--text-muted); }
.foot a { margin-left: auto; }
a { color: var(--text-primary); cursor: pointer; }
button.primary, button.quiet { font: var(--weight-medium) var(--text-small) var(--font-family); border-radius: var(--radius-pill); padding: 7px 14px; cursor: pointer; border: 0; }
button.primary { background: var(--text-primary); color: var(--surface-solid); }
button.primary.high { background: var(--signal-urgent); color: #fff; }
button.quiet { background: var(--surface-solid); color: var(--text-primary); outline: 1px solid var(--tint-active); }
button:disabled { opacity: .4; cursor: default; }
.pager { display: inline-flex; gap: 6px; margin-left: auto; align-items: center; }
.declare { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; border-radius: var(--radius-md); outline: 1px solid var(--tint-active); }
.declare label { flex: 1; display: flex; gap: 10px; align-items: flex-start; font-size: var(--text-small); }
.checks div { padding: 2px 0; font-size: var(--text-small); }
pre { margin: 8px 0 0; padding: 10px 12px; border-radius: var(--radius-md); background: var(--surface-solid); font: 12px/1.6 var(--font-mono); white-space: pre-wrap; }
summary { cursor: pointer; font-size: var(--text-meta); color: var(--text-muted); }
.error { color: var(--signal-urgent); font-size: var(--text-small); }
/* In a card only: one line under the foot of the grid, that Claude does not read its rows (FR-CL-28, DEC-UX-193) */
.result-private { display: flex; align-items: center; gap: 6px; margin: 0; font-size: var(--text-meta); color: var(--text-muted); }
.result-private svg { flex: none; width: 14px; height: 14px; }
/* The Summary of a Resource, as the Overview of Data Hub shows it (FR-CL-26) */
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: var(--text-meta); color: var(--text-muted); }
.legend .weight { margin-left: 8px; }
.legend .weight:first-child { margin-left: 0; }
.weight { font-size: 10px; font-weight: var(--weight-medium); padding: 2px 8px; border-radius: var(--radius-pill); white-space: nowrap; }
.weight.w1 { color: var(--surface-solid); background: var(--text-primary); }
.weight.w2 { color: var(--text-primary); background: var(--tint-active); }
.weight.w3 { color: var(--text-primary); outline: 1px solid var(--text-muted); outline-offset: -1px; }
.weight.w4 { color: var(--text-muted); background: var(--tint-hover); }
.sum { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.sum-part { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 12px; padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-sub); }
.sum-side { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.sum-n { font-size: 18px; font-weight: var(--weight-medium); line-height: 1; }
.sum-title { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.sum-title h3 { flex: 1; margin: 0; font-size: var(--text-body); font-weight: var(--weight-medium); }
.sum-main { font-size: var(--text-small); color: var(--text-secondary); line-height: 1.6; min-width: 0; overflow-wrap: anywhere; }
.sum-main p { margin: 0 0 6px; }
.sum-main p:last-child { margin-bottom: 0; }
.sum-main ul { margin: 0 0 6px; padding-left: 18px; }
.sum-main ul ul { margin: 2px 0 0; }
.sum-main .md { color: var(--text-primary); }
.sum-main .md strong { font-weight: var(--weight-medium); }
.sum-main code { font: 11px var(--font-mono); }
.sum-main .origin { margin: 0 6px 0 0; background: var(--surface-solid); }
.link { font: inherit; background: none; border: 0; padding: 0; color: var(--text-secondary); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
/* Fold: every MCP App folds to its head with the button at its top right (FR-CL-27, DEC-UX-181) */
#root > .head, #root > .head-row { position: relative; }
.fold { flex: none; width: 28px; height: 28px; margin: -4px -6px 0 0; display: inline-flex; align-items: center; justify-content: center; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text-muted); cursor: pointer; }
.fold:hover { background: var(--surface-sub); color: var(--text-primary); }
.fold svg { width: 14px; height: 14px; transition: transform .2s ease; }
#root.folded .fold svg { transform: rotate(180deg); }
#root.folded > :not(.head) { display: none; }
/* On a phone (FR-CL-27, DEC-UX-180): the frame takes the width of the screen, 360 px or less */
#root, #root > * { min-width: 0; }
.mono { overflow-wrap: anywhere; }
@media (max-width: 520px) {
  #root { padding: 12px; gap: 10px; }
  .head { flex-wrap: wrap; }
  .head > div { flex: 1 1 180px; }
  .fold { width: 44px; height: 44px; margin: -10px -10px 0 0; }
  .tabs { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
  .tab { min-height: 44px; }
  .sum-part { grid-template-columns: minmax(0, 1fr); gap: 6px; padding: 12px; }
  .sum-side { flex-direction: row; align-items: center; gap: 8px; }
  .sum-n { font-size: 16px; }
  .legend .weight { margin-left: 0; }
  dl { grid-template-columns: minmax(0, 1fr); gap: 0; }
  dt { margin-top: 6px; }
  dt:first-child { margin-top: 0; }
  table.stack thead { display: none; }
  table.stack, table.stack tbody, table.stack tr, table.stack td { display: block; }
  table.stack tr { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 10px; align-items: baseline; padding: 10px 2px; border-bottom: 1px solid var(--tint-hover); }
  table.stack td { grid-column: 1 / -1; padding: 2px 0; border: 0; }
  table.stack td.name { grid-column: 1; font-size: var(--text-body); }
  table.stack td.type { grid-column: 2; }
  table.stack td[data-label]::before { content: attr(data-label); display: block; font-size: var(--text-meta); color: var(--text-muted); margin-top: 6px; }
  .params { flex-direction: column; align-items: stretch; }
  .params label { display: grid; grid-template-columns: auto minmax(0, 1fr); }
  .params select, .params input { min-height: 40px; }
  .preflight { margin-left: 0; align-self: flex-start; }
  .pager { margin-left: 0; width: 100%; justify-content: space-between; }
  .pager button { min-width: 40px; min-height: 40px; }
  .declare { flex-direction: column; align-items: stretch; padding: 12px; }
  button.primary, button.quiet { width: 100%; min-height: 44px; }
  .foot { flex-direction: column; align-items: stretch; }
  .foot a { margin-left: 0; text-align: center; padding: 12px; border-radius: var(--radius-pill); outline: 1px solid var(--tint-active); }
}
</style>
</head>
<body>
<main id="root"><p class="meta">Data Hub</p></main>
<script type="module">
/*BUNDLE*/
const { App } = McpApps;
const app = new App({ name: 'Data Hub', version: '1' }, { availableDisplayModes: ['inline', 'fullscreen'] });
const root = document.getElementById('root');
let view = null;
let tab = 'summary';
let folded = false;
// In a card only (FR-CL-28): set once a result says so; and the choices of a Preview the MCP App read itself, by Resource and window.
let cardOnly = false;
let keptChoices = { key: null, choices: null };

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const levelOf = (name) => Number(String(name ?? '').split(' ')[0]);
const bars = (level) => '<span class="bars" aria-hidden="true">' + [0, 1, 2, 3, 4].map((n) => '<i class="' + (n < level ? 'on' : '') + '" style="height:' + (3 + n * 2) + 'px"></i>').join('') + '</span>';
const level = (name) => (name ? '<span class="status">' + bars(levelOf(name)) + esc(name) + '</span>' : '');
const link = (url, label) => (url ? '<a data-open="' + esc(url) + '">' + esc(label) + ' ↗</a>' : '');
const foot = (note, url, label = 'Open in Data Hub') => '<div class="foot"><span>' + esc(note) + '</span>' + link(url, label) + '</div>';
// The Collection of a card, with its icon: a drawing of Phosphor that mcp read itself, never text of a User (DEC-UX-164).
const icon = (svg) => (typeof svg === 'string' && svg.startsWith('<svg') ? '<span class="ci" aria-hidden="true">' + svg + '</span>' : '');
const of = (collection) => (collection ? ' · ' + icon(collection.icon) + esc(collection.name) : '');
// The button at the top right of every MCP App: it folds the frame to its head, and unfolds it again (DEC-UX-181).
const FOLD = '<button class="fold" data-fold aria-label="Fold" title="Fold" aria-expanded="true"><svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M213.66,165.66a8,8,0,0,1-11.32,0L128,91.31,53.66,165.66a8,8,0,0,1-11.32-11.32l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,213.66,165.66Z"/></svg></button>';
const head = (kind, title, sub, right = '', collection = null) =>
  '<div class="head"><div><span class="meta">' + esc(kind) + of(collection) + '</span><div class="title">' + esc(title) + '</div>' + (sub ? '<span class="meta">' + esc(sub) + '</span>' : '') + '</div>' + right + FOLD + '</div>';
const setFold = () => {
  root.classList.toggle('folded', folded);
  const button = root.querySelector('[data-fold]');
  if (button) { button.setAttribute('aria-expanded', String(!folded)); button.setAttribute('aria-label', folded ? 'Unfold' : 'Fold'); button.title = folded ? 'Unfold' : 'Fold'; }
};
// A little Markdown, as the Owner writes it: paragraphs, lists, bold, italic and code; everything escaped first.
const inline = (text) => esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\`([^\`]+)\`/g, '<code>$1</code>');
function markdown(text) {
  const out = [];
  let list = null;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*] +(.*)$/.exec(line);
    if (bullet) { list = list ?? []; list.push('<li>' + inline(bullet[1]) + '</li>'); continue; }
    if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; }
    if (line) out.push('<p>' + inline(line.replace(/^#+ +/, '')) + '</p>');
  }
  if (list) out.push('<ul>' + list.join('') + '</ul>');
  return '<div class="md">' + out.join('') + '</div>';
}
/** The lines of a part of the Summary: labels as chips, Markdown rendered, items and their replies as lists. */
function partLines(lines) {
  const out = [];
  let items = null;
  const close = () => { if (items) { out.push('<ul>' + items.map((item) => '<li>' + item.text + (item.replies.length ? '<ul>' + item.replies.map((reply) => '<li>' + reply + '</li>').join('') + '</ul>' : '') + '</li>').join('') + '</ul>'); items = null; } };
  for (const line of lines ?? []) {
    if (line.kind === 'item') { items = items ?? []; items.push({ text: inline(line.text), replies: [] }); continue; }
    if (line.kind === 'reply' && items?.length) { items[items.length - 1].replies.push(inline(line.text)); continue; }
    close();
    if (line.kind === 'label') { if (line.shown) out.push('<span class="origin">' + esc(line.shown) + '</span>'); }
    else if (line.kind === 'markdown') out.push(markdown(line.text));
    else if (line.text) out.push('<p>' + inline(line.text) + '</p>');
  }
  close();
  return out.join('');
}

/** The rows of a run: 100 a page, read from the same run (FR-SR-51). */
function grid(page, ref) {
  if (!page || !page.columns) return '';
  const numeric = (type) => ['INT64', 'FLOAT64', 'NUMERIC', 'BIGNUMERIC'].includes(type);
  const cols = page.columns;
  const pages = Math.max(1, Math.ceil((page.totalRows ?? 0) / (page.size || 100)));
  const first = (page.number - 1) * (page.size || 100) + 1;
  return '<div class="scroll"><table><thead><tr>' + cols.map((c) => '<th class="' + (numeric(c.type) ? 'num' : '') + '">' + esc(c.name) + '<small>' + esc(c.type) + '</small></th>').join('') + '</tr></thead><tbody>' +
    (page.rows ?? []).map((row) => '<tr>' + row.map((value, i) => '<td class="' + (numeric(cols[i]?.type) ? 'num' : '') + '">' + (value === null ? '<span class="meta">null</span>' : esc(value)) + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div><div class="row meta"><span>' + esc(page.totalRows) + ' rows</span>' + (ref ? '<span>· Query ID <span class="mono">' + esc(ref) + '</span></span>' : '') +
    (pages > 1 && ref ? '<span class="pager">' + esc(first) + ' – ' + esc(Math.min(first + (page.size || 100) - 1, page.totalRows)) + ' <button class="quiet" data-page="' + (page.number - 1) + '"' + (page.number <= 1 ? ' disabled' : '') + '>‹</button><button class="quiet" data-page="' + (page.number + 1) + '"' + (page.number >= pages ? ' disabled' : '') + '>›</button></span>' : '') + '</div>';
}

// The crossed eye of Phosphor, and the line under the grid of a result in a card only (DEC-UX-193).
const EYE_SLASH = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208a127.11,127.11,0,0,0,52.07-10.83l22,24.21a8,8,0,1,0,11.84-10.76Zm47.33,75.84,41.67,45.85a32,32,0,0,1-41.67-45.85ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.16,133.16,0,0,1,25,128c4.69-8.79,19.66-33.39,47.35-49.38l18,19.75a48,48,0,0,0,63.66,70l14.73,16.2A112,112,0,0,1,128,192Zm6-95.43a8,8,0,0,1,3-15.72,48.16,48.16,0,0,1,38.77,42.64,8,8,0,0,1-7.22,8.71,6.39,6.39,0,0,1-.75,0,8,8,0,0,1-8-7.26A32.09,32.09,0,0,0,134,96.57Zm113.28,34.69c-.42.94-10.55,23.37-33.36,43.8a8,8,0,1,1-10.67-11.92A132.77,132.77,0,0,0,231.05,128a133.15,133.15,0,0,0-23.12-30.77C185.67,75.19,158.78,64,128,64a118.37,118.37,0,0,0-19.36,1.57A8,8,0,1,1,106,49.79,134,134,0,0,1,128,48c34.88,0,66.57,13.26,91.66,38.35,18.83,18.83,27.3,37.62,27.65,38.41A8,8,0,0,1,247.31,131.26Z"/></svg>';
const PRIVATE = '<p class="result-private">' + EYE_SLASH + 'Claude does not read these rows.</p>';

/** The rows of a result that ran: in a card only read by the MCP App itself, until then a word that they come (FR-CL-28). */
function rowsOf(v) {
  if (v.page) return grid(v.page, v.run?.ref);
  if (v.rowsError) return '<div class="error">' + esc(v.rowsError) + '</div>';
  return '<p class="meta">Reading the rows…</p>';
}
const privately = (v) => (v.results === 'card' ? PRIVATE : '');

const problems = (preflight, problem) =>
  '<div class="error">' + esc(problem || (preflight?.problems ?? []).map((p) => p.message || p.kind + (p.name ? ' ' + p.name : '') + (p.column ? ' (' + p.column + ')' : '')).join('; ') || 'It cannot run as it is.') + '</div>';

// The ranges of the User, as the Pre-flight gives them (runs.ranges); the start values when it does not.
const sizeOf = (value, fallback) => {
  if (typeof value !== 'number' || !isFinite(value)) return fallback;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) { size /= 1000; unit += 1; }
  return (size >= 10 || unit === 0 || Number.isInteger(size) ? Math.round(size) : size.toFixed(1)) + ' ' + units[unit];
};
const freeOf = (preflight) => sizeOf(preflight?.thresholds?.approve, '100 MB');
const largeOf = (preflight) => sizeOf(preflight?.thresholds?.request, '1 GB');

function approvePanel(reads, request, preflight) {
  if (request?.state === 'accepted') return '<div class="tile"><div class="row"><span>Accepted by the Data Team: it runs for you above ' + esc(largeOf(preflight)) + '.</span><button class="primary" data-act="approve" style="margin-left:auto">Run · ' + esc(reads) + '</button></div></div>';
  return '<div class="tile"><div class="row"><span style="flex:1"><b>' + esc(reads) + ' at most, above ' + esc(freeOf(preflight)) + ':</b> you approve this yourself; Claude cannot do it for you.</span><button class="primary high" data-act="approve">Approve and run · ' + esc(reads) + '</button></div></div>';
}

function requestPanel(reads, request, preflight) {
  if (request?.state === 'waiting') return '<div class="tile">Waiting for the Data Team since ' + esc(day(request.sentAt || request.createdAt)) + '. Their answer comes in your Message Centre.</div>';
  return '<div class="tile"><b>Very large: one run reads ' + esc(reads) + ', more than ' + esc(largeOf(preflight)) + '.</b><p class="meta" style="margin:4px 0 10px">Someone of the Data Team accepts it first; you send the Request yourself, Claude does not. Their answer comes in your Message Centre.</p>' +
    '<label class="meta">A word for the Data Team (optional)<textarea id="word" rows="2" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other"></textarea></label><button class="primary" data-act="request" style="margin-top:8px">Send to the Data Team</button></div>';
}

function renderResource(r, parts) {
  const card = r.card ?? {};
  const details = r.details ?? {};
  const kind = r.collection ? 'Resource' : 'Resource · without a Collection';
  const state = '<div class="row">' + level(r.levelName) + '<span class="status">' + (r.published ? 'Published' : 'Not published') + '</span>' +
    (r.collection ? '<span class="status">Owner: ' + esc(r.collection.owner) + '</span>' : '') + (r.deprecated ? '<span class="status warn">Deprecated</span>' : '') + (r.withdrawn ? '<span class="status warn">Withdrawn</span>' : '') + '</div>';
  const dep = r.deprecation ? '<div class="alert"><span><b>Deprecated</b> by ' + esc(r.deprecation.by) + ' on ' + esc(day(r.deprecation.at)) + ': ' + esc(r.deprecation.reason) + (r.deprecation.insteadOf ? ' Use ' + esc(r.deprecation.insteadOf.displayName) + ' instead.' : '') + '</span></div>' : '';
  const changes = (r.changes ?? []).length ? '<div class="alert"><span><b>Changed since it was confirmed:</b> ' + r.changes.map((c) => esc(c.field) + ' ' + esc(c.change)).join(', ') + '. Its Level stays.</span></div>' : '';
  const weights = [...new Map((parts ?? []).map((part) => [part.rank, part.weightName])).entries()].sort((a, b) => a[0] - b[0]);
  const summary = (parts ?? []).length
    ? '<div class="legend">' + weights.map(([rank, name]) => '<span class="weight w' + rank + '">' + esc(name) + '</span>').join('') + '</div>' +
      '<ol class="sum">' + parts.map((part) => '<li class="sum-part"><div class="sum-side"><span class="sum-n">' + (part.number ?? '!') + '</span><span class="weight w' + part.rank + '">' + esc(part.weightName) + '</span></div>' +
        '<div class="sum-main"><div class="sum-title"><h3>' + esc(part.title) + '</h3>' + (part.part === 'fields' ? '<button class="link" data-tab="columns">Columns</button>' : '') + '</div>' + partLines(part.lines) + '</div></li>').join('') + '</ol>'
    : '<p class="meta">Data Hub has nothing to summarise about it yet.</p>';
  const role = (name) => [details.partition?.field === name ? '<span class="pill">Partition</span>' : '', (details.clusterBy ?? []).includes(name) ? '<span class="pill">Cluster ' + ((details.clusterBy ?? []).indexOf(name) + 1) + '</span>' : '', (card.parameters ?? []).includes(name) ? '<span class="pill">Parameter</span>' : ''].join('');
  const columns = '<table class="stack"><thead><tr><th>Column</th><th>Type</th><th>Business Description</th><th>Description, from dbt</th><th></th></tr></thead><tbody>' +
    (r.fields ?? []).map((f) => '<tr><td class="mono name">' + esc(f.name) + '</td><td class="meta type">' + esc(f.dataType) + '</td><td data-label="Business Description, from the Owner">' + (esc(f.businessDescription) || '–') + '</td><td data-label="Description, from dbt">' + (esc(f.description) || '–') + '</td><td>' + role(f.name) + '</td></tr>').join('') + '</tbody></table>';
  root.innerHTML = head(kind, r.displayName, r.key, '', r.collection) + state + dep + changes +
    '<div class="tabs"><button class="tab' + (tab === 'columns' ? '' : ' on') + '" data-tab="summary">Summary</button><button class="tab' + (tab === 'columns' ? ' on' : '') + '" data-tab="columns">Columns</button></div>' +
    (tab === 'columns' ? columns : summary) + foot('As you see it in Data Hub', r.page);
}

function renderPreview(v) {
  const unit = v.choices?.window?.unit;
  const windowSelect = v.choices?.window ? '<label>Newest <select data-param="window">' + [1, 4, 12].map((n) => '<option value="' + n + '"' + (n === v.window ? ' selected' : '') + '>' + n + ' ' + esc(unit || 'partition') + (n > 1 ? 's' : '') + '</option>').join('') + '</select></label>' : '';
  const choices = (v.choices?.choices ?? []).filter((c) => c.role !== 'partition').map((c) => {
    const chosen = v.values?.[c.field] ?? '';
    const input = Array.isArray(c.values)
      ? '<select data-choice="' + esc(c.field) + '"><option value="">All</option>' + c.values.map((value) => '<option' + (value === chosen ? ' selected' : '') + '>' + esc(value) + '</option>').join('') + '</select>'
      : '<input data-choice="' + esc(c.field) + '" value="' + esc(chosen) + '" size="10" data-1p-ignore data-lpignore="true" data-bwignore data-form-type="other">';
    return '<label>' + esc(c.field) + ' ' + input + '</label>';
  }).join('');
  const pf = v.preflight ? '<span class="preflight">' + (v.outcome === 'ran' ? 'Scanned ' : 'Reads ') + esc(v.reads ?? '?') + (v.preflight.partitions !== null && v.preflight.partitions !== undefined ? ' · ' + esc(v.preflight.partitions) + ' partitions' : '') + '</span>' : '';
  const body = v.outcome === 'ran' ? rowsOf(v) + privately(v) : v.outcome === 'approve' ? approvePanel(v.reads, v.request, v.preflight) : v.outcome === 'request' ? requestPanel(v.reads, v.request, v.preflight) : problems(v.preflight, v.problem);
  root.innerHTML = head('Preview', v.resource.displayName, null, level(v.resource.levelName), v.collection) + '<div class="params">' + windowSelect + choices + pf + '</div>' + body + foot('Kept in your Query Log, as a preview', v.resource.page);
}

function renderPublish(v) {
  const r = v.resource;
  const owner = r.collection ? r.collection.owner : 'its Owner Unit';
  if (r.published) {
    root.innerHTML = head('Publish · Resource', r.displayName, null, level(r.levelName), r.collection) +
      '<div class="checks"><div>✓ <b>Published and confirmed</b> on ' + esc(day(r.publication?.publishedAt)) + ' by ' + esc(r.publication?.publishedBy) + ', for ' + esc(owner) + '. It does not expire; a field that changes later gives a warning, and the Level stays.</div><div>✓ Everyone who sees ' + esc(r.collection?.name ?? 'its Collection') + ' sees it now.</div></div>' +
      foot('Kept in the Log of the Resource', r.page);
    return;
  }
  const who = r.collection?.visibility === 'public' ? 'the whole company, as the Collection is public' : 'everyone who sees the Collection';
  const may = r.mayPublish;
  root.innerHTML = head('Publish · Resource', r.displayName, null, level(r.levelName), r.collection) +
    '<div><div class="label">Who will see it</div><div class="checks"><div><b>Everyone who sees ' + esc(r.collection?.name ?? 'its Collection') + ':</b> ' + esc(who) + '. Now only ' + esc(owner) + ' and the Data Team see it.</div></div></div>' +
    '<div><div class="label">What Data Hub checked</div><div class="checks"><div>' + (may ? '✓ Owned by ' + esc(owner) + ': you may publish it.' : '⚠ Only a member of ' + esc(owner) + ' publishes it.') + '</div><div>' + (v.ready ? '✓ <b>Described in dbt:</b> the table and at least one field have a description.' : '⚠ <b>Not described in dbt yet:</b> it is published from 2 · Described.') + '</div></div></div>' +
    (v.ready ? '<div><div class="label">What you confirm</div><p class="meta">Publishing is also the first Confirmation: for ' + esc(owner) + ', you confirm what this Resource is and what it stands for, as its descriptions say; not the figures in it.</p><div class="tile">' +
      ((r.card?.businessDescription) ? '<span class="label">Business Description</span><span class="origin">From the Owner</span><p style="margin:2px 0 8px">' + esc(r.card.businessDescription) + '</p>' : '') + '<span class="label">Description</span><span class="origin">From dbt</span><p style="margin:2px 0 0">' + esc(r.description) + '</p></div></div>' : '') +
    '<div class="declare"><label><input type="checkbox" id="declare"' + (may && v.ready ? '' : ' disabled') + '><span>For ' + esc(owner) + ', I confirm that this Resource is correct: what it is and what it stands for.</span></label><button class="primary" data-act="publish" disabled>Publish and confirm</button></div>' +
    foot('Only you can publish it; Claude cannot.', r.page);
  const box = document.getElementById('declare');
  const button = root.querySelector('[data-act="publish"]');
  box.addEventListener('change', () => { button.disabled = !box.checked; });
}

function renderQuery(v) {
  const q = v.query;
  const reads = '<div class="row"><span class="meta" style="display:inline">Reads only</span>' + (v.resources ?? []).map((r) => '<span class="status">' + (r.levelName ? bars(levelOf(r.levelName)) : '') + esc(r.displayName) + (r.levelName ? ' · ' + esc(r.levelName) : '') + (r.deprecated ? ' · deprecated' : '') + '</span>').join('') + '</div>';
  const body = v.outcome === 'ran' ? rowsOf(v) + (v.reads ? '<span class="meta">Scanned ' + esc(v.reads) + '</span>' : '') + privately(v)
    : v.outcome === 'approve' ? approvePanel(v.reads, v.request, v.preflight)
    : v.outcome === 'request' ? requestPanel(v.reads, v.request, v.preflight)
    : v.outcome === 'notRun' ? '<p class="meta">Not run yet.</p>'
    : v.outcome === 'expired' ? '<p class="meta">BigQuery no longer keeps the result of its last run.</p>'
    : problems(v.preflight, v.problem);
  root.innerHTML = head('Query · yours', q.name, q.question, '', v.collection) + reads + body +
    '<details><summary>The SQL</summary><pre>' + esc(v.sql) + '</pre></details>' + foot('In your panel of Query', q.page, 'Open in Query');
}

function render() {
  if (!view) return;
  if (view.view === 'resource') renderResource(view.resource, view.parts);
  else if (view.view === 'preview') renderPreview(view);
  else if (view.view === 'publish') renderPublish(view);
  else if (view.view === 'query') renderQuery(view);
  else if (view.view === 'sent') root.innerHTML = '<div>Sent to the Data Team. Their answer comes in your Message Centre.</div>';
  setFold();
}

/**
 * What the MCP App tells Claude after a button of the User: what they did, and the words Data Hub put first for
 * Claude. In a card only those words hold no value of the result, and of a result that carries rows or the values
 * of choices only what the User did is told (FR-CL-28).
 */
function toldClaude(result, told, card) {
  const text = result?.content?.[0]?.text;
  const values = result?.structuredContent?.page || result?.structuredContent?.choices;
  if (card && values) return told;
  return told + (text ? '\n' + text : '');
}
// end toldClaude

/** A result to show: in a card only, with the choices of its Preview the MCP App read already for this window. */
function kept(next) {
  if (next.results === 'card') cardOnly = true;
  if (next.results === 'card' && next.view === 'preview' && !next.choices && keptChoices.key === next.resource.id + '/' + next.window) return { ...next, choices: keptChoices.choices };
  return next;
}

/** In a card only, the MCP App reads the rows, and the choices of a Preview, through tools only it calls: they stay out of the conversation (FR-CL-28). */
async function fill() {
  const shown = view;
  if (shown?.results !== 'card') return;
  const read = (name, args) => app.callServerTool({ name, arguments: args }).catch(() => null);
  const [rows, choices] = await Promise.all([
    shown.outcome === 'ran' && shown.run?.ref && !shown.page ? read('read_result_rows', { run: shown.run.ref, page: 1 }) : null,
    shown.view === 'preview' && !shown.choices ? read('read_preview_choices', { id: shown.resource.id, window: shown.window }) : null,
  ]);
  const more = {};
  if (rows) {
    if (rows.structuredContent?.page) more.page = rows.structuredContent.page;
    else more.rowsError = rows.content?.[0]?.text || 'Data Hub could not read the rows just now; try again in a moment.';
  } else if (shown.outcome === 'ran' && !shown.page) more.rowsError = 'Data Hub could not read the rows just now; try again in a moment.';
  if (choices?.structuredContent?.choices) {
    keptChoices = { key: shown.resource.id + '/' + shown.window, choices: choices.structuredContent.choices };
    more.choices = keptChoices.choices;
  }
  if (view !== shown || Object.keys(more).length === 0) return;
  view = { ...shown, ...more };
  render();
}

/** Shows what a tool answered, and tells Claude what the User did, without a turn of its own. */
async function show(result, told) {
  if (result?.isError) {
    root.insertAdjacentHTML('beforeend', '<div class="error">' + esc(result.content?.[0]?.text) + '</div>');
    return;
  }
  if (result?.structuredContent?.view) {
    view = kept(result.structuredContent);
    render();
    void fill();
  }
  if (told) {
    await app.updateModelContext({ content: [{ type: 'text', text: toldClaude(result, told, cardOnly) }] }).catch(() => undefined);
  }
}

const call = async (name, args, told) => {
  root.querySelectorAll('button').forEach((b) => { b.disabled = true; });
  try {
    await show(await app.callServerTool({ name, arguments: args }), told);
  } catch (error) {
    root.insertAdjacentHTML('beforeend', '<div class="error">Data Hub could not answer just now; try again in a moment.</div>');
  }
};

const previewArgs = () => {
  const values = {};
  root.querySelectorAll('[data-choice]').forEach((el) => { if (el.value) values[el.dataset.choice] = el.value; });
  const size = root.querySelector('[data-param="window"]');
  return { id: view.resource.id, window: size ? Number(size.value) : view.window, values };
};
const queryArgs = () => ({ id: view.query.id, sql: view.sql, parameters: view.parameters });

root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-open],[data-tab],[data-act],[data-page],[data-fold]');
  if (!target || target.disabled) return;
  if (target.dataset.fold !== undefined) { folded = !folded; setFold(); return; }
  if (target.dataset.open) { event.preventDefault(); app.openLink({ url: target.dataset.open }); return; }
  if (target.dataset.tab) { tab = target.dataset.tab; render(); return; }
  if (target.dataset.page) {
    // In a card only, the next page comes through the tool only the MCP App calls, as the first did (FR-CL-28).
    const name = view.results === 'card' ? 'read_result_rows' : 'get_result_page';
    app.callServerTool({ name, arguments: { run: view.run.ref, page: Number(target.dataset.page) } }).then((result) => {
      if (result?.structuredContent?.page) { view = { ...view, page: result.structuredContent.page }; render(); }
    });
    return;
  }
  const act = target.dataset.act;
  const word = () => document.getElementById('word')?.value ?? '';
  if (view.view === 'preview') {
    if (act === 'approve') call('run_preview_approved', previewArgs(), 'The User approved and ran the Preview in Data Hub.');
    if (act === 'request') call('send_preview_request', { ...previewArgs(), text: word() }, 'The User sent the Preview to the Data Team as a Request.');
  } else if (view.view === 'query') {
    if (act === 'approve') call('run_query_approved', queryArgs(), 'The User approved and ran the query in Data Hub.');
    if (act === 'request') call('send_query_request', { ...queryArgs(), text: word() }, 'The User sent the query to the Data Team as a Request.');
  } else if (view.view === 'publish' && act === 'publish') {
    call('confirm_publication', { id: view.resource.id }, 'The User published and confirmed the Resource in Data Hub.');
  }
});

// A Parameter of a Preview changed in the window: the Preview again, through its Pre-flight (FR-CL-09).
root.addEventListener('change', (event) => {
  if (view?.view === 'preview' && event.target.closest('[data-choice],[data-param]')) call('preview_resource', previewArgs());
});

function applyTheme(context) {
  if (context?.theme) document.documentElement.dataset.theme = context.theme === 'dark' ? 'dark' : 'light';
}

app.ontoolresult = (result) => show(result);
app.onhostcontextchanged = (context) => applyTheme(context);
await app.connect();
applyTheme(app.getHostContext());
</script>
</body>
</html>`;
