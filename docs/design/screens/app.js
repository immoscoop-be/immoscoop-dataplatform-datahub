// Shared prototype behaviour. Prototype only: no data, no routing.
const app = document.querySelector('.app');

// Theme toggle (light / dark), remembered per viewer
const themeBtn = document.getElementById('theme');
try { const t = localStorage.getItem('dh-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); document.documentElement.dataset.theme = t; } catch (e) {}

// The background (DEC-UX-94, DEC-UX-108): a set per theme. The User chooses two on My page, one for day and one for
// night, each from the set of its theme, or Random, the default: one picked at random when Data Hub starts, kept for the
// session, and picked again when the theme switches. ?bg= in the address still sets one, for the prototype
const BACKGROUNDS = { light: ['', 'ski', 'alpenglow', 'spring', 'fusilli', 'piste', 'concrete', 'peaks', 'flow', 'periwinkle', 'sunrise', 'apricot', 'blush', 'sky'], dark: ['', 'village', 'flow', 'aurora', 'ember', 'dusk', 'horizon'] };
// The backgrounds drawn live with WebGL: the flowing gradient, and the flowing lights (DEC-UX-109)
const FLOWS = ['flow', 'aurora', 'ember', 'dusk', 'horizon', 'periwinkle', 'sunrise', 'apricot', 'blush', 'sky'];
const setBg = bg => { if (bg) document.documentElement.dataset.bg = bg; else delete document.documentElement.dataset.bg; };
const pickBg = theme => {
  const set = BACKGROUNDS[theme] || BACKGROUNDS.light, bg = set[Math.floor(Math.random() * set.length)];
  try { sessionStorage.setItem('dh-bg', bg); } catch (e) {}
  return bg;
};
const bgChoice = theme => { let c = null; try { c = localStorage.getItem('dh-bg-' + theme); } catch (e) {} return c === null ? 'random' : c; };
const saveBgChoice = (theme, c) => { try { localStorage.setItem('dh-bg-' + theme, c); } catch (e) {} };
// The background for a theme: the one chosen for it, otherwise one at random
const bgFor = (theme, keepSession) => {
  const c = bgChoice(theme);
  if (c !== 'random' && BACKGROUNDS[theme].includes(c)) return c;
  let bg = null; if (keepSession) try { bg = sessionStorage.getItem('dh-bg'); } catch (e) {}
  return bg !== null && BACKGROUNDS[theme].includes(bg) ? bg : pickBg(theme);
};
// The flowing gradient starts its canvas when the page loads; chosen later, the page loads again to start it
const showBg = bg => { if (FLOWS.includes(bg) && !document.querySelector('canvas.bg-flow')) location.reload(); else setBg(bg); };
// The tab Background of My page shows the choices of the current theme, with the one chosen for it marked
const syncBgOpts = () => {
  const theme = document.documentElement.dataset.theme || 'light', c = bgChoice(theme);
  document.querySelectorAll('.bg-theme-name').forEach(el => { el.textContent = theme === 'dark' ? 'night' : 'day'; });
  document.querySelectorAll('.bg-theme-other').forEach(el => { el.textContent = theme === 'dark' ? 'day' : 'night'; });
  document.querySelectorAll('.bg-opt').forEach(o => {
    o.hidden = !o.dataset.themes.split(' ').includes(theme);
    const on = o.dataset.bgchoice === c; o.classList.toggle('on', on); o.setAttribute('aria-checked', on);
  });
};
if (!new URLSearchParams(location.search).has('bg')) setBg(bgFor(document.documentElement.dataset.theme || 'light', true));
syncBgOpts();
document.querySelectorAll('.bg-opt').forEach(o => o.addEventListener('click', () => {
  saveBgChoice(document.documentElement.dataset.theme || 'light', o.dataset.bgchoice); syncBgOpts();
  showBg(bgFor(document.documentElement.dataset.theme || 'light', false));
}));

themeBtn?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  // Day and night switch at once, with every transition off for that moment (DEC-UX-149).
  document.documentElement.classList.add('theme-switching');
  document.documentElement.dataset.theme = next;
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('theme-switching')));
  try { localStorage.setItem('dh-theme', next); } catch (e) {}
  const bg = bgFor(next, false); syncBgOpts(); showBg(bg);
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
// ?role=owner, ?size=large; ?bg=ski shows the picture as the background (DEC-UX-34), ?bg=flow a flowing gradient
new URLSearchParams(location.search).forEach((value, key) => {
  if (key === 'role') document.documentElement.dataset.role = value;
  if (key === 'bg') document.documentElement.dataset.bg = value;
  document.querySelector(`[data-group="${key}"] [data-target="${value}"]`)?.click();
});

// ?bg=flow (DEC-UX-80): a flowing gradient in place of the picture, drawn live with WebGL on a canvas fixed behind the app.
// By day sky blue, a warm orange band and cream; by night, in the dark theme, a dark sky with a band of teal, violet and
// magenta and a warm coral glow, along the same rising line. The mouse leans the field and bends the band towards it,
// eased over seconds. One loop of 15 seconds meets its start exactly; 30 frames a
// second at half resolution, paused with the tab; a still frame for reduced motion, drawn again when the theme changes.
// Without WebGL the usual background of the app stays
if (FLOWS.includes(document.documentElement.dataset.bg)) (() => {
  const PERIOD = 15, RESOLUTION = 0.5, FPS = 30;
  const canvas = Object.assign(document.createElement('canvas'), { className: 'bg-flow' });
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, powerPreference: 'low-power' });
  const fallback = () => { delete document.documentElement.dataset.bg; };
  if (!gl) return fallback();
  const VERTEX = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const DAY = `
    precision highp float;
    uniform vec4 uA;         // by day: four angles, each turning at a random speed from a random start, so it never repeats
    uniform vec2 uRes;
    uniform vec2 uPointer;   // the eased pointer, 0 to 1 from the bottom left
    uniform float uPull;     // how present the pointer is, 0 to 1
    varying vec2 vUv;
    vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      // A soft warp of the whole field, large enough to be seen
      vec2 p = uv;
      p.x += 0.090 * sin(uv.y * 3.1 + uA.x) + 0.036 * sin(uv.y * 5.3 - uA.y);
      p.y += 0.066 * sin(uv.x * 2.7 - uA.z) + 0.030 * cos(uv.x * 6.1 + uA.w);
      // The pointer: the whole field leans a little towards it
      p -= 0.035 * (uPointer - 0.5) * uPull;

      // The centre line of the orange band: low on the left, high on the right, in a soft S
      float c = 0.30 + 0.56 * smoothstep(0.02, 1.05, p.x) + 0.10 * sin(p.x * 3.0 + uA.x) + 0.06 * sin(uA.y);
      // ... and the band bends towards it where it is near
      c += 0.14 * (uPointer.y - c) * exp(-pow((p.x - uPointer.x) / 0.30, 2.0)) * uPull;
      float d = p.y - c;

      // Below: cream, warming to peach towards the band
      vec3 base = mix(rgb(243.0, 226.0, 212.0), rgb(238.0, 196.0, 164.0), smoothstep(0.0, 0.6, p.y + 0.18 * p.x));

      // Above: sky blue, deepest in the top left, paler towards the band
      float tl = clamp((1.0 - p.x) * 0.9 + p.y * 0.7 - 0.45, 0.0, 1.0);
      vec3 sky = mix(rgb(188.0, 204.0, 226.0), rgb(108.0, 165.0, 234.0), tl);
      vec3 col = mix(base, sky, smoothstep(0.0, 0.36, d));

      // The band: softer and lighter on the left, wider and deeper on the right
      float w = 0.085 + 0.085 * p.x + 0.04 * sin(uA.w + 1.3);
      float band = exp(-(d * d) / (w * w));
      vec3 orange = mix(rgb(240.0, 166.0, 112.0), rgb(232.0, 132.0, 60.0), smoothstep(0.15, 0.85, p.x + 0.25 * band));
      col = mix(col, orange, band * (0.72 + 0.24 * p.x));

      // A trace of noise against banding in the smooth steps
      col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const NIGHT = `
    precision highp float;
    uniform vec4 uA;         // four angles, each turning at a random speed from a random start, so it never repeats
    uniform vec2 uRes;
    uniform vec2 uPointer;   // the eased pointer, 0 to 1 from the bottom left
    uniform float uPull;     // how present the pointer is, 0 to 1
    varying vec2 vUv;
    vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // Light added as on a screen: it brightens, but never past white, and black stays black where nothing glows
    vec3 screen(vec3 base, vec3 light, float amount) { return 1.0 - (1.0 - base) * (1.0 - light * amount); }
    void main() {
      vec2 uv = vUv;
      vec2 p = uv;
      p.x += 0.090 * sin(uv.y * 3.1 + uA.x) + 0.036 * sin(uv.y * 5.3 - uA.y);
      p.y += 0.066 * sin(uv.x * 2.7 - uA.z) + 0.030 * cos(uv.x * 6.1 + uA.w);
      // The pointer: the whole field leans a little towards it
      p -= 0.035 * (uPointer - 0.5) * uPull;

      // The same rising line as by day: the glowing band runs along it
      float c = 0.40 + 0.42 * smoothstep(0.0, 1.05, p.x) + 0.10 * sin(p.x * 3.0 + uA.x) + 0.06 * sin(uA.y);
      // ... and the band bends towards it where it is near
      c += 0.14 * (uPointer.y - c) * exp(-pow((p.x - uPointer.x) / 0.30, 2.0)) * uPull;
      float d = p.y - c;

      // Above: the night sky, black in the top left, a trace of navy towards the band
      vec3 col = mix(rgb(5.0, 5.0, 9.0), rgb(16.0, 22.0, 44.0), smoothstep(0.32, 0.0, d) * (0.4 + 0.6 * p.x));
      // Below: deep purple
      col = mix(col, rgb(52.0, 16.0, 64.0), smoothstep(0.0, -0.35, d));

      // The band, in layers across its width: teal on top, then violet, then magenta; brightest on the right
      float lift = 0.04 * sin(uA.w + 1.3);
      float teal = exp(-pow((d - 0.01 - lift) / (0.10 + 0.05 * p.x), 2.0)) * (0.28 + 0.52 * p.x);
      float violet = exp(-pow((d + 0.15) / 0.13, 2.0)) * (0.55 + 0.35 * (1.0 - abs(p.x - 0.45)));
      float magenta = exp(-pow((d + 0.36) / 0.15, 2.0)) * (0.55 + 0.4 * smoothstep(0.9, 0.3, p.x)) * smoothstep(-0.1, 0.35, p.x);
      col = screen(col, rgb(46.0, 122.0, 178.0), teal);
      col = screen(col, rgb(100.0, 82.0, 168.0), violet * 0.8);
      col = screen(col, rgb(150.0, 34.0, 118.0), magenta * 0.9);

      // A warm coral glow in the bottom left, breathing slowly
      vec2 q = (p - vec2(-0.06, -0.02)) / vec2(0.34 + 0.06 * sin(uA.z), 0.44);
      col = mix(col, rgb(206.0, 124.0, 92.0), exp(-dot(q, q)) * 0.82);

      // A trace of noise against banding in the smooth steps
      col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`;
  // The flowing lights (DEC-UX-109): soft spots and arcs of colour, each drifting, breathing and turning at a random
  // speed of its own. By night their light adds up on black, as light does, with a soft curve that keeps it from
  // clipping; by day each is painted over a pale ground, as watercolour is
  const LIGHTS = `
    precision highp float;
    uniform vec2 uRes;
    uniform vec3 uBase;
    uniform float uPaint;    // 0: light on black, by night; 1: paint on a pale ground, by day
    uniform vec4 uL[7];      // per light: x and y (0 to 1, from the bottom left), its softness, and the radius of its arc (0: a spot)
    uniform vec4 uC[7];      // per light: its colour, and its strength
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      float asp = uRes.x / uRes.y;
      vec2 p = vec2(vUv.x * asp, vUv.y);
      vec3 light = uBase, paint = uBase;
      for (int i = 0; i < 7; i++) {
        float dist = length(p - vec2(uL[i].x * asp, uL[i].y));
        float d = uL[i].w > 0.0 ? dist - uL[i].w : dist;
        float w = exp(-(d * d) / (uL[i].z * uL[i].z)) * uC[i].w;
        light += uC[i].rgb * w;
        paint = mix(paint, uC[i].rgb, clamp(w, 0.0, 1.0));
      }
      vec3 col = mix(1.0 - exp(-light), paint, uPaint);
      col += (hash(gl_FragCoord.xy) - 0.5) / 128.0;
      gl_FragColor = vec4(col, 1.0);
    }`;
  // The scenes, after pictures Max chose on 2026-10-28; per light [x, y, softness, arc, r, g, b, strength]
  const SCENES = {
    // By night: light on black
    aurora: { paint: 0, base: [0.0, 0.0, 0.01], lights: [
      [1.15, 1.05, 0.07, 0.90, 0.04, 0.08, 1.00, 2.6], [0.95, 0.40, 0.32, 0, 1.00, 0.41, 0.86, 2.2], [1.05, 0.30, 0.18, 0, 1.00, 0.88, 1.00, 1.6],
      [0.95, 0.80, 0.22, 0, 1.00, 0.15, 0.21, 2.4], [0.90, 1.05, 0.18, 0, 1.00, 0.17, 0.00, 0.9], [0.62, 0.55, 0.28, 0, 0.50, 0.25, 1.00, 1.0], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    ember: { paint: 0, base: [0.0, 0.0, 0.0], lights: [
      [0.15, 1.02, 0.16, 0, 0.00, 0.82, 1.00, 1.1], [0.42, 1.00, 0.14, 0, 1.00, 0.11, 0.50, 1.4], [0.62, 1.02, 0.17, 0, 1.00, 0.08, 0.03, 1.8],
      [0.20, -0.02, 0.24, 0, 1.00, 0.38, 0.00, 2.4], [0.50, 0.00, 0.20, 0, 1.00, 0.05, 0.18, 1.9], [0.82, 0.05, 0.22, 0, 0.00, 0.44, 1.00, 1.6], [0.70, 0.30, 0.15, 0, 0.20, 0.28, 1.00, 0.25]] },
    dusk: { paint: 0, base: [0.0, 0.0, 0.0], lights: [
      [0.08, 0.38, 0.24, 0, 1.00, 0.65, 0.00, 2.6], [0.28, 0.33, 0.20, 0, 1.00, 0.32, 0.02, 2.2], [0.50, 0.45, 0.18, 0, 1.00, 0.39, 0.56, 1.8],
      [0.66, 0.55, 0.20, 0, 0.93, 0.18, 1.00, 1.4], [0.60, 0.75, 0.20, 0, 0.32, 0.07, 1.00, 1.1], [0.85, 0.32, 0.20, 0, 1.00, 0.06, 0.16, 1.6], [0.00, 0.60, 0.15, 0, 1.00, 0.17, 0.00, 0.6]] },
    horizon: { paint: 0, base: [0.0, 0.13, 0.22], lights: [
      [0.85, 1.00, 0.38, 0, 1.00, 1.00, 1.00, 3.0], [0.30, 1.00, 0.30, 0, 0.21, 0.86, 1.00, 1.4], [0.90, 1.15, 0.10, 0.62, 1.00, 0.50, 0.20, 2.0],
      [0.12, 0.12, 0.32, 0, 1.00, 0.21, 0.02, 2.8], [0.48, 0.05, 0.24, 0, 1.00, 0.50, 0.09, 2.2], [0.95, 0.00, 0.20, 0, 1.00, 0.50, 0.30, 0.5], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    // By day: paint on a pale ground
    periwinkle: { paint: 1, base: [0.69, 0.79, 1.00], lights: [
      [0.38, 0.82, 0.16, 0, 1.00, 1.00, 1.00, 0.95], [0.50, 0.70, 0.12, 0, 0.36, 0.55, 0.98, 0.80], [0.36, 0.40, 0.18, 0, 1.00, 1.00, 1.00, 0.90],
      [0.56, 0.32, 0.20, 0, 0.30, 0.50, 0.97, 0.85], [0.30, 0.68, 0.14, 0, 0.55, 0.70, 0.99, 0.5], [0.70, 0.55, 0.18, 0, 0.82, 0.88, 1.00, 0.5], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    sunrise: { paint: 1, base: [1.00, 0.98, 0.90], lights: [
      [0.00, 0.40, 0.22, 0, 1.00, 0.42, 0.22, 1.0], [0.20, 0.45, 0.24, 0, 1.00, 0.62, 0.20, 0.9], [0.42, 0.52, 0.26, 0, 1.00, 0.82, 0.38, 0.9],
      [0.95, 0.05, 0.28, 0, 0.82, 0.97, 1.00, 0.9], [0.05, 0.15, 0.16, 0, 1.00, 0.70, 0.62, 0.6], [0.75, 0.80, 0.30, 0, 1.00, 0.95, 0.78, 0.6], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    apricot: { paint: 1, base: [1.00, 0.80, 0.45], lights: [
      [0.85, 0.95, 0.30, 0, 1.00, 0.55, 0.15, 0.9], [0.00, 0.55, 0.20, 0, 1.00, 0.55, 0.30, 0.8], [0.55, 0.40, 0.08, 0.30, 1.00, 0.98, 0.78, 0.95],
      [0.60, 0.35, 0.22, 0, 0.98, 0.98, 0.72, 0.8], [0.95, 0.10, 0.24, 0, 1.00, 0.88, 0.25, 0.8], [0.20, 0.90, 0.20, 0, 1.00, 0.85, 0.55, 0.6], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    blush: { paint: 1, base: [1.00, 0.86, 0.86], lights: [
      [0.92, 0.95, 0.12, 0, 1.00, 0.47, 0.36, 0.95], [0.85, 0.35, 0.24, 0, 1.00, 0.40, 0.55, 0.95], [0.50, 0.60, 0.22, 0, 1.00, 0.52, 0.56, 0.75],
      [0.15, 0.25, 0.22, 0, 1.00, 0.70, 0.55, 0.85], [0.05, 0.80, 0.20, 0, 1.00, 0.88, 0.88, 0.7], [0.60, 0.05, 0.20, 0, 1.00, 0.70, 0.78, 0.6], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
    sky: { paint: 1, base: [0.86, 0.93, 0.99], lights: [
      [0.25, 0.80, 0.12, 0.55, 1.00, 1.00, 1.00, 0.9], [0.95, 0.20, 0.20, 0, 0.18, 0.47, 0.93, 0.95], [0.80, 0.35, 0.22, 0, 0.55, 0.75, 0.98, 0.8],
      [0.50, 0.05, 0.20, 0, 0.94, 0.97, 1.00, 0.8], [0.10, 0.40, 0.25, 0, 0.92, 0.96, 1.00, 0.7], [0.70, 0.90, 0.25, 0, 0.75, 0.86, 0.98, 0.6], [0, 0, 0.1, 0, 0, 0, 0, 0]] },
  };
  const shader = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const build = fragment => {
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { console.warn('?bg=flow: WebGL could not build the gradient.', gl.getProgramInfoLog(program)); return null; }
    const u = name => gl.getUniformLocation(program, name);
    return { program, uA: u('uA'), uRes: u('uRes'), uPointer: u('uPointer'), uPull: u('uPull'), uBase: u('uBase'), uPaint: u('uPaint'), uL: u('uL'), uC: u('uC') };
  };
  const day = build(DAY), night = build(NIGHT), lights = build(LIGHTS);
  if (!day || !night || !lights) return fallback();
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const grain = Object.assign(document.createElement('div'), { className: 'bg-grain' });
  canvas.setAttribute('aria-hidden', 'true'); grain.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas, grain);

  // The pointer, when it is a mouse: the field leans towards it and the band bends towards it, eased over seconds, so a
  // passing mouse barely stirs it; it settles back when the mouse leaves the window. Not with reduced motion
  const pointer = { x: 0.5, y: 0.5, pull: 0, tx: 0.5, ty: 0.5, tpull: 0, t: 0 };
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    addEventListener('pointermove', e => { if (e.pointerType === 'mouse') Object.assign(pointer, { tx: e.clientX / innerWidth, ty: 1 - e.clientY / innerHeight, tpull: 1 }); });
    document.documentElement.addEventListener('mouseleave', () => { pointer.tpull = 0; });
    addEventListener('blur', () => { pointer.tpull = 0; });
  }
  const ease = t => {
    const dt = Math.min(0.1, Math.max(0, (t - pointer.t) / 1000)); pointer.t = t;
    const k = 1 - Math.exp(-dt / 1.8), kPull = 1 - Math.exp(-dt / 3);
    pointer.x += (pointer.tx - pointer.x) * k; pointer.y += (pointer.ty - pointer.y) * k; pointer.pull += (pointer.tpull - pointer.pull) * kPull;
  };
  let seconds = 0;
  // No loop (DEC-UX-109): each movement turns at a speed of its own, between three quarters and one and a third of its
  // usual one, from a random start; their speeds share no common beat, so the field never repeats, and it differs every
  // time Data Hub starts
  const TURN = Math.PI * 2, rnd = (lo, hi) => lo + Math.random() * (hi - lo);
  const base = [1, 2, 1, 3].map(k => k * TURN / PERIOD);
  const speed = base.map(w => w * rnd(0.75, 1.33)), start = base.map(() => rnd(0, TURN));
  // Each light of a scene drifts on two axes, breathes, and its arc swells, each with a period of 8 to 18 seconds
  const wobble = () => ({ w: Array.from({ length: 4 }, () => TURN / rnd(8, 18)), o: Array.from({ length: 4 }, () => rnd(0, TURN)) });
  const motion = Object.fromEntries(Object.keys(SCENES).map(k => [k, SCENES[k].lights.map(wobble)]));
  const L = new Float32Array(28), C = new Float32Array(28);
  const draw = s => {
    const bg = document.documentElement.dataset.bg, scene = SCENES[bg];
    if (scene) {
      gl.useProgram(lights.program);
      gl.uniform2f(lights.uRes, canvas.width, canvas.height);
      gl.uniform3f(lights.uBase, ...scene.base);
      gl.uniform1f(lights.uPaint, scene.paint);
      scene.lights.forEach(([x, y, r, arc, cr, cg, cb, k], i) => {
        const m = motion[bg][i], f = j => Math.sin(m.o[j] + m.w[j] * s);
        // The pointer draws every light a little towards it
        const lx = x + 0.10 * f(0) + 0.05 * (pointer.x - x) * pointer.pull, ly = y + 0.08 * f(1) + 0.05 * (pointer.y - y) * pointer.pull;
        L.set([lx, ly, r * (1 + 0.18 * f(2)), arc ? arc * (1 + 0.08 * f(3)) : 0], i * 4); C.set([cr, cg, cb, k], i * 4);
      });
      gl.uniform4fv(lights.uL, L); gl.uniform4fv(lights.uC, C);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    const g = document.documentElement.dataset.theme === 'dark' ? night : day;
    gl.useProgram(g.program);
    gl.uniform2f(g.uRes, canvas.width, canvas.height);
    const a = speed.map((w, i) => (start[i] + w * s) % TURN); gl.uniform4f(g.uA, a[0], a[1], a[2], a[3]);
    gl.uniform2f(g.uPointer, pointer.x, pointer.y);
    gl.uniform1f(g.uPull, pointer.pull);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(innerWidth * dpr * RESOLUTION));
    canvas.height = Math.max(1, Math.round(innerHeight * dpr * RESOLUTION));
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw(seconds);
  };
  addEventListener('resize', resize);
  resize();
  new MutationObserver(() => draw(seconds)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-bg'] });
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let last = -Infinity;
  const frame = t => {
    if (still.matches) return;
    requestAnimationFrame(frame);
    if (t - last < 1000 / FPS) return;
    ease(t); last = t; seconds = t / 1000; draw(seconds);
  };
  requestAnimationFrame(frame);
  still.addEventListener?.('change', () => { if (!still.matches) requestAnimationFrame(frame); });
  // Prototype only: show the frame at a given second
  window.flowAt = s => { seconds = s; draw(s); };
  window.flowPointer = (x, y, pull = 1) => { Object.assign(pointer, { x, y, pull, tx: x, ty: y, tpull: pull }); draw(seconds); };
})();

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

// What keeps a query from running (Proposal): an @name in the SQL that is not a Parameter, or a table that is not one of
// the Resources of the query. Both stand out in the SQL, a folded CTE shows it on its "⋯ n lines", and the bar at the
// foot says so in place of the Pre-flight, with Run off. A table outside the Resources also shows next to them, with a
// new query to start with it
let removedRes = null;
// A Resource that requires a partition filter blocks a query without one, and offers to add it (?pf=nofilter)
let noFilter = new URLSearchParams(location.search).get('pf') === 'nofilter';
const syncRun = () => {
  const btn = document.getElementById('run-btn'), editor = document.querySelector('.sql-editor');
  if (!btn || !editor) return;
  const live = sel => [...editor.querySelectorAll(sel)].filter(el => !el.closest('.ln.off'));
  const scope = new Set([...document.querySelectorAll('#scope-chips [data-res]:not([hidden])')].map(c => c.dataset.res));
  live('.sql-key[data-table]').forEach(t => { const out = !scope.has(t.dataset.table); t.classList.toggle('outside', out); t.title = out ? 'Not a resource of this query' : ''; });
  const tables = [...new Set(live('.sql-key.outside').map(t => t.dataset.table))];
  const params = [...new Set(live('.sql-param.undefined').map(t => t.dataset.param))];
  editor.querySelectorAll('[data-fold-start]').forEach(st => st.classList.toggle('has-error',
    [...editor.querySelectorAll(`[data-fold-in="${st.dataset.foldStart}"]:not(.off)`)].some(l => l.querySelector('.sql-key.outside, .sql-param.undefined'))));
  const out = document.getElementById('scope-outside');
  if (out) out.innerHTML = tables.map(t => `<span class="scope-chip outside"><i class="ph-fill ph-warning"></i><span class="mono">${t}</span> is not a resource of this query`
    + (t === removedRes ? '' : `<button class="text-link" type="button" data-add-res="${t}">Start a new query with it</button>`) + '</span>').join('');
  const notes = [];
  if (tables.length) notes.push(`${tables.map(t => `<span class="mono">${t}</span>`).join(', ')} ${tables.length > 1 ? 'are' : 'is'} not a resource of this query.`);
  if (params.length) notes.push(`${params.map(n => `<span class="mono">@${n}</span>`).join(', ')} ${params.length > 1 ? 'are' : 'is'} in the query, but not a parameter.`);
  if (noFilter) notes.push('Weekly lead volume requires a filter on its partition column, <span class="mono">week_start</span>.');
  btn.disabled = notes.length > 0;
  // One line: the Pre-flight or what stops the query, cross-fading (DEC-UX-154).
  document.getElementById('run-pf').classList.toggle('shown', !notes.length);
  document.getElementById('run-note').classList.toggle('shown', notes.length > 0);
  document.getElementById('run-note-text').innerHTML = notes.join(' ');
  document.querySelector('[data-define-first]').hidden = !params.length;
  document.querySelector('[data-add-filter]').hidden = !noFilter;
};

// Above 1 GB Run sends the query to the Data Team (?pf=request, DEC-UX-116): a pop-out over the bar says why, with an
// optional word for them, and Send. Once sent, the bar says since when it waits, and the query in the panel says so too
if (new URLSearchParams(location.search).get('pf') === 'request' && document.getElementById('run-btn')) {
  const btn = document.getElementById('run-btn'), pop = document.getElementById('request-pop'), anchor = btn.closest('.run-anchor');
  // Here @leadChannel is a Parameter already, so nothing else keeps the query from running
  const data = document.getElementById('param-data');
  data.textContent = JSON.stringify([...JSON.parse(data.textContent), { name: 'leadChannel', kind: 'choice', value: 'Form', list: ['Form', 'Phone', 'Email', 'Chat'] }]);
  document.querySelector('#run-pf .gauge-fill').style.width = '100%';
  document.querySelector('#run-pf > .meta:last-child').innerHTML = 'All 312 partitions of Weekly lead volume, through <span class="mono">week_start</span>';
  btn.innerHTML = '<i class="ph ph-paper-plane-tilt" style="font-size:14px"></i>Send to the Data Team<span class="run-gb">4.8 GB</span>';
  btn.addEventListener('click', () => { pop.hidden = !pop.hidden; anchor.classList.toggle('requesting', !pop.hidden); });
  document.getElementById('request-send').addEventListener('click', () => {
    pop.hidden = true; anchor.hidden = true; document.getElementById('run-wait').hidden = false;
    document.querySelector('.q-item.current')?.insertAdjacentHTML('beforeend', '<span class="pill" style="color:var(--signal-urgent)">To the Data Team</span>');
  });
}

// The Parameters of a query (Proposal). Each has a name, a kind from the standard list and a value: a value such as
// 2026-10-25, or an SQL function such as DATE_TRUNC(CURRENT_DATE(), YEAR), worked out at every run. Under the query
// they fold open and shut; they are made and changed in a floating window that moves by its head. A Parameter that is
// not in the SQL is grey: it is not sent. An @name in the SQL that is not a Parameter stands out, in the SQL and under
// it, and keeps the query from running, as BigQuery would refuse it; a click on it defines it
// The box of the SQL folds open and shut, as the Parameters do (DEC-UX-76)
const sqlBox = document.getElementById('sql-box');
if (sqlBox) {
  const foldSql = open => { sqlBox.classList.toggle('open', open); sqlBox.querySelector('.pbox-toggle').setAttribute('aria-expanded', open); };
  sqlBox.querySelector('.sql-head').addEventListener('click', e => { if (!e.target.closest('button') || e.target.closest('.pbox-toggle')) foldSql(!sqlBox.classList.contains('open')); });
}
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
    syncRun();
  };

  // The box folds open and shut by its head; its chips and tiles open the window
  const fold = open => { pbox.classList.toggle('open', open); pbox.querySelector('.pbox-toggle').setAttribute('aria-expanded', open); };
  pbox.querySelector('.pbox-head').addEventListener('click', e => { if (!e.target.closest('button') || e.target.closest('.pbox-toggle')) fold(!pbox.classList.contains('open')); });

  // The window holds one Parameter: the one chosen, or a new one
  let current = null;
  kindsBox.innerHTML = Object.entries(KINDS).map(([k, [n, icon, type]]) => `<button class="kind-opt" type="button" role="radio" aria-checked="false" data-kind="${k}" title="${type}"><i class="ph ${icon}"></i>${n}</button>`).join('');
  // The list of a Choice is typed, one value a line; a list from a column comes later (DEC-UX-117)
  const values = () => $('pm-typed').value.split('\n').map(v => v.trim()).filter(Boolean);
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
    // A new Parameter defined from the SQL starts as a choice when it is compared with a column
    const q = p || (defines === 'leadChannel' ? { name: defines, kind: 'choice', value: 'Form', list: ['Form', 'Phone', 'Email', 'Chat'] } : { name: defines || '', kind: 'date', value: '' });
    $('pm-title').textContent = p ? '@' + p.name : defines ? 'Define @' + defines : 'New parameter';
    $('pm-save').textContent = p ? 'Save' : 'Add';
    $('pm-remove').hidden = !p; $('pm-saved').hidden = true;
    nameIn.value = q.name;
    $('pm-value').value = ['date', 'number', 'decimal', 'text'].includes(q.kind) ? q.value : '';
    $('pm-from').value = q.kind === 'period' ? q.value : ''; $('pm-to').value = q.kind === 'period' ? q.to : '';
    $('pm-bool').value = q.kind === 'yesno' ? q.value : 'No';
    $('pm-typed').value = (q.list || ['Website', 'App']).join('\n');
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
  $('pm-typed').addEventListener('input', () => fillList($('pm-pick').value, kindNow()));
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
    if (kind === 'choice' || kind === 'several') p.list = values();
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
    else if (e.target.closest('[data-add-filter]')) { noFilter = false; syncRun(); }
  });
  render();
}

// The result of a query, as a grid like that of BigQuery (Proposal): the row number, then a column per field with its
// type. The edge of a column head makes it narrower or wider; a double click fits it to its values. 100 rows a page,
// read from the same run (FR-SR-51); the menu of a column sorts this page only. A click selects a cell, and Ctrl+C
// copies it. The same grid shows the result of a Lens (DEC-UX-83): a page gives its rows in #result-data
const grid = document.getElementById('result-grid');
if (grid) {
  const given = document.getElementById('result-data');
  // Prototype only: without #result-data, the 210 rows of the last run of the query, made up the same way every time
  const random = (seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(27);
  const SOURCES = [['website', 'Website', 430], ['app', 'App', 104], ['partner', 'Partner network', 38], ['mailing', 'Mailing', 24], ['imported_2019', null, 3]];
  const data = given ? JSON.parse(given.textContent) : null;
  const COLS = data ? data.cols : [{ name: 'week_start', type: 'DATE' }, { name: 'lead_source', type: 'STRING' }, { name: 'source_name', type: 'STRING' }, { name: 'leads', type: 'INT64' }, { name: 'share_of_week', type: 'FLOAT64' }];
  const rows = data ? data.rows : [];
  if (!data) for (let w = 0; w < 42; w++) {
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

// A query is bounded by its Resources (Proposal): it reads only those, on top of its frame. Adding or removing one
// starts a new query in a sheet, which takes the SQL and its Parameters along and remembers where it came from; the old
// query stays as it was. "Lenses on these resources" shows the lenses that already use them, as for a new query. The
// panel lists one item per query, with its last runs; the history holds every run, each a variation
const scopeBox = document.getElementById('q-scope');
if (scopeBox) {
  const $ = id => document.getElementById(id);
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const NAMES = { weekly_lead_volume: 'Weekly lead volume', lead_sources: 'Lead sources', listings: 'Listings', partner_contracts: 'Partner contracts', saved_searches: 'Saved searches' };
  const scopeNow = () => [...document.querySelectorAll('#scope-chips [data-res]:not([hidden])')].map(c => c.dataset.res);
  // Prototype only: the lenses on a set of Resources
  const LENSES = set => ({
    'lead_sources,weekly_lead_volume': { pane: 'start', exact: 2, more: 1, names: ['Leads per source, week by week', 'Partner share per month'] },
    'lead_sources,listings,weekly_lead_volume': { pane: 'listings', exact: 0, more: 1, names: ['Leads per listing and source'] },
    'weekly_lead_volume': { pane: 'wlv', exact: 4, more: 6, names: ['Weekly lead volume, last 12 weeks', 'Leads per channel', 'and 2 more'] },
  })[set.slice().sort().join(',')] || { pane: 'other', exact: 0, more: 0, names: [] };
  const lensButton = () => {
    const set = scopeNow(), l = LENSES(set);
    $('lenses-btn').querySelector('span').textContent = set.length === 1 ? 'Lenses on this resource' : 'Lenses on these resources';
    $('lenses-btn').querySelector('.count').textContent = l.exact + l.more;
    document.querySelectorAll('[data-lens-set]').forEach(pane => { pane.hidden = pane.dataset.lensSet !== l.pane; });
  };

  // Prototype: the SQL as written, or with a table outside the Resources of the query
  document.querySelectorAll('[data-group="sqlstate"] [data-target]').forEach(b => b.addEventListener('click', () => {
    const outside = b.dataset.target === 'outside';
    document.querySelectorAll('.ln[data-variant]').forEach(l => l.classList.toggle('off', (l.dataset.variant === 'outside') !== outside));
    syncRun();
  }));

  // A new query, with one more Resource or one less
  const sheet = $('newq-sheet');
  let mode = 'add', removing = null;
  const newSet = () => {
    const cur = scopeNow();
    if (mode === 'remove') return cur.filter(r => r !== removing);
    const pick = sheet.querySelector('input[name="newq-pick"]:checked').value;
    return cur.includes(pick) ? cur : [...cur, pick];
  };
  // Its name is suggested from its Resources and the date, as for every new query (DEC-UX-21, DEC-UX-23)
  const nameFor = set => { const n = set.map((r, i) => i ? NAMES[r].toLowerCase() : NAMES[r]); return (n.length > 1 ? n.slice(0, -1).join(', ') + ' and ' + n.at(-1) : n[0]) + ', 27 Oct'; };
  const update = () => {
    const set = newSet(), cur = scopeNow(), n = set.length, these = n === 1 ? 'this resource' : `these ${n} resources`;
    $('newq-set').innerHTML = [...new Set([...cur, ...set])].map(r => `<span class="use-chip on${set.includes(r) ? '' : ' removed'}"><i class="ph ph-table kind-icon" role="img" aria-label="Resource"></i>${cur.includes(r) ? '' : '+ '}${NAMES[r]}</span>`).join('');
    $('newq-name').value = nameFor(set);
    const l = LENSES(set), list = l.names.length ? `<ul>${l.names.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    $('newq-lenses').innerHTML = '<i class="ph ph-aperture"></i><div>' + (l.exact
      ? `<b>${l.exact} lens${l.exact > 1 ? 'es' : ''}</b> use${l.exact > 1 ? '' : 's'} exactly ${these}${l.more ? `, ${l.more} use ${n === 1 ? 'it' : 'them'} and more` : ''}.`
      : l.more ? `No lens uses exactly ${these} yet; <b>${l.more}</b> use${l.more > 1 ? '' : 's'} them and more.` : `No lens uses ${these} yet.`)
      + (mode === 'remove' ? ' A different list from that of Leads per source name.' : '') + list + '</div>';
    if (mode === 'remove') sheet.querySelector('[data-newq="remove"]').hidden = !document.querySelector(`.sql-editor .sql-key[data-table="${removing}"]`);
  };
  const openNew = (m, res) => {
    mode = m; removing = m === 'remove' ? res : null;
    $('newq-title').textContent = m === 'add' ? 'With one more resource' : `Without ${NAMES[res]}`;
    $('newq-why-what').textContent = m === 'add' ? 'Adding one' : 'Removing one';
    sheet.querySelector('[data-newq="add"]').hidden = m !== 'add';
    sheet.querySelector('[data-newq="remove"]').hidden = m !== 'remove';
    if (m === 'add' && res) sheet.querySelector(`input[name="newq-pick"][value="${res}"]`).checked = true;
    if (m === 'remove') $('newq-removed-table').textContent = res;
    update(); sheet.hidden = false;
  };
  sheet.querySelectorAll('input[name="newq-pick"]').forEach(i => i.addEventListener('change', update));
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add-res]'), remove = e.target.closest('[data-remove-res]');
    if (add) openNew('add', add.dataset.addRes || null);
    if (remove) openNew('remove', remove.dataset.removeRes);
    if (e.target.closest('#lenses-btn')) lensButton();
  });
  $('newq-start').addEventListener('click', () => {
    const set = newSet(), name = $('newq-name').value.trim() || nameFor(set), from = $('q-title').textContent;
    // The panel: the new query on top, open; the old one stays, folded
    const old = document.querySelector('.q-item.current');
    old.classList.remove('current'); old.removeAttribute('aria-current'); old.closest('.q-entry').classList.remove('open');
    const entry = document.createElement('div');
    entry.className = 'q-entry new-q';
    entry.innerHTML = `<a class="list-item card q-item current" aria-current="page" href="query.html" data-name="${esc(name.toLowerCase())}"><i class="ph ph-table kind-icon" role="img" aria-label="On resources"></i>`
      + `<span><span class="item-title">${esc(name)}</span><span class="meta">from ${esc(from)} · not run yet</span></span></a>`;
    document.querySelector('[data-pane="yours"] .panel-label').after(entry);
    // The page: its name, its question, where it came from, its Resources; no result and no history yet
    $('q-title').textContent = name;
    $('q-question').textContent = $('newq-question').value;
    $('q-origin').hidden = false; $('q-origin').querySelector('a').textContent = from;
    document.querySelectorAll('#scope-chips [data-res]').forEach(c => { c.hidden = !set.includes(c.dataset.res); });
    removedRes = mode === 'remove' ? removing : null;
    const card = document.querySelector('.result-card');
    card.classList.add('not-run');
    document.querySelector('[data-group="rtab"] [data-target="result"]').textContent = 'Result';
    $('hist-tab').textContent = 'History · no runs';
    $('not-run').hidden = !document.querySelector('[data-group="rtab"] [data-target="result"]').classList.contains('on');
    $('no-history').hidden = false;
    sheet.hidden = true;
    lensButton(); syncRun();
  });

  // The panel: a query unfolds to its last runs; a run opens in its history
  document.querySelector('.panel').addEventListener('click', e => {
    const unfold = e.target.closest('.q-unfold');
    if (unfold) { const entry = unfold.closest('.q-entry'); entry.classList.toggle('open'); unfold.setAttribute('aria-expanded', entry.classList.contains('open')); return; }
    const run = e.target.closest('.q-run'); if (!run) return;
    document.querySelector('[data-group="rtab"] [data-target="history"]').click();
    const row = document.querySelector(`.hist-run[data-run="${run.dataset.run}"]`);
    if (row) {
      row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1200);
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else document.querySelector('.result-card').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  lensButton(); syncRun();
}

// The Lineage (DEC-UX-95): one smooth curve per edge, from the right side of a model to the left side of the next, with an
// arrowhead, drawn on a layer over the lineage from where the cards are. Data flows left to right: an upstream model to
// what it feeds, this Resource to each model built on it, a clicked model to the column it adds
const drawLineage = () => document.querySelectorAll('.lin').forEach(lin => {
  if (lin.hidden) return;
  let svg = lin.querySelector(':scope > svg.lin-edges');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('lin-edges'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<defs><marker id="lin-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor"/></marker></defs><g></g>';
    lin.prepend(svg);
  }
  const box = lin.getBoundingClientRect(), g = svg.querySelector('g');
  const at = (el, side) => { const r = el.getBoundingClientRect(); return [(side === 'right' ? r.right : r.left) - box.left, r.top + r.height / 2 - box.top]; };
  // A card scrolled out of its side draws no line
  const shown = el => { const w = el.closest('.lin-wing'); if (!w) return true; const r = el.getBoundingClientRect(), v = w.getBoundingClientRect(); return r.right > v.left + 4 && r.left < v.right - 4; };
  const curve = (from, to, on) => {
    if (!shown(from) || !shown(to)) return '';
    const [x1, y1] = at(from, 'right'), [x2, y2] = at(to, 'left'), dx = Math.max(18, (x2 - x1) / 2);
    return `<path class="edge${on ? ' on' : ''}" d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2 - 2},${y2}" marker-end="url(#lin-arrow)"/>`;
  };
  const center = lin.querySelector('.lin-center .lin-node');
  const fans = side => [...lin.querySelectorAll(`.lin-wing.${side} .lin-fan`)];
  let paths = '';
  // Right: this Resource feeds the first column; a clicked model feeds the column it added
  let from = center;
  fans('right').forEach(fan => { const nodes = [...fan.children]; nodes.forEach(n => { paths += curve(from, n, n.classList.contains('sel')); }); from = fan.querySelector('.sel'); if (!from) return; });
  // Left, from the outside in: each column feeds the model clicked in the next, the last one this Resource
  const left = fans('left');
  left.forEach((fan, i) => { const to = i === left.length - 1 ? center : left[i + 1].querySelector('.sel'); if (!to) return;
    [...fan.children].forEach(n => { paths += curve(n, to, n.classList.contains('sel')); }); });
  g.innerHTML = paths;
});
if (document.querySelector('.lin')) {
  const redraw = () => requestAnimationFrame(drawLineage);
  // The left side shows the columns nearest the middle; columns further out scroll away to the left
  const toMiddle = () => document.querySelectorAll('.lin:not([hidden]) .lin-wing.left').forEach(w => { w.scrollLeft = w.scrollWidth; });
  const refresh = () => requestAnimationFrame(() => { toMiddle(); drawLineage(); });
  refresh(); addEventListener('resize', refresh); addEventListener('load', refresh);
  document.addEventListener('click', refresh);
  document.querySelectorAll('.lin-wing').forEach(w => w.addEventListener('scroll', redraw));
}

// The filter of a panel folds open its small form; folded, the line under the search says what differs.
// ?filter=open shows it open (DEC-UX-150).
document.querySelectorAll('.q-filter-toggle').forEach((toggle) => {
  const form = document.getElementById(toggle.getAttribute('aria-controls'));
  const line = form?.nextElementSibling?.classList.contains('q-filter-on') ? form.nextElementSibling : null;
  const fold = (open) => {
    form.hidden = !open;
    if (line) line.hidden = open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  if (new URLSearchParams(location.search).get('filter') === 'open') fold(true);
  toggle.addEventListener('click', () => fold(form.hidden));
});
