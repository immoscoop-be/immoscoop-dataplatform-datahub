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
