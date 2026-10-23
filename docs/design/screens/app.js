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
    g.querySelectorAll('.tree-res').forEach(r => { const m = own || r.querySelector('.clip').firstChild.textContent.toLowerCase().includes(q); r.hidden = !m; if (m) hits++; });
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
    document.querySelectorAll(`[data-pane-group="${group.dataset.group}"]`).forEach(p => p.hidden = p.dataset.pane !== b.dataset.target);
  }));
});

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
