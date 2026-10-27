// Shared prototype behaviour. Prototype only: no data, no routing.
const app = document.querySelector('.app');

// Theme toggle (light / dark), remembered per viewer
const themeBtn = document.getElementById('theme');
try { const t = localStorage.getItem('dh-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; } catch (e) {}
themeBtn?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('dh-theme', next); } catch (e) {}
});

// Panel: clicking the active section toggles it, the collapse button closes it, state remembered per viewer
try { if (localStorage.getItem('dh-panel') === 'closed') app.classList.remove('panel-open'); } catch (e) {}
const savePanel = () => { try { localStorage.setItem('dh-panel', app.classList.contains('panel-open') ? 'open' : 'closed'); } catch (e) {} };
document.querySelector('.nav-btn.active')?.addEventListener('click', () => { app.classList.toggle('panel-open'); savePanel(); });
document.getElementById('collapse')?.addEventListener('click', () => { app.classList.remove('panel-open'); savePanel(); });

// Panel of Collections: the arrow folds and unfolds a Collection in place (FR-CO-18); the Collection itself opens its page (FR-CO-25),
// which in these prototypes exists only for Credit leads, so the others just unfold
const fold = (g, open) => { g.classList.toggle('open', open); g.querySelector('.tree-toggle')?.setAttribute('aria-expanded', open); };
document.querySelectorAll('.tree-toggle').forEach(t => t.addEventListener('click', () => { const g = t.closest('.tree-group'); fold(g, !g.classList.contains('open')); }));
document.querySelectorAll('.tree-link[href="#"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); fold(a.closest('.tree-group'), true); }));

// Prototype only: switch the role the screen is seen as
document.querySelectorAll('.role-switch .seg').forEach(b => b.addEventListener('click', () => { document.documentElement.dataset.role = b.dataset.target; }));

// Search filters Collections and their items together (FR-CO-24): a Collection whose name matches stays as it was,
// one with a matching item unfolds and shows only those; emptying the search restores what was unfolded
const unfolded = new Map();
document.getElementById('panel-search')?.addEventListener('input', e => {
  const q = e.target.value.toLowerCase().trim(); let n = 0;
  document.querySelectorAll('.tree-group').forEach(g => {
    if (!unfolded.has(g)) unfolded.set(g, g.classList.contains('open'));
    const own = g.querySelector('.tree-head .item-title').textContent.toLowerCase().includes(q);
    let hits = 0;
    g.querySelectorAll('.tree-res').forEach(r => { const m = own || (r.dataset.search || r.querySelector('.clip').firstChild.textContent).toLowerCase().includes(q); r.hidden = !m; if (m) hits++; });
    g.querySelectorAll('.tree-more').forEach(r => r.hidden = !!q && !own);
    g.hidden = !own && hits === 0; if (!g.hidden) n++;
    // A section label, such as a section of the learning centre, goes when nothing under it is left
    g.querySelectorAll('.tree-sec').forEach(sec => {
      let el = sec.nextElementSibling, any = false;
      while (el && !el.classList.contains('tree-sec')) { if (el.matches('.tree-res') && !el.hidden) any = true; el = el.nextElementSibling; }
      sec.hidden = !any;
    });
    g.classList.toggle('open', q ? (!own || unfolded.get(g)) && hits > 0 : unfolded.get(g));
    if (!q) unfolded.delete(g);
  });
  document.querySelectorAll('.panel .list-item[data-name]').forEach(el => { const m = el.dataset.name.includes(q); el.hidden = !m; if (m) n++; });
  // A heading such as "Shared resources" goes when nothing under it is left
  document.querySelectorAll('.panel-label').forEach(label => {
    let el = label.nextElementSibling, shown = false;
    while (el && !el.classList.contains('panel-label') && el.id !== 'no-results') { if (!el.hidden) shown = true; el = el.nextElementSibling; }
    label.hidden = !shown;
  });
  const empty = document.getElementById('no-results'); if (empty) empty.hidden = n > 0;
});

// Segmented controls and tabs: show the matching [data-pane]
document.querySelectorAll('[data-group]').forEach(group => {
  const buttons = group.querySelectorAll('[data-target]');
  buttons.forEach(b => b.addEventListener('click', () => {
    buttons.forEach(x => { x.classList.remove('on'); x.setAttribute('aria-selected', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-selected', 'true');
    // A pane may belong to more than one target: data-pane="fresh changed"
    document.querySelectorAll(`[data-pane-group="${group.dataset.group}"]`).forEach(p => p.hidden = !p.dataset.pane.split(' ').includes(b.dataset.target));
  }));
});

// Prototype: a button that switches one or more groups, such as "Next" on a step: data-go="state:understood step:congrats"
const go = spec => spec.split(' ').forEach(p => { const [g, t] = p.split(':'); document.querySelector(`[data-group="${g}"] [data-target="${t}"]`)?.click(); });
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  if (b.getAttribute('aria-disabled') !== 'true') go(b.dataset.go);
}));
// A group marked data-scroll brings what it switches back to the top
document.querySelectorAll('[data-group][data-scroll]').forEach(g => g.querySelectorAll('[data-target]').forEach(b => b.addEventListener('click', () => {
  const box = g.closest('.float-win')?.querySelector('.float-body') || g.closest('.main');
  if (box) box.scrollTop = 0;
})));

// Check your understanding on a Learning Card (FR-LR-30): predict, then see the answer and why; another question, or stop.
// Nothing is counted.
document.querySelectorAll('.lc-quiz').forEach(quiz => {
  const qs = [...quiz.querySelectorAll('.lc-q')];
  let at = 0;
  const reset = q => {
    q.classList.remove('answered');
    q.querySelectorAll('.lc-opt').forEach(o => { o.classList.remove('chosen', 'right', 'wrong'); o.querySelector('i').className = 'ph ph-circle'; });
    q.querySelector('.lc-why').hidden = true; q.querySelector('.lc-q-foot').hidden = true;
  };
  qs.forEach(q => {
    q.querySelectorAll('.lc-opt').forEach(o => o.addEventListener('click', () => {
      if (q.classList.contains('answered')) return;
      const ok = o.hasAttribute('data-right'), r = q.querySelector('[data-right]');
      q.classList.add('answered'); o.classList.add('chosen'); r.classList.add('right');
      r.querySelector('i').className = (ok ? 'ph-fill' : 'ph') + ' ph-check-circle';
      if (!ok) { o.classList.add('wrong'); o.querySelector('i').className = 'ph-fill ph-x-circle'; }
      q.querySelector('.verdict').textContent = ok ? 'Right.' : 'Not quite.';
      q.querySelector('.lc-why').hidden = false; q.querySelector('.lc-q-foot').hidden = false;
    }));
    q.querySelector('.lc-q-next').addEventListener('click', () => { at = (at + 1) % qs.length; reset(qs[at]); qs.forEach((x, i) => x.hidden = i !== at); });
  });
});

// A marked system text or button and its pop-out (FR-LR-36, DEC-UX-57): it opens only when the pointer rests on it for a
// second, so passing over the page opens nothing; keyboard focus opens it at once. A text bubble under the text, or above
// it near the foot of the window, its arrow on the marker. It stays while the pointer is on it, and closes on leaving,
// Escape or scrolling. A tap on the marker opens it, and keeps a button from doing its own action.
const pops = new Map();
let popOwner = null;
document.querySelectorAll('[data-pop]').forEach(t => {
  const pop = document.getElementById(t.dataset.pop); if (!pop) return;
  let timer;
  const show = () => {
    clearTimeout(timer);
    pops.forEach(other => other !== api && other.hide());
    pop.hidden = false;
    const r = t.getBoundingClientRect(), m = (t.querySelector('.lc-mark') || t).getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, x = m.left + m.width / 2;
    const below = r.bottom + 12 + h <= innerHeight - 12;
    const left = Math.min(Math.max(12, x - 32), innerWidth - w - 12);
    pop.dataset.side = below ? 'below' : 'above';
    pop.style.setProperty('--arrow-x', Math.min(Math.max(18, x - left), w - 18) + 'px');
    Object.assign(pop.style, { left: left + 'px', top: (below ? r.bottom + 12 : r.top - h - 12) + 'px' });
    t.classList.add('open'); t.setAttribute('aria-expanded', 'true'); popOwner = t;
  };
  const hide = () => { clearTimeout(timer); pop.hidden = true; t.setAttribute('aria-expanded', 'false'); if (!document.getElementById('lc-float')?.hidden && popOwner === t) return; t.classList.remove('open'); };
  const api = { show, hide, pop, t };
  pops.set(t.dataset.pop, api);
  const close = () => { clearTimeout(timer); timer = setTimeout(hide, 300); };
  t.addEventListener('mouseenter', () => { clearTimeout(timer); if (pop.hidden) timer = setTimeout(show, 1000); });
  t.addEventListener('mouseleave', close);
  t.addEventListener('focus', () => { if (t.matches(':focus-visible')) show(); });
  t.addEventListener('blur', e => { if (!pop.contains(e.relatedTarget)) close(); });
  pop.addEventListener('mouseenter', () => clearTimeout(timer)); pop.addEventListener('mouseleave', close);
  pop.addEventListener('focusout', e => { if (!pop.contains(e.relatedTarget) && e.relatedTarget !== t) close(); });
  t.querySelector('.lc-mark')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); show(); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') pops.forEach(p => p.hide()); });
document.addEventListener('scroll', e => { if (!e.target.closest?.('.lc-pop')) pops.forEach(p => p.hide()); }, true);
// An item of a pop-out opens its card in the floating window over this page; the User stays where they are (FR-LR-36)
document.querySelectorAll('[data-float-open]').forEach(b => b.addEventListener('click', () => {
  const win = document.getElementById('lc-float'); if (!win) return;
  win.querySelector('#float-title').innerHTML = `<span class="lc-num">${b.dataset.num}</span>${b.dataset.title}`;
  win.hidden = false; win.classList.remove('folded');
  pops.forEach(p => p.hide()); popOwner?.classList.add('open');
}));
document.querySelectorAll('[data-float-close]').forEach(b => b.addEventListener('click', () => {
  b.closest('.float-win').hidden = true;
  document.querySelectorAll('.lc-ref.open, [data-pop].open').forEach(t => t.classList.remove('open'));
}));
// Prototype only: open a pop-out from a switch or the address (?pop=pop-grain)
const openPop = id => setTimeout(() => pops.get(id)?.show(), 300);
document.querySelectorAll('[data-pop-open]').forEach(b => b.addEventListener('click', () => openPop(b.dataset.popOpen)));
const firstPop = new URLSearchParams(location.search).get('pop') || document.body.dataset.firstPop;
if (firstPop) document.fonts.ready.then(() => openPop(firstPop));

// The floating window of a Message (DEC-UX-30): folds to its head, and moves when its head is dragged
document.querySelectorAll('.float-win').forEach(w => {
  const btn = w.querySelector('.float-fold');
  btn?.addEventListener('click', () => {
    const folded = w.classList.toggle('folded');
    btn.setAttribute('aria-expanded', !folded); btn.setAttribute('aria-label', folded ? 'Unfold' : 'Fold');
    btn.innerHTML = `<i class="ph ${folded ? 'ph-arrows-out-simple' : 'ph-minus'}"></i>`;
  });
  const head = w.querySelector('.float-head');
  head?.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a')) return;
    const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const move = m => Object.assign(w.style, { right: 'auto', bottom: 'auto',
      left: Math.max(0, Math.min(innerWidth - r.width, m.clientX - dx)) + 'px', top: Math.max(0, Math.min(innerHeight - 48, m.clientY - dy)) + 'px' });
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', () => head.removeEventListener('pointermove', move), { once: true });
  });
});

// A declaration and its button are one (DEC-UX-63): the button stays off until the box is ticked
document.querySelectorAll('.confirm-bar').forEach(bar => {
  const box = bar.querySelector('input[type="checkbox"]'), btn = bar.querySelector('button');
  const sync = () => { btn.disabled = box.disabled || !box.checked; };
  box.addEventListener('change', sync); sync();
});

// A change since the last Confirmation (DEC-MR-08): "Mark as seen" takes the warning away; the change stays in the History.
// A tap on its marker opens the pop-out instead (the marker stops the click)
document.querySelectorAll('[data-seen]').forEach(b => b.addEventListener('click', () => { b.closest('.alert').hidden = true; }));

// A sheet that belongs to its page: what opened it opens it again; Close, Cancel or a click beside it closes it
document.querySelectorAll('[data-sheet-open]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); document.getElementById(b.dataset.sheetOpen).hidden = false; }));
document.querySelectorAll('[data-sheet-close]').forEach(b => b.addEventListener('click', () => { b.closest('.sheet-wrap').hidden = true; }));

// Intro on a section start screen: dismissed per user per section (in the app: user settings, versioned)
const intro = document.getElementById('intro');
if (intro) {
  const key = 'dh-intro-' + intro.dataset.section + '-v' + intro.dataset.version;
  const show = on => { intro.hidden = !on; document.getElementById('intro-bar').hidden = on; };
  try { show(localStorage.getItem(key) !== 'hidden'); } catch (e) { show(true); }
  document.getElementById('intro-hide').addEventListener('click', () => { show(false); try { localStorage.setItem(key, 'hidden'); } catch (e) {} });
  document.getElementById('intro-show').addEventListener('click', () => { show(true); try { localStorage.removeItem(key); } catch (e) {} });
}

// Maturity icon: <span class="maturity" data-level="2" data-previous="4"></span>
const LEVELS = ['Beta', 'Available', 'Described', 'Confirmed', 'Explored', 'Monitored'];
document.querySelectorAll('.maturity').forEach(m => {
  const l = +m.dataset.level, p = m.dataset.previous ? +m.dataset.previous : -1;
  let s = '<svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true">';
  for (let i = 0; i < 6; i++) {
    const h = 4 + i * 2.4, x = i * 5, y = 16 - h;
    s += i === p
      ? `<rect x="${x + .5}" y="${y + .5}" width="3" height="${h - 1}" rx="1.2" fill="none" stroke="var(--signal-warn)" stroke-width="1"/>`
      : `<rect x="${x}" y="${y}" width="4" height="${h}" rx="1.4" fill="${i <= l ? 'var(--text-primary)' : 'var(--tint-active)'}"/>`;
  }
  m.innerHTML = s + '</svg>';
  const name = `${l} · ${LEVELS[l]}` + (p >= 0 ? ` (was ${p} · ${LEVELS[p]})` : '');
  m.setAttribute('role', 'img'); m.setAttribute('aria-label', 'Maturity ' + name);
  if (!m.hasAttribute('data-no-tooltip')) m.dataset.name = name;
});

// Prototype only: the address picks what a switch shows, so a link opens a screen as the right role or outcome:
// ?role=owner, ?size=large; ?bg=ski shows the picture as the background (DEC-UX-34)
new URLSearchParams(location.search).forEach((value, key) => {
  if (key === 'role') document.documentElement.dataset.role = value;
  if (key === 'bg') document.documentElement.dataset.bg = value;
  document.querySelector(`[data-group="${key}"] [data-target="${value}"]`)?.click();
});

// Adding Resources, step 2: a field maps to nothing, to `is` or to a relation type; "No mapping" hides the identity.
// A list on a relation type that holds one is refused on the spot; ?mismatch shows it. The filter shows only the mapped
// fields (DEC-RC-05, DEC-UX-58)
document.querySelectorAll('.rel-row .rel-map').forEach(s => s.addEventListener('change', () => {
  const row = s.closest('.rel-row');
  row.dataset.map = s.value === 'none' ? 'none' : s.value === 'is' ? 'is' : 'rel';
  row.querySelector('.rel-ref').hidden = s.value === 'none';
  const error = row.querySelector('.rel-error');
  if (!error) return;
  const mismatch = row.dataset.array === 'true' && s.selectedOptions[0].dataset.card === 'one';
  error.hidden = !mismatch;
  error.querySelector('code.t').textContent = s.selectedOptions[0].textContent;
  row.toggleAttribute('data-mismatch', mismatch);
  const card = row.querySelector('.rel-card');
  if (card) card.hidden = mismatch;
}));
document.querySelectorAll('[data-rel-filter]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-rel-filter]').forEach(o => o.classList.toggle('on', o === b));
  document.querySelectorAll('.rel-row').forEach(r => { r.hidden = b.dataset.relFilter === 'set' && r.dataset.map === 'none'; });
}));
if (new URLSearchParams(location.search).has('mismatch')) {
  const demo = document.querySelector('[data-mismatch-demo]');
  if (demo) { demo.value = 'placedIn'; demo.dispatchEvent(new Event('change')); }
}

// The editor of Query folds every CTE to its first line, as a code editor does: the arrow in the gutter folds or unfolds
// one, "⋯ n lines" unfolds it, and "Fold all" folds them together; the line numbers keep their count (Proposal)
const sqlEditor = document.querySelector('.sql-editor');
if (sqlEditor) {
  const starts = () => [...sqlEditor.querySelectorAll('[data-fold-start]')];
  const foldAll = document.getElementById('fold-all');
  const fold = (start, folded) => {
    const name = start.dataset.foldStart;
    start.classList.toggle('folded', folded);
    const arrow = start.querySelector('.ln-fold');
    arrow.setAttribute('aria-expanded', !folded); arrow.setAttribute('aria-label', (folded ? 'Unfold ' : 'Fold ') + name);
    start.querySelectorAll('.fold-ph, .fold-close').forEach(el => { el.hidden = !folded; });
    sqlEditor.querySelectorAll(`[data-fold-in="${name}"]`).forEach(line => { line.hidden = folded; });
  };
  const sync = () => {
    const anyOpen = starts().some(s => !s.classList.contains('folded'));
    foldAll.querySelector('span').textContent = anyOpen ? 'Fold all' : 'Unfold all';
    foldAll.querySelector('i').className = 'ph ' + (anyOpen ? 'ph-arrows-in-line-vertical' : 'ph-arrows-out-line-vertical');
  };
  sqlEditor.addEventListener('click', e => {
    const start = e.target.closest('.ln-fold, .fold-ph')?.closest('[data-fold-start]');
    if (start) { fold(start, !start.classList.contains('folded')); sync(); }
  });
  foldAll.addEventListener('click', () => { const folded = starts().some(s => !s.classList.contains('folded')); starts().forEach(s => fold(s, folded)); sync(); });
  sync();
  // The suggestions: a click in the SQL opens them where the cursor is, as typing would; a click beside them or Escape closes them
  const suggest = sqlEditor.querySelector('.suggest');
  document.addEventListener('click', e => { if (suggest) suggest.hidden = !sqlEditor.contains(e.target) || !!e.target.closest('button, .sql-param.undefined'); });
  document.addEventListener('keydown', e => { if (suggest && e.key === 'Escape') suggest.hidden = true; });
}

// The Parameters of a query (Proposal). Each has a name, a kind from the standard list and a value: a value such as
// 2026-10-25, or an SQL function such as DATE_TRUNC(CURRENT_DATE(), YEAR), worked out at every run. Under the query
// they fold open and shut; they are made and changed in a floating window that moves by its head. A Parameter that is
// not in the SQL is grey: it is not sent. An @name in the SQL that is not a Parameter stands out, in the SQL and under
// it, and keeps the query from running, as BigQuery would refuse it; a click on it defines it
const pbox = document.getElementById('param-box');
if (pbox) {
  const KINDS = {
    date: ['Date', 'ph-calendar-blank', 'DATE'], period: ['Period', 'ph-calendar-dots', '2 × DATE'], number: ['Whole number', 'ph-hash', 'INT64'],
    decimal: ['Decimal number', 'ph-percent', 'NUMERIC'], text: ['Text', 'ph-text-aa', 'STRING'], choice: ['Choice', 'ph-list-bullets', 'STRING'],
    several: ['Several choices', 'ph-list-checks', 'ARRAY<STRING>'], yesno: ['Yes or no', 'ph-toggle-left', 'BOOL'],
  };
  const HINTS = {
    date: 'A date, such as 2026-01-01, or an SQL function, such as DATE_TRUNC(CURRENT_DATE(), YEAR).',
    number: 'A number, such as 10, or an SQL function.', decimal: 'A number, such as 350000.50, or an SQL function.',
    text: 'A text, such as 8000, or an SQL function.',
  };
  const COLUMNS = { 'source_name · Lead sources': ['Website', 'App', 'Partner network', 'Mailing'], 'lead_channel · Weekly lead volume': ['Form', 'Phone', 'Email', 'Chat'] };
  // What a function gives today; in the app BigQuery works it out, which reads nothing
  const GIVES = new Map([...document.querySelectorAll('#pm-date-fns option')].map(o => [o.value.replace(/\s+/g, '').toUpperCase(), o.dataset.gives]));
  const params = JSON.parse(document.getElementById('param-data').textContent);
  const $ = id => document.getElementById(id);
  const pm = $('pm'), nameIn = $('pm-name'), kindsBox = $('pm-kinds');
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const day = iso => new Date(iso + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const fnIcon = '<i class="ph ph-function" aria-label="Function"></i>';
  const isFn = v => String(v).includes('(');
  const names = p => p.kind === 'period' ? [p.name + '_from', p.name + '_to'] : [p.name];
  const shown = p => p.kind === 'several' ? p.value.join(', ') || 'none' : p.kind === 'period' ? `${p.value} → ${p.to}` : String(p.value);
  // A date value in words: a function gives a date today, a date is itself
  const dateOf = v => { const g = GIVES.get(v.replace(/\s+/g, '').toUpperCase()) || (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null); return g ? day(g) : null; };
  const gives = p => {
    if (p.kind === 'date' && isFn(p.value)) return fnIcon + (dateOf(p.value) ? dateOf(p.value) + ' today' : 'worked out at every run');
    if (p.kind === 'period' && (isFn(p.value) || isFn(p.to))) return fnIcon + `${dateOf(p.value) || '…'} to ${dateOf(p.to) || '…'} today`;
    return '';
  };
  // Where an @name is in the SQL: the line it is first on
  const inSql = () => {
    const at = new Map();
    document.querySelectorAll('.sql-editor .sql-param[data-param]').forEach(s => { if (!at.has(s.dataset.param)) at.set(s.dataset.param, +s.closest('.ln').querySelector('.ln-no').textContent); });
    return at;
  };
  const lineOf = (p, at) => names(p).map(n => at.get(n)).find(Boolean);
  const missing = at => { const known = new Set(params.flatMap(names)); return [...at.keys()].filter(n => !known.has(n)); };

  const render = () => {
    const at = inSql(), undef = missing(at);
    document.querySelectorAll('.sql-editor .sql-param[data-param]').forEach(s => {
      const u = undef.includes(s.dataset.param);
      s.classList.toggle('undefined', u); s.title = u ? 'Not among the parameters: click to define it' : '';
    });
    $('pbox-summary').innerHTML = params.map(p => {
      const line = lineOf(p, at), g = gives(p);
      return `<button class="pchip${line ? '' : ' unused'}" data-edit="${p.name}" title="${line ? 'In the query on line ' + line : 'Not in the query'}"><span class="mono">@${p.name}</span><span>${g ? g.replace(' today', '') : esc(shown(p))}</span></button>`;
    }).join('') + undef.map(n => `<button class="pchip undefined" data-define="${n}" title="In the query, not a parameter: click to define it"><i class="ph-fill ph-warning"></i><span class="mono">@${n}</span><span>not defined</span></button>`).join('');
    $('ptiles').innerHTML = params.map(p => {
      const line = lineOf(p, at), [kind, icon] = KINDS[p.kind], g = gives(p);
      return `<button class="ptile${line ? '' : ' unused'}" data-edit="${p.name}"><span class="ptile-head"><span class="mono">@${p.name}</span><span class="kind-chip"><i class="ph ${icon}"></i>${kind}</span></span>`
        + `<span class="ptile-value" title="${esc(shown(p))}">${esc(shown(p))}</span>${g ? `<span class="ptile-gives">${g}</span>` : ''}`
        + `<span class="ptile-state">${line ? 'In the query on line ' + line : 'Not in the query: it is not sent'}</span></button>`;
    }).join('') + undef.map(n => `<button class="ptile undefined" data-define="${n}"><span class="ptile-head"><i class="ph-fill ph-warning"></i><span class="mono">@${n}</span></span>`
      + `<span class="ptile-state">In the query on line ${at.get(n)}, but not a parameter. Define it</span></button>`).join('');
    $('run-btn').disabled = undef.length > 0;
    $('run-pf').hidden = undef.length > 0;
    $('run-note').hidden = !undef.length;
    $('run-note-text').innerHTML = `${undef.map(n => `<span class="mono">@${n}</span>`).join(', ')} ${undef.length > 1 ? 'are' : 'is'} in the query, but not a parameter.`;
  };

  // The box folds open and shut by its head; its chips and tiles open the window
  const fold = open => { pbox.classList.toggle('open', open); pbox.querySelector('.pbox-toggle').setAttribute('aria-expanded', open); };
  pbox.querySelector('.pbox-head').addEventListener('click', e => { if (!e.target.closest('button') || e.target.closest('.pbox-toggle')) fold(!pbox.classList.contains('open')); });

  // The window holds one Parameter: the one chosen, or a new one
  let current = null;
  kindsBox.innerHTML = Object.entries(KINDS).map(([k, [n, icon, type]]) => `<button class="kind-opt" type="button" role="radio" aria-checked="false" data-kind="${k}" title="${type}"><i class="ph ${icon}"></i>${n}</button>`).join('');
  const values = () => document.querySelector('input[name="pm-src"]:checked').value === 'typed'
    ? $('pm-typed').value.split('\n').map(v => v.trim()).filter(Boolean) : COLUMNS[$('pm-col').value];
  const fillList = (value, kind) => {
    const vals = values();
    $('pm-pick').innerHTML = vals.map(v => `<option${v === value ? ' selected' : ''}>${esc(v)}</option>`).join('');
    $('pm-chips').innerHTML = vals.map(v => `<button class="use-chip${kind === 'several' && value.includes(v) ? ' on' : ''}" type="button">${esc(v)}</button>`).join('');
  };
  const showKind = kind => {
    kindsBox.querySelectorAll('.kind-opt').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const rows = { scalar: ['date', 'number', 'decimal', 'text'], period: ['period'], list: ['choice', 'several'], choice: ['choice'], several: ['several'], yesno: ['yesno'] };
    pm.querySelectorAll('.pe-row[data-row]').forEach(r => { r.hidden = !rows[r.dataset.row].includes(kind); });
    if (kind === 'date') $('pm-value').setAttribute('list', 'pm-date-fns'); else $('pm-value').removeAttribute('list');
    $('pm-value').placeholder = { date: 'DATE_TRUNC(CURRENT_DATE(), YEAR)', number: '10', decimal: '350000.50', text: '8000' }[kind] || '';
    gave();
  };
  const kindNow = () => kindsBox.querySelector('.kind-opt.on').dataset.kind;
  const gave = () => {
    const k = kindNow(), v = $('pm-value').value.trim();
    $('pm-gives').innerHTML = (k === 'date' && v && isFn(v) ? fnIcon + (dateOf(v) ? dateOf(v) + ' today, worked out at every run. ' : 'Worked out at every run. ') : '') + (HINTS[k] || '');
    const f = $('pm-from').value.trim(), t = $('pm-to').value.trim();
    $('pm-pgives').innerHTML = (isFn(f) || isFn(t) ? fnIcon + `${dateOf(f) || '…'} to ${dateOf(t) || '…'} today. ` : '') + `Each a date or an SQL function. In the SQL: <span class="mono">@${esc(nameIn.value || 'name')}_from</span> and <span class="mono">@${esc(nameIn.value || 'name')}_to</span>.`;
  };
  // What the window says about the Parameter; a refusal of Save goes again once its name or value changes
  let said = ['', false];
  const state = (text, warn) => { $('pm-state').textContent = text; $('pm-state').classList.toggle('warn', !!warn); };
  const say = (text, warn) => { said = [text, warn]; state(text, warn); };
  const open = (name, defines) => {
    const p = params.find(x => x.name === name);
    current = p ? p.name : null;
    const at = inSql();
    // A new Parameter defined from the SQL starts as a choice from the column it is compared with
    const q = p || (defines === 'leadChannel' ? { name: defines, kind: 'choice', value: 'Form', column: 'lead_channel · Weekly lead volume' } : { name: defines || '', kind: 'date', value: '' });
    $('pm-title').textContent = p ? '@' + p.name : defines ? 'Define @' + defines : 'New parameter';
    $('pm-save').textContent = p ? 'Save' : 'Add';
    $('pm-remove').hidden = !p; $('pm-saved').hidden = true;
    nameIn.value = q.name;
    $('pm-value').value = ['date', 'number', 'decimal', 'text'].includes(q.kind) ? q.value : '';
    $('pm-from').value = q.kind === 'period' ? q.value : ''; $('pm-to').value = q.kind === 'period' ? q.to : '';
    $('pm-bool').value = q.kind === 'yesno' ? q.value : 'No';
    pm.querySelector(`input[name="pm-src"][value="${q.typed ? 'typed' : 'column'}"]`).checked = true;
    if (q.column) $('pm-col').value = q.column;
    fillList(q.value, q.kind);
    showKind(q.kind);
    const line = p ? lineOf(p, at) : at.get(defines);
    if (defines) say(`In the query on line ${line}, but not a parameter yet.` + (defines === 'leadChannel' ? ' Suggested as a choice: in the SQL it is compared with lead_channel.' : ''), true);
    else if (p) say(line ? `In the query on line ${line}.` : 'Not in the query: it is not sent with it.');
    else say('');
    pm.hidden = false;
    if (pm.classList.contains('folded')) pm.querySelector('.float-fold').click();
    nameIn.focus({ preventScroll: true });
  };
  kindsBox.addEventListener('click', e => { const b = e.target.closest('.kind-opt'); if (b) { showKind(b.dataset.kind); fillList($('pm-pick').value, b.dataset.kind); } });
  ['pm-value', 'pm-from', 'pm-to'].forEach(id => $(id).addEventListener('input', () => { gave(); state(...said); }));
  // A name is an SQL name: letters, digits and underscores
  nameIn.addEventListener('input', () => { nameIn.value = nameIn.value.replace(/[^A-Za-z0-9_]/g, ''); gave(); state(...said); });
  pm.querySelectorAll('input[name="pm-src"], #pm-col, #pm-typed').forEach(el => el.addEventListener('change', () => fillList($('pm-pick').value, kindNow())));
  $('pm-chips').addEventListener('click', e => e.target.closest('.use-chip')?.classList.toggle('on'));
  $('pm-save').addEventListener('click', () => {
    const name = nameIn.value, kind = kindNow();
    if (!name) return state('Give it a name.', true);
    if (params.some(x => x.name === name && x.name !== current)) return state(`@${name} is already a parameter.`, true);
    const p = { name, kind };
    if (kind === 'period') Object.assign(p, { value: $('pm-from').value.trim(), to: $('pm-to').value.trim() });
    else if (kind === 'choice') p.value = $('pm-pick').value;
    else if (kind === 'several') p.value = [...$('pm-chips').querySelectorAll('.use-chip.on')].map(c => c.textContent);
    else if (kind === 'yesno') p.value = $('pm-bool').value;
    else p.value = $('pm-value').value.trim();
    if (p.value === '' || (kind === 'period' && !p.to)) return state('Give it a value.', true);
    if (kind === 'choice' || kind === 'several') Object.assign(p, { column: $('pm-col').value, typed: document.querySelector('input[name="pm-src"]:checked').value === 'typed' });
    const i = params.findIndex(x => x.name === current);
    if (i >= 0) params[i] = p; else params.push(p);
    render(); open(p.name); $('pm-saved').hidden = false;
  });
  $('pm-remove').addEventListener('click', () => { const i = params.findIndex(x => x.name === current); if (i >= 0) params.splice(i, 1); render(); pm.hidden = true; });
  $('param-add').addEventListener('click', () => open(null));
  // Everything that names a Parameter opens it; an @name that is not one opens it to be defined
  document.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]'), define = e.target.closest('[data-define], .sql-param.undefined');
    if (edit) open(edit.dataset.edit);
    else if (define) open(null, define.dataset.define || define.dataset.param);
    else if (e.target.closest('[data-define-first]')) open(null, missing(inSql())[0]);
  });
  render();
}

// The result of a query, as a grid like that of BigQuery (Proposal): the row number, then a column per field with its
// type. The edge of a column head makes it narrower or wider; a double click fits it to its values. 100 rows a page,
// read from the same run (FR-SR-51); the menu of a column sorts this page only. A click selects a cell, and Ctrl+C
// copies it
const grid = document.getElementById('result-grid');
if (grid) {
  // Prototype only: the 210 rows of the last run, made up the same way every time
  const random = (seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(27);
  const SOURCES = [['website', 'Website', 430], ['app', 'App', 104], ['partner', 'Partner network', 38], ['mailing', 'Mailing', 24], ['imported_2019', null, 3]];
  const COLS = [{ name: 'week_start', type: 'DATE' }, { name: 'lead_source', type: 'STRING' }, { name: 'source_name', type: 'STRING' }, { name: 'leads', type: 'INT64' }, { name: 'share_of_week', type: 'FLOAT64' }];
  const rows = [];
  for (let w = 0; w < 42; w++) {
    const week = new Date(Date.UTC(2026, 9, 19 - 7 * w)).toISOString().slice(0, 10);
    const counts = SOURCES.map(([code, name, base]) => [week, code, name, Math.round(base * (0.8 + 0.4 * random()))]);
    const total = counts.reduce((n, r) => n + r[3], 0);
    counts.sort((a, b) => b[3] - a[3]).forEach(r => rows.push([...r, Math.round(1000 * r[3] / total) / 10]));
  }
  const PAGE = 100, pages = Math.ceil(rows.length / PAGE);
  const table = grid.querySelector('table'), colgroup = table.querySelector('colgroup'), thead = table.querySelector('thead'), tbody = table.querySelector('tbody');
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const isNum = c => ['INT64', 'FLOAT64', 'NUMERIC'].includes(c.type);
  // As BigQuery shows them: a FLOAT64 keeps its decimal, so 71 reads 71.0
  const text = (v, c) => v === null ? 'null' : c.type === 'FLOAT64' && Number.isInteger(v) ? v.toFixed(1) : String(v);
  let page = 0, sort = null, widths = COLS.map(c => isNum(c) ? 110 : 150);
  const ROW_W = 56;

  colgroup.innerHTML = `<col style="width:${ROW_W}px">` + COLS.map(() => '<col>').join('');
  const cols = [...colgroup.children].slice(1);
  const applyWidths = () => {
    cols.forEach((c, i) => { c.style.width = widths[i] + 'px'; });
    table.style.width = ROW_W + widths.reduce((a, b) => a + b, 0) + 'px';
  };
  thead.innerHTML = `<tr><th class="rn" scope="col">Row</th>${COLS.map((c, i) => `<th scope="col" data-col="${i}"><span class="rh"><span class="rh-text"><span class="rh-name"><span>${c.name}</span><i class="ph rh-sorted" hidden></i></span><span class="rh-type">${c.type}</span></span>`
    + `<button class="icon-btn rh-menu" aria-label="Menu of ${c.name}" aria-haspopup="menu"><i class="ph ph-caret-down"></i></button></span><span class="rh-resize" title="Drag to resize, double-click to fit"></span></th>`).join('')}</tr>`;

  const draw = () => {
    const slice = rows.slice(page * PAGE, page * PAGE + PAGE);
    if (sort) slice.sort((a, b) => {
      const x = a[sort.col], y = b[sort.col];
      const d = x === null ? 1 : y === null ? -1 : x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === 'asc' ? d : -d;
    });
    tbody.innerHTML = slice.map((r, i) => `<tr><td class="rn">${page * PAGE + i + 1}</td>${r.map((v, j) =>
      `<td class="${isNum(COLS[j]) ? 'num' : ''}" title="${esc(text(v, COLS[j]))}">${v === null ? '<span class="null">null</span>' : esc(text(v, COLS[j]))}</td>`).join('')}</tr>`).join('');
    thead.querySelectorAll('.rh-sorted').forEach((icon, j) => {
      icon.hidden = !sort || sort.col !== j;
      icon.className = 'ph rh-sorted ' + (sort?.dir === 'desc' ? 'ph-arrow-down' : 'ph-arrow-up');
    });
    document.getElementById('rg-range').textContent = `${page * PAGE + 1} – ${Math.min(rows.length, (page + 1) * PAGE)} of ${rows.length}`;
    document.getElementById('rg-total').textContent = `${rows.length} rows`;
    const at = { first: page === 0, prev: page === 0, next: page === pages - 1, last: page === pages - 1 };
    document.querySelectorAll('[data-page]').forEach(b => { b.disabled = at[b.dataset.page]; });
  };
  // A column fits the longest of its head and its values on this page
  const measure = document.createElement('canvas').getContext('2d');
  const fit = i => {
    const font = el => { const f = getComputedStyle(el); return `${f.fontWeight} ${f.fontSize} ${f.fontFamily}`; };
    measure.font = font(thead.querySelector('.rh-name'));
    let w = measure.measureText(COLS[i].name).width;
    measure.font = font(thead.querySelector('.rh-type'));
    w = Math.max(w, measure.measureText(COLS[i].type).width) + 52;
    measure.font = font(tbody.querySelector('td:not(.rn)') || grid);
    tbody.querySelectorAll(`tr td:nth-child(${i + 2})`).forEach(td => { w = Math.max(w, measure.measureText(td.textContent).width + 24); });
    widths[i] = Math.min(Math.ceil(w), 420); applyWidths();
  };
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => {
    page = { first: 0, prev: page - 1, next: page + 1, last: pages - 1 }[b.dataset.page];
    sort = null; draw(); grid.scrollTop = 0;
  }));

  // Narrower or wider by the edge of a head: dragged, or double-clicked to fit
  thead.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.rh-resize'); if (!handle) return;
    e.preventDefault();
    const i = +handle.closest('th').dataset.col, x0 = e.clientX, w0 = widths[i];
    handle.setPointerCapture(e.pointerId); handle.classList.add('on');
    const move = m => { widths[i] = Math.max(60, Math.round(w0 + m.clientX - x0)); applyWidths(); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', () => { handle.removeEventListener('pointermove', move); handle.classList.remove('on'); }, { once: true });
  });
  thead.addEventListener('dblclick', e => { const handle = e.target.closest('.rh-resize'); if (handle) fit(+handle.closest('th').dataset.col); });

  // The menu of a column
  const menu = document.getElementById('rg-menu');
  let menuCol = null;
  thead.addEventListener('click', e => {
    const b = e.target.closest('.rh-menu'); if (!b) return;
    menuCol = +b.closest('th').dataset.col;
    const r = b.getBoundingClientRect();
    menu.hidden = false;
    Object.assign(menu.style, { top: r.bottom + 6 + 'px', left: Math.min(r.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12) + 'px' });
    e.stopPropagation();
  });
  menu.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'asc' || act === 'desc') { sort = { col: menuCol, dir: act }; draw(); }
    if (act === 'fit') fit(menuCol);
    if (act === 'copy') navigator.clipboard?.writeText(COLS[menuCol].name).catch(() => {});
    menu.hidden = true;
  });
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.hidden = true; });
  grid.addEventListener('scroll', () => { menu.hidden = true; });

  // A cell is selected with a click, and copied with Ctrl+C or Cmd+C
  let selected = null;
  tbody.addEventListener('click', e => {
    const td = e.target.closest('td'); if (!td || td.classList.contains('rn')) return;
    selected?.classList.remove('sel'); selected = td; td.classList.add('sel'); grid.focus({ preventScroll: true });
  });
  grid.addEventListener('keydown', e => {
    if (e.key === 'Escape') { selected?.classList.remove('sel'); selected = null; menu.hidden = true; }
    if (selected && (e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); navigator.clipboard?.writeText(selected.title).catch(() => {}); }
  });

  applyWidths(); draw();
  document.fonts.ready.then(() => COLS.forEach((c, i) => fit(i)));
}
