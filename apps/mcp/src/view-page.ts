/**
 * The page of the MCP App of Data Hub (FR-CL-01): one page that shows a Resource (FR-CL-07), a Preview
 * (FR-CL-09), a publication (FR-CL-12) or the result of a query (FR-CL-21), by the `view` of the tool result.
 * It stands on its own, without the navigation of Data Hub, and carries "Open in Data Hub" (FR-CL-06). The
 * buttons that approve, send a Request or publish call tools only the MCP App may call (DEC-CL-07).
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
let tab = 'overview';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const levelOf = (name) => Number(String(name ?? '').split(' ')[0]);
const bars = (level) => '<span class="bars" aria-hidden="true">' + [0, 1, 2, 3, 4].map((n) => '<i class="' + (n < level ? 'on' : '') + '" style="height:' + (3 + n * 2) + 'px"></i>').join('') + '</span>';
const level = (name) => (name ? '<span class="status">' + bars(levelOf(name)) + esc(name) + '</span>' : '');
const link = (url, label) => (url ? '<a data-open="' + esc(url) + '">' + esc(label) + ' ↗</a>' : '');
const foot = (note, url, label = 'Open in Data Hub') => '<div class="foot"><span>' + esc(note) + '</span>' + link(url, label) + '</div>';
const head = (kind, title, sub, right = '') =>
  '<div class="head"><div><span class="meta">' + esc(kind) + '</span><div class="title">' + esc(title) + '</div>' + (sub ? '<span class="meta">' + esc(sub) + '</span>' : '') + '</div>' + right + '</div>';

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

const problems = (preflight, problem) =>
  '<div class="error">' + esc(problem || (preflight?.problems ?? []).map((p) => p.message || p.kind + (p.name ? ' ' + p.name : '') + (p.column ? ' (' + p.column + ')' : '')).join('; ') || 'It cannot run as it is.') + '</div>';

function approvePanel(reads, request) {
  if (request?.state === 'accepted') return '<div class="tile"><div class="row"><span>Accepted by the Data Team: it runs for you above 1 GB.</span><button class="primary" data-act="approve" style="margin-left:auto">Run · ' + esc(reads) + '</button></div></div>';
  return '<div class="tile"><div class="row"><span style="flex:1"><b>' + esc(reads) + ' at most, above 100 MB:</b> you approve this yourself; Claude cannot do it for you.</span><button class="primary high" data-act="approve">Approve and run · ' + esc(reads) + '</button></div></div>';
}

function requestPanel(reads, request) {
  if (request?.state === 'waiting') return '<div class="tile">Waiting for the Data Team since ' + esc(day(request.sentAt || request.createdAt)) + '. Their answer comes in your Message Centre.</div>';
  return '<div class="tile"><b>Very large: one run reads ' + esc(reads) + ', more than 1 GB.</b><p class="meta" style="margin:4px 0 10px">Someone of the Data Team accepts it first; you send the Request yourself, Claude does not. Their answer comes in your Message Centre.</p>' +
    '<label class="meta">A word for the Data Team (optional)<textarea id="word" rows="2"></textarea></label><button class="primary" data-act="request" style="margin-top:8px">Send to the Data Team</button></div>';
}

function renderResource(r) {
  const card = r.card ?? {};
  const details = r.details ?? {};
  const kind = 'Resource · ' + (r.collection ? r.collection.name : 'without a Collection');
  const state = '<div class="row">' + level(r.levelName) + '<span class="status">' + (r.published ? 'Published' : 'Not published') + '</span>' +
    (r.collection ? '<span class="status">Owner: ' + esc(r.collection.owner) + '</span>' : '') + (r.deprecated ? '<span class="status warn">Deprecated</span>' : '') + (r.withdrawn ? '<span class="status warn">Withdrawn</span>' : '') + '</div>';
  const dep = r.deprecation ? '<div class="alert"><span><b>Deprecated</b> by ' + esc(r.deprecation.by) + ' on ' + esc(day(r.deprecation.at)) + ': ' + esc(r.deprecation.reason) + (r.deprecation.insteadOf ? ' Use ' + esc(r.deprecation.insteadOf.displayName) + ' instead.' : '') + '</span></div>' : '';
  const changes = (r.changes ?? []).length ? '<div class="alert"><span><b>Changed since it was confirmed:</b> ' + r.changes.map((c) => esc(c.field) + ' ' + esc(c.change)).join(', ') + '. Its Level stays.</span></div>' : '';
  const partition = details.partition ? 'by <span class="mono">' + esc(details.partition.field) + '</span>' + (details.partition.unit ? ', a partition per ' + esc(details.partition.unit) : '') + (r.storage?.partitions ? ' · ' + esc(r.storage.partitions) + ' partitions' : '') : 'not partitioned';
  const overview = '<div class="grid">' +
    '<div class="tile wide"><div class="label">Description</div><div class="pair">' +
    (card.businessDescription ? '<div><span class="label">Business Description</span><span class="origin">From the Owner</span><p>' + esc(card.businessDescription) + '</p></div>' : '') +
    '<div><span class="label">Description</span><span class="origin">From dbt</span><p>' + (esc(r.description) || '<span class="meta">None yet</span>') + '</p></div></div>' +
    ((details.grain ?? []).length ? '<div style="margin-top:10px">' + (details.modelType ? '<span class="chip">model type: ' + esc(details.modelType) + '</span>' : '') + '<span class="chip">grain: ' + details.grain.map(esc).join(' × ') + '</span>' + (details.grainSentence ? '<span class="meta">' + esc(details.grainSentence) + '</span>' : '') + '</div>' : '') + '</div>' +
    (card.intendedUse || card.pitfalls ? '<div class="tile"><div class="label">Known behaviour</div>' + (card.intendedUse ? '<b>Intended use</b><p style="margin:2px 0 8px">' + esc(card.intendedUse) + '</p>' : '') + (card.pitfalls ? '<b>Pitfalls</b><p style="margin:2px 0 0">' + esc(card.pitfalls) + '</p>' : '') + '</div>' : '') +
    ((card.knownGaps ?? []).length ? '<div class="tile"><div class="label">Known gaps</div>' + card.knownGaps.map((gap) => '<p style="margin:0 0 6px">' + esc(gap) + '</p>').join('') + '</div>' : '') +
    '<div class="tile"><div class="label">Publication</div><dl>' + (r.publication ? '<dt>Published</dt><dd>' + esc(day(r.publication.publishedAt)) + ' by ' + esc(r.publication.publishedBy) + '</dd><dt>Confirmed</dt><dd>' + esc(day(r.publication.confirmedAt)) + ' by ' + esc(r.publication.confirmedBy) + '</dd>' : '<dt>Published</dt><dd>Not yet</dd>') + (card.reliableSince ? '<dt>Reliable since</dt><dd>' + esc(day(card.reliableSince)) + '</dd>' : '') + '</dl></div>' +
    ((card.keyFields ?? []).length || (card.parameters ?? []).length ? '<div class="tile"><div class="label">Key fields</div>' + (card.keyFields ?? []).map((f) => '<span class="chip">' + esc(f) + '</span>').join('') + '<div class="label" style="margin-top:8px">Parameters</div>' + (card.parameters ?? []).map((f) => '<span class="chip">' + esc(f) + '</span>').join('') + '</div>' : '') +
    '<div class="tile wide"><div class="label">Partitions and clustering</div><dl><dt>Partitioned</dt><dd>' + partition + '</dd>' + ((details.clusterBy ?? []).length ? '<dt>Clustered</dt><dd>by ' + details.clusterBy.map((f) => '<span class="mono">' + esc(f) + '</span>').join(', then ') + '</dd>' : '') + (r.storage?.size ? '<dt>Size</dt><dd>' + esc(r.storage.size) + '</dd>' : '') + '</dl></div>' +
    '</div>';
  const role = (name) => [details.partition?.field === name ? '<span class="pill">Partition</span>' : '', (details.clusterBy ?? []).includes(name) ? '<span class="pill">Cluster ' + ((details.clusterBy ?? []).indexOf(name) + 1) + '</span>' : '', (card.parameters ?? []).includes(name) ? '<span class="pill">Parameter</span>' : ''].join('');
  const columns = '<div class="scroll"><table><thead><tr><th>Column</th><th>Type</th><th>Business Description</th><th>Description, from dbt</th><th></th></tr></thead><tbody>' +
    (r.fields ?? []).map((f) => '<tr><td class="mono">' + esc(f.name) + '</td><td class="meta">' + esc(f.dataType) + '</td><td>' + (esc(f.businessDescription) || '–') + '</td><td>' + (esc(f.description) || '–') + '</td><td>' + role(f.name) + '</td></tr>').join('') + '</tbody></table></div>';
  root.innerHTML = head(kind, r.displayName, r.key) + state + dep + changes +
    '<div class="tabs"><button class="tab' + (tab === 'overview' ? ' on' : '') + '" data-tab="overview">Overview</button><button class="tab' + (tab === 'columns' ? ' on' : '') + '" data-tab="columns">Columns</button></div>' +
    (tab === 'overview' ? overview : columns) + foot('As you see it in Data Hub', r.page);
}

function renderPreview(v) {
  const unit = v.choices?.window?.unit;
  const windowSelect = v.choices?.window ? '<label>Newest <select data-param="window">' + [1, 4, 12].map((n) => '<option value="' + n + '"' + (n === v.window ? ' selected' : '') + '>' + n + ' ' + esc(unit || 'partition') + (n > 1 ? 's' : '') + '</option>').join('') + '</select></label>' : '';
  const choices = (v.choices?.choices ?? []).filter((c) => c.role !== 'partition').map((c) => {
    const chosen = v.values?.[c.field] ?? '';
    const input = Array.isArray(c.values)
      ? '<select data-choice="' + esc(c.field) + '"><option value="">All</option>' + c.values.map((value) => '<option' + (value === chosen ? ' selected' : '') + '>' + esc(value) + '</option>').join('') + '</select>'
      : '<input data-choice="' + esc(c.field) + '" value="' + esc(chosen) + '" size="10">';
    return '<label>' + esc(c.field) + ' ' + input + '</label>';
  }).join('');
  const pf = v.preflight ? '<span class="preflight">' + (v.outcome === 'ran' ? 'Scanned ' : 'Reads ') + esc(v.reads ?? '?') + (v.preflight.partitions !== null && v.preflight.partitions !== undefined ? ' · ' + esc(v.preflight.partitions) + ' partitions' : '') + '</span>' : '';
  const body = v.outcome === 'ran' ? grid(v.page, v.run?.ref) : v.outcome === 'approve' ? approvePanel(v.reads, v.request) : v.outcome === 'request' ? requestPanel(v.reads, v.request) : problems(v.preflight, v.problem);
  root.innerHTML = head('Preview', v.resource.displayName, null, level(v.resource.levelName)) + '<div class="params">' + windowSelect + choices + pf + '</div>' + body + foot('Kept in your Query Log, as a preview', v.resource.page);
}

function renderPublish(v) {
  const r = v.resource;
  const owner = r.collection ? r.collection.owner : 'its Owner Unit';
  if (r.published) {
    root.innerHTML = head('Publish · Resource · ' + (r.collection?.name ?? ''), r.displayName, null, level(r.levelName)) +
      '<div class="checks"><div>✓ <b>Published and confirmed</b> on ' + esc(day(r.publication?.publishedAt)) + ' by ' + esc(r.publication?.publishedBy) + ', for ' + esc(owner) + '. It does not expire; a field that changes later gives a warning, and the Level stays.</div><div>✓ Everyone who sees ' + esc(r.collection?.name ?? 'its Collection') + ' sees it now.</div></div>' +
      foot('Kept in the Log of the Resource', r.page);
    return;
  }
  const who = r.collection?.visibility === 'public' ? 'the whole company, as the Collection is public' : 'everyone who sees the Collection';
  const may = r.mayPublish;
  root.innerHTML = head('Publish · Resource · ' + (r.collection?.name ?? ''), r.displayName, null, level(r.levelName)) +
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
  const body = v.outcome === 'ran' ? grid(v.page, v.run?.ref) + (v.reads ? '<span class="meta">Scanned ' + esc(v.reads) + '</span>' : '')
    : v.outcome === 'approve' ? approvePanel(v.reads, v.request)
    : v.outcome === 'request' ? requestPanel(v.reads, v.request)
    : v.outcome === 'notRun' ? '<p class="meta">Not run yet.</p>'
    : v.outcome === 'expired' ? '<p class="meta">BigQuery no longer keeps the result of its last run.</p>'
    : problems(v.preflight, v.problem);
  root.innerHTML = head('Query · yours', q.name, q.question) + reads + body +
    '<details><summary>The SQL</summary><pre>' + esc(v.sql) + '</pre></details>' + foot('In your panel of Query', q.page, 'Open in Query');
}

function render() {
  if (!view) return;
  if (view.view === 'resource') renderResource(view.resource);
  else if (view.view === 'preview') renderPreview(view);
  else if (view.view === 'publish') renderPublish(view);
  else if (view.view === 'query') renderQuery(view);
  else if (view.view === 'sent') root.innerHTML = '<div>Sent to the Data Team. Their answer comes in your Message Centre.</div>';
}

/** Shows what a tool answered, and tells Claude what the User did, without a turn of its own. */
async function show(result, told) {
  if (result?.isError) {
    root.insertAdjacentHTML('beforeend', '<div class="error">' + esc(result.content?.[0]?.text) + '</div>');
    return;
  }
  if (result?.structuredContent?.view) {
    view = result.structuredContent;
    render();
  }
  if (told) {
    const text = result?.content?.[0]?.text;
    await app.updateModelContext({ content: [{ type: 'text', text: told + (text ? '\n' + text : '') }] }).catch(() => undefined);
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
  const target = event.target.closest('[data-open],[data-tab],[data-act],[data-page]');
  if (!target || target.disabled) return;
  if (target.dataset.open) { event.preventDefault(); app.openLink({ url: target.dataset.open }); return; }
  if (target.dataset.tab) { tab = target.dataset.tab; render(); return; }
  if (target.dataset.page) {
    app.callServerTool({ name: 'get_result_page', arguments: { run: view.run.ref, page: Number(target.dataset.page) } }).then((result) => {
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
