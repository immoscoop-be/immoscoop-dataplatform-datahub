// The picture of a monitor (DEC-UX-195), shared by the seven steps (monitor-build.html) and the page of a Monitor
// (monitor.html). Prototype only: conceptual, not the data. A strip of tiles in days or in weeks ends with today; a label
// row under it groups the days by calendar week and the weeks by month. On the strip: a dot is one value of one tile, a
// bar one value over a stretch of tiles, dots on a line a value per tile. Three shades of olive stand for several values,
// never for one each. What it is compared with is hollow; what is left out by a filter, and what is still coming in, is
// dotted. Under the strip, a row per measure with its boundaries as a gauge, each boundary in its tone, with its
// reactions. Every part a User may change carries data-edit and a hover (data-tip): the page decides what a click opens.
window.MonitorPicture = (() => {
  const TODAY = new Date(2026, 10, 9);   // Monday 9 November 2026, the "today" of the prototypes
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const isoWeek = d => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
  };
  const TONE = { opportunity: ['ph-sparkle', 'opportunity'], informative: ['ph-info', 'informative'], attention: ['ph-warning-circle', 'attention'], problem: ['ph-warning-octagon', 'problem'] };
  const REACT = {
    owner: { icon: 'ph-chat-circle-text', label: 'Message me', says: () => 'message me' },
    list: { icon: 'ph-list-bullets', label: 'In my list', says: b => `put it in my ${b.list || 'daily'} list` },
    consumers: { icon: 'ph-megaphone', label: 'Tell the Consumers', says: () => 'tell the Consumers' },
    block: { icon: 'ph-lock', label: 'Block it', says: () => 'block it' }
  };
  // the icons of the reactions, drawn in the gauge (Phosphor's chat, list, megaphone and lock, simplified)
  const ICON = {
    owner: `<path d="M1,2 h12 a1.5,1.5 0 0 1 1.5,1.5 v6 a1.5,1.5 0 0 1 -1.5,1.5 h-7 l-3,3 v-3 h-2 a1.5,1.5 0 0 1 -1.5,-1.5 v-6 a1.5,1.5 0 0 1 1.5,-1.5 z"/>`,
    list: `<path d="M1,3 h2 M5,3 h9 M1,7.5 h2 M5,7.5 h9 M1,12 h2 M5,12 h9"/>`,
    consumers: `<path d="M1,5 h3 l8,-4 v12 l-8,-4 h-3 z M4,9 l1,4"/>`,
    block: `<rect x="2" y="6" width="11" height="8" rx="1.5"/><path d="M4.5,6 v-2 a3,3 0 0 1 6,0 v2"/>`
  };
  const SEG = ['var(--seg-1)', 'var(--seg-2)', 'var(--seg-3)'];
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const strip = t => String(t).replace(/<\/b>/g, '. ').replace(/<[^>]+>/g, '');
  const and = list => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list.at(-1) : list[0] || '';

  // ---- words ---------------------------------------------------------------------------------------------------
  const weekly = s => s.check === 'week';
  const unit = s => weekly(s) ? ['week', 'weeks'] : ['day', 'days'];
  const T = {
    unit,
    check: s => s.check === 'week' ? `every ${s.day || 'Monday'} at ${s.at}` : s.check === 'weekdays' ? `every weekday at ${s.at}` : `every day at ${s.at}`,
    window: s => s.window === 1 ? (weekly(s) ? 'last week' : 'yesterday')
      : `the last ${s.window} ${unit(s)[1]}` + (s.as === 'one' ? ', as one' : s.as === 'week' && !weekly(s) ? ', week by week' : `, ${unit(s)[0]} by ${unit(s)[0]}`),
    per: s => {
      if (!s.per) return 'all together';
      const kept = s.per.values.filter(v => s.picked[v]), out = s.per.values.filter(v => !s.picked[v]);
      if (s.only === 'only') return `per ${s.per.one}, only ${and(kept) || '…'}`;
      if (s.only === 'except') return `per ${s.per.one}, all except ${and(out) || '…'}`;
      return `per ${s.per.one}`;
    },
    len: (s, n) => weekly(s) ? (n === 1 ? 'week' : `${n} weeks`) : n % 7 === 0 ? (n === 7 ? 'week' : `${n / 7} weeks`) : n === 1 ? 'day' : `${n} days`,
    cmp: (s, c) => ({ fixed: 'a fixed number', prev1: `the ${T.len(s, s.window)} before`, prev4: `the ${T.len(s, 4 * s.window)} before`,
      weekday: 'the same weekday, in the 4 weeks before', all: `all ${s.per ? s.per.many : 'values'} together`, ever: 'everything before' })[c],
    amount: (s, b) => b.unit === '%' ? `${b.amt}%` : `${b.amt} ${s.units}`,
    bound: (s, b) => {
      const one = s.per ? s.per.one : 'value';
      if (b.kind === 'change') return `${b.dir} ${b.amt}%` + (b.atLeast ? `, by at least ${b.atLeast}` : '');
      if (b.kind === 'level') return `${b.dir} than ${T.amount(s, b)}`;
      if (b.kind === 'unusual') return `the ${b.dir} in ${b.weeks} weeks`;
      if (b.kind === 'appears') return `a new ${one}`;
      if (b.kind === 'silent') return `a ${one} silent longer than ever`;
      return `the top ${b.n} risers`;
    },
    when: (s, me, b) => {
      const one = s.per ? s.per.one : 'value', a = /^[aeiou]/.test(one) ? 'an' : 'a';
      if (b.kind === 'change') return `it ${b.dir} ${b.amt}%` + (b.atLeast ? ` and by at least ${b.atLeast} ${s.units}` : '') + ` compared with ${T.cmp(s, me.cmp)}`;
      if (b.kind === 'level') return `it is ${b.dir} than ${T.amount(s, b)}`;
      if (b.kind === 'unusual') return `it is the ${b.dir} in ${b.weeks} weeks`;
      if (b.kind === 'appears') return `${a} ${one} appears for the first time`;
      if (b.kind === 'silent') return `${a} ${one} stays silent longer than it ever did in ${b.weeks} weeks`;
      return `${a} ${one} is among the ${b.n} that rose most compared with ${T.cmp(s, me.cmp)}`;
    },
    react: b => (b.react.length ? and(b.react.map(k => REACT[k].says(b))) : 'only keep it in the Log') + ` (${TONE[b.tone][1]})`
  };

  // ---- the strip -------------------------------------------------------------------------------------------------
  const STRIP = 900, TOP = 20, TH = 60, W = STRIP + 52;
  function layout(s) {
    const wk = weekly(s), gap = wk ? 4 : 3, extra = 8;
    let N, date, grp = [], label, off, glabel;
    if (!wk) {
      const weeks = Math.min(8, Math.max(5, Math.ceil((2 * s.window + 1) / 7)));
      N = weeks * 7 + 1;
      const start = addDays(TODAY, -weeks * 7);
      date = j => addDays(start, j);
      for (let j = 0; j < N; j++) grp.push(Math.floor(j / 7));
      label = j => 'MTWTFSS'[j % 7]; off = j => j % 7 >= 5;
      glabel = g => 'w' + isoWeek(date(g * 7));
    } else {
      N = 17;
      const start = addDays(TODAY, -16 * 7);
      date = j => addDays(start, 7 * j);
      const month = j => addDays(date(j), 3).getMonth();     // a week belongs to the month of its Thursday
      for (let j = 0, g = 0; j < N; j++) { if (j && month(j) !== month(j - 1)) g++; grp.push(g); }
      label = j => 'w' + isoWeek(date(j)); off = () => false;
      glabel = g => MONTHS[month(grp.indexOf(g))];
    }
    const G = grp[N - 1] + 1, tw = (STRIP - (N - 1) * gap - (G - 1) * extra) / N;
    const tx = j => j * (tw + gap) + grp[j] * extra, cx = j => tx(j) + tw / 2;
    const now = N - 1, jd = wk ? (s.stable > 1 ? N - 3 : N - 2) : N - 1 - (s.stable || 1);
    return { wk, N, G, grp, tw, tx, cx, now, jd, label, off, glabel, date };
  }
  const hot = (edit, tip, inner, hit) => `<g class="mp-hot" data-edit="${edit}" data-tip="${esc(tip)}" tabindex="0" role="button" aria-label="${esc(strip(tip))}">${hit}${inner}</g>`;
  const hitRect = (x, y, w, h, r = 9) => `<rect class="mp-hit" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, w).toFixed(1)}" height="${h.toFixed(1)}" rx="${r}"/>`;
  const layer = (o, l, html) => !html || l > o.reached ? '' : l > o.at ? `<g class="mp-later">${html}</g>` : html;
  // three shades stand for several values; with a filter, some of them are left out and drawn dotted
  function slots(s, o) {
    if (o.reached < 4 || !s.per) return [{ c: SEG[2], on: true }];
    const kept = s.per.values.filter(v => s.picked[v]).length;
    const solid = s.only === 'all' ? 3 : s.only === 'only' ? (kept <= 1 ? 1 : 2) : 2;
    return SEG.map((c, i) => ({ c, on: i >= 3 - solid }));
  }
  function picture(s, o = {}) {
    o = Object.assign({ reached: 7, at: 7, sel: s.sel || 0 }, o);
    if (o.reached < 2) return `<div class="mp-empty">The picture of your monitor builds up here, one layer per step.</div>`;
    const L = layout(s), { N, tw, tx, cx, now, jd } = L, Wn = s.window, a = jd - Wn + 1, sl = slots(s, o), me = s.metrics[o.sel];
    const ys = sl.map((_, i) => TOP + TH / 2 + (i - (sl.length - 1) / 2) * 15);
    const dotted = 'stroke-width="2.2" stroke-dasharray="0.1 4" stroke-linecap="round"';
    let g = '';
    // 2 · the strip: tiles, the weekend greyer, today and what is still coming in dotted and empty
    let tiles = '';
    for (let j = 0; j < N; j++) tiles += j > jd
      ? `<rect class="mp-coming" x="${(tx(j) + .75).toFixed(1)}" y="${TOP + .75}" width="${(tw - 1.5).toFixed(1)}" height="${TH - 1.5}" rx="5.5"/>`
      : `<rect class="mp-tile${L.off(j) ? ' off' : ''}" x="${tx(j).toFixed(1)}" y="${TOP}" width="${tw.toFixed(1)}" height="${TH}" rx="6"/>`;
    tiles += `<text class="mp-t" x="${cx(now).toFixed(1)}" y="${TOP - 7}" text-anchor="middle">${L.wk ? 'this week' : 'today'}</text>`;
    g += layer(o, 2, tiles + hot('stability', `<b>Still coming in: ${L.wk ? 'this week' : 'today'}</b><span>${esc(s.name)} is complete up to ${s.stable > 1 ? `${s.stable} days ago` : 'yesterday'}; what comes after is not judged yet. The Data Team sets this.</span>`, '', hitRect(tx(jd + 1) - 3, TOP - 3, tx(N - 1) + tw - tx(jd + 1) + 6, TH + 6)));
    // the labels: M T W T F S S grouped by calendar week, or the weeks grouped by month
    let lt = '';
    for (let j = 0; j < N; j++) if (tw >= 9) lt += `<text class="mp-t${L.off(j) ? ' off' : ''}" x="${cx(j).toFixed(1)}" y="${TOP + TH + 14}" text-anchor="middle">${L.label(j)}</text>`;
    for (let k = 0; k < L.G; k++) {
      const js = L.grp.map((x, j) => x === k ? j : -1).filter(j => j >= 0), p = js[0], q = js.at(-1);
      lt += `<path class="mp-bracket" d="M${(tx(p) + 1).toFixed(1)},${TOP + TH + 20} v3 H${(tx(q) + tw - 1).toFixed(1)} v-3"/>` +
        `<text class="mp-t grp" x="${((tx(p) + tx(q) + tw) / 2).toFixed(1)}" y="${TOP + TH + 34}" text-anchor="middle">${q - p < 1 && !L.wk ? '' : L.glabel(k)}</text>`;
    }
    g += layer(o, 2, hot('check', `<b>It checks ${T.check(s)}</b><span>The strip counts in ${unit(s)[1]}${L.wk ? ', Monday to Sunday, by month' : ', by calendar week'} · click to change</span>`, lt, hitRect(-4, TOP + TH + 3, STRIP + 8, 37, 8)));
    // 6 · what it is compared with, hollow, for the measure selected
    if (me && o.reached >= 6) {
      let cmp = '', r = null;
      const hb = (p, q, y, c, k) => p < 0
        ? `<path d="M${tx(0).toFixed(1)},${y - 4.5} H${cx(q).toFixed(1)} a4.5,4.5 0 0 1 0,9 H${tx(0).toFixed(1)}" fill="url(#mp-fade)" stroke="url(#mp-fade-${k})" stroke-width="2"/>`
        : `<rect x="${(cx(p) - 4.5).toFixed(1)}" y="${y - 4.5}" width="${(cx(q) - cx(p) + 9).toFixed(1)}" height="9" rx="4.5" class="mp-hollow" style="stroke:${sl[k].c}"/>`;
      const hd = (j, y, c) => `<circle cx="${cx(j).toFixed(1)}" cy="${y}" r="4.5" class="mp-hollow" style="stroke:${c}"/>`;
      const hl = (p, q, y, c) => `<line x1="${cx(Math.max(0, p)).toFixed(1)}" y1="${y}" x2="${cx(q).toFixed(1)}" y2="${y}" style="stroke:${c}" stroke-width="1.5"/>` + Array.from({ length: q - Math.max(0, p) + 1 }, (_, k) => hd(Math.max(0, p) + k, y, c)).join('');
      const same = (p, q, y, c, k) => Wn === 1 ? hd(q, y, c) : s.as === 'one' ? hb(p, q, y, c, k)
        : s.as === 'week' && !L.wk ? Array.from({ length: Wn / 7 }, (_, n) => hb(p + 7 * n, p + 7 * n + 6, y, c, k)).join('') : hl(p, q, y, c);
      sl.forEach((sv, k) => {
        if (!sv.on) return;
        const y = ys[k];
        if (me.cmp === 'prev1') { r = [a - Wn, a - 1]; cmp += same(a - Wn, a - 1, y, sv.c, k); }
        if (me.cmp === 'prev4') { r = [a - 4 * Wn, a - 1]; cmp += hb(a - 4 * Wn, a - 1, y, sv.c, k); }
        if (me.cmp === 'weekday') { const js = [1, 2, 3, 4].map(n => jd - 7 * n).filter(j => j >= 0); r = [js.at(-1), js[0]]; cmp += js.map(j => hd(j, y, sv.c)).join(''); }
        if (me.cmp === 'ever') { r = [0, a - 1]; cmp += hb(-1, a - 1, y, sv.c, k); }
      });
      if (me.cmp === 'all') { r = [jd, jd]; cmp = `<rect class="mp-hollow all" x="${(cx(jd) - 9).toFixed(1)}" y="${ys[0] - 10}" width="18" height="${ys.at(-1) - ys[0] + 20}" rx="9"/>`; }
      if (me.cmp === 'fixed') { r = [0, jd]; cmp = `<line class="mp-fixed" x1="${tx(0)}" y1="${TOP + 10}" x2="${(tx(jd) + tw).toFixed(1)}" y2="${TOP + 10}"/>`; }
      const [p, q] = r ? [Math.max(0, r[0]), r[1]] : [0, 0];
      g += layer(o, 6, hot(`cmp:${o.sel}`, `<b>Compared with ${T.cmp(s, me.cmp)}</b><span>for ${esc(me.says)} · click to change</span>`, cmp, hitRect(tx(p) - 5, TOP - 4, tx(q) + tw - tx(p) + 10, TH + 8)));
    }
    // 3, 4 · the window looked at, solid, in the shades of the values; left out by a filter, dotted
    if (o.reached >= 3) {
      let mk = '';
      sl.forEach((sv, k) => {
        const y = ys[k], c = sv.c;
        if (!sv.on) { mk += Wn === 1 ? `<circle cx="${cx(jd).toFixed(1)}" cy="${y}" r="5" fill="none" style="stroke:${c}" ${dotted}/>` : `<line x1="${cx(a).toFixed(1)}" y1="${y}" x2="${cx(jd).toFixed(1)}" y2="${y}" style="stroke:${c}" ${dotted}/>`; return; }
        if (Wn === 1) mk += `<circle cx="${cx(jd).toFixed(1)}" cy="${y}" r="5.5" style="fill:${c}"/>`;
        else if (s.as === 'one') mk += `<line x1="${cx(a).toFixed(1)}" y1="${y}" x2="${cx(jd).toFixed(1)}" y2="${y}" style="stroke:${c}" stroke-width="9" stroke-linecap="round"/>`;
        else if (s.as === 'week' && !L.wk) for (let n = 0; n < Wn / 7; n++) mk += `<line x1="${cx(a + 7 * n).toFixed(1)}" y1="${y}" x2="${cx(a + 7 * n + 6).toFixed(1)}" y2="${y}" style="stroke:${c}" stroke-width="9" stroke-linecap="round"/>`;
        else mk += `<line x1="${cx(a).toFixed(1)}" y1="${y}" x2="${cx(jd).toFixed(1)}" y2="${y}" style="stroke:${c}" stroke-width="2.5"/>` + Array.from({ length: Wn }, (_, n) => `<circle cx="${cx(a + n).toFixed(1)}" cy="${y}" r="${tw < 12 ? 4 : 5}" style="fill:${c}"/>`).join('');
      });
      g += layer(o, 3, hot('period', `<b>It looks at ${T.window(s)}</b><span>the last complete ${unit(s)[0]} and back · click to change</span>`, mk, hitRect(tx(a) - 5, TOP - 5, tx(jd) + tw - tx(a) + 10, TH + 10, 11)));
    }
    // 4 · the values: all together, or per value, and which
    if (o.reached >= 4) {
      const lx = STRIP + 26;
      const vs = sl.map((sv, k) => sv.on ? `<circle cx="${lx}" cy="${ys[k]}" r="5.5" style="fill:${sv.c}"/>` : `<circle cx="${lx}" cy="${ys[k]}" r="5" fill="none" style="stroke:${sv.c}" ${dotted}/>`).join('');
      g += layer(o, 4, hot('per', `<b>${cap(T.per(s))}</b><span>${s.per ? `three shades stand for the ${s.per.n} ${s.per.many} · ` : ''}click to change</span>`, vs, hitRect(lx - 14, TOP, 28, TH, 10)));
    }
    return `<svg class="mp" viewBox="-6 0 ${W + 6} ${TOP + TH + 40}" role="img" aria-label="${esc(cap(T.check(s)) + ', ' + T.window(s) + ', ' + T.per(s))}">${g}</svg>`;
  }

  // ---- a measure and its boundaries, as a gauge ----------------------------------------------------------------------
  function gauge(s, i, o) {
    const me = s.metrics[i], fixed = me.cmp === 'fixed', gx = 6, toned = o.reached >= 7;
    const side = b => b.kind === 'level' ? (b.dir === 'higher' ? ['up'] : ['down']) : b.kind === 'change' ? (b.dir === 'rises' ? ['up'] : b.dir === 'drops' ? ['down'] : ['up', 'down'])
      : b.kind === 'unusual' ? [b.dir === 'highest' ? 'up' : 'down'] : b.kind === 'silent' ? ['down'] : ['up'];
    const rank = b => b.kind === 'level' || b.kind === 'change' ? b.amt : b.kind === 'unusual' ? b.weeks : b.kind === 'top' ? 100 - b.n : 0;
    let entries = [];
    me.bounds.forEach((b, j) => side(b).forEach((d, n) => entries.push({ b, j, up: d === 'up', first: n === 0,
      txt: side(b).length > 1 ? `${d === 'up' ? 'rises' : 'drops'} ${b.amt}%` : T.bound(s, b) })));
    let h, cy;
    if (fixed) {
      entries.sort((p, q) => rank(q.b) - rank(p.b)).forEach((e, k) => { e.y = 12 + k * 18; });
      h = Math.max(80, 12 + entries.length * 18); cy = null;
    } else {
      const ups = entries.filter(e => e.up).sort((p, q) => rank(p.b) - rank(q.b)), downs = entries.filter(e => !e.up).sort((p, q) => rank(p.b) - rank(q.b));
      cy = Math.max(40, 18 + Math.max(0, ups.length - 1) * 16);
      ups.forEach((e, k) => { e.y = cy - 10 - k * 16; }); downs.forEach((e, k) => { e.y = cy + 10 + k * 16; });
      h = Math.max(80, cy + 18 + Math.max(0, downs.length - 1) * 16);
    }
    const zone = e => e.up ? e.y : h - e.y;
    let hatch = '', lines = '';
    [...entries].sort((p, q) => zone(q) - zone(p)).forEach(e => {
      hatch += `<rect x="${gx}" y="${e.up ? 0 : e.y}" width="20" height="${zone(e)}" fill="url(#mp-hatch-${toned ? e.b.tone : 'none'})"/>`;
    });
    const tri = (x, y, up, tone) => `<path class="mp-tri" style="fill:${toned ? `var(--tone-${tone})` : 'var(--text-muted)'}" d="M${x - 4.5},${y + (up ? 3 : -3)} L${x + 4.5},${y + (up ? 3 : -3)} L${x},${y + (up ? -4 : 4)} Z"/>`;
    entries.forEach(({ b, j, up, first, txt, y }) => {
      const line = `<line class="mp-gline${fixed ? ' fixed' : ''}" x1="${gx - 3}" y1="${y}" x2="${gx + 23}" y2="${y}"/>` + tri(gx + 36, y, up, b.tone) + `<text class="mp-gt" x="${gx + 46}" y="${y + 4}">${esc(txt)}</text>`;
      const fired = b.fired != null ? ` · it fired ${b.fired === 0 ? 'never' : b.fired === 1 ? 'once' : b.fired + ' times'} in 30 days${b.useful ? `, ${b.useful} useful` : ''}` : '';
      lines += layer(o, 6, hot(`bound:${i}:${j}`, `<b>When ${esc(T.when(s, me, b))}</b><span>a boundary${fired} · click to change</span>`, line, hitRect(gx - 6, y - 9, 200, 18, 8)));
      if (!first || o.reached < 7) return;
      const rx = 224, icons = b.react.map((k, n) => `<g transform="translate(${rx + n * 24},${y - 8})" class="mp-icon">${ICON[k]}</g>`).join('') || `<text class="mp-t" x="${rx}" y="${y + 4}">+ reaction</text>`;
      const w = Math.max(70, b.react.length * 24 + 4);
      lines += layer(o, 7, hot(`react:${i}:${j}`, `<b>Then: ${esc(T.react(b))}</b><span>click to change the reactions and the tone</span>`, icons, hitRect(rx - 6, y - 10, w, 20, 8)) +
        (b.fired != null ? `<text class="mp-t" x="${rx + w + 6}" y="${y + 4}">${b.fired === 0 ? 'never fired' : b.fired === 1 ? 'fired once' : `fired ${b.fired}×`}</text>` : ''));
    });
    const body = `<rect class="mp-gauge" x="${gx}" y="0" width="20" height="${h}" rx="7"/>${hatch}<rect class="mp-gauge-edge" x="${gx}" y="0" width="20" height="${h}" rx="7"/>` +
      (cy != null ? `<circle cx="${gx + 10}" cy="${cy}" r="4.5" class="mp-hollow" style="stroke:var(--seg-3)"/>` : '') + lines +
      (o.edit ? hot(`addb:${i}`, '<b>Add a boundary</b><span>such as a second line further out, with other reactions</span>', `<text class="mp-t" x="${gx + 46}" y="${h + 12}">+ boundary</text>`, hitRect(gx + 40, h, 76, 16, 7)) : '');
    return `<svg class="mp-g" viewBox="0 0 400 ${h + (o.edit ? 18 : 2)}" style="max-width:400px" aria-label="${esc('Boundaries of ' + me.says + ': ' + me.bounds.map(b => T.bound(s, b)).join(', '))}">${body}</svg>`;
  }
  function measures(s, o = {}) {
    o = Object.assign({ reached: 7, at: 7, sel: s.sel || 0 }, o);
    if (o.reached < 5) return '';
    return s.metrics.map((me, i) => `<div class="mp-metric${i === o.sel && s.metrics.length > 1 ? ' on' : ''}${5 > o.at ? ' mp-later' : ''}" data-sel="${i}">
      <div class="mp-m-head"><span class="mp-sign">${esc(me.sym)}</span><div style="min-width:0">
       <div class="mp-m-name"><span class="mp-part" tabindex="0" role="button" data-edit="measure:${i}" data-tip="<b>What it measures</b><span>click to change the field or how it is measured</span>">${esc(me.says)}</span></div>
       ${o.reached >= 6 ? `<div class="mp-m-cmp${6 > o.at ? ' mp-later' : ''}">compared with <span class="mp-part" tabindex="0" role="button" data-edit="cmp:${i}" data-tip="<b>What it is compared with</b><span>shows hollow on the strip · click to change</span>">${T.cmp(s, me.cmp)}</span></div>` : ''}</div></div>
      <div>${o.reached >= 6 ? gauge(s, i, o) : '<p class="meta mp-wait">Its boundaries come in step 6.</p>'}</div></div>`).join('');
  }
  // the sentence that reads the monitor back, for the measure selected; each part opens what it says
  function sentence(s, o = {}) {
    o = Object.assign({ reached: 7, at: 7, sel: s.sel || 0 }, o);
    const part = (l, html, edit) => l > o.reached ? '' : `<span class="mp-part${l > o.at ? ' mp-later' : ''}" tabindex="0" role="button" data-edit="${edit}">${html}</span>`;
    const me = s.metrics[o.sel];
    let t = (o.reached >= 2 ? part(2, cap(T.check(s)), 'check') + ', look at ' : 'Look at ') + (o.reached >= 5 && me ? part(5, esc(me.says), `measure:${o.sel}`) + ' in ' : '') + part(1, esc(s.name), 'resource');
    if (o.reached >= 4) t += ', ' + part(4, T.per(s), 'per');
    if (o.reached >= 3) t += ', over ' + part(3, T.window(s), 'period');
    t += '.';
    if (o.reached >= 6 && me) me.bounds.forEach((b, j) => { t += ' When ' + part(6, esc(T.when(s, me, b)), `bound:${o.sel}:${j}`) + (o.reached >= 7 ? ': ' + part(7, T.react(b), `react:${o.sel}:${j}`) : '') + '.'; });
    if (o.reached >= 6 && s.per && s.guard) t += ' ' + part(6, `${/^[aeiou]/.test(s.per.one) ? 'An' : 'A'} ${s.per.one} with fewer than ${s.guard} ${s.units} in the period is not judged.`, 'guard');
    return t;
  }

  // ---- shared once per page: the patterns and gradients, the hover, and the keyboard ---------------------------------
  function install() {
    if (document.getElementById('mp-defs')) return;
    const tones = ['opportunity', 'informative', 'attention', 'problem', 'none'];
    document.body.insertAdjacentHTML('beforeend', `<svg id="mp-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>` +
      tones.map(t => `<pattern id="mp-hatch-${t}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="mp-gauge"/><rect width="2.5" height="6" style="fill:${t === 'none' ? 'var(--text-muted)' : `var(--tone-${t})`}" fill-opacity=".45"/></pattern>`).join('') +
      `<linearGradient id="mp-fade" x1="0" x2="1"><stop offset="0" style="stop-color:var(--surface-solid);stop-opacity:0"/><stop offset=".3" style="stop-color:var(--surface-solid)"/></linearGradient>` +
      SEG.map((c, k) => `<linearGradient id="mp-fade-${k}" x1="0" x2="1"><stop offset="0" style="stop-color:${c};stop-opacity:0"/><stop offset=".3" style="stop-color:${c}"/></linearGradient>`).join('') +
      `</defs></svg><div class="mp-tip" id="mp-tip" role="tooltip"></div>`);
    const tip = document.getElementById('mp-tip');
    const hide = () => tip.classList.remove('on');
    const place = (x, y) => { tip.style.left = Math.max(8, Math.min(x + 14, innerWidth - tip.offsetWidth - 10)) + 'px'; tip.style.top = (y + 18 + tip.offsetHeight > innerHeight ? y - tip.offsetHeight - 12 : y + 18) + 'px'; };
    document.addEventListener('mousemove', e => {
      const t = e.target.closest?.('[data-tip]');
      if (!t || e.target.closest('.float-win')) return hide();
      if (tip.dataset.for !== t.dataset.tip) { tip.innerHTML = t.dataset.tip; tip.dataset.for = t.dataset.tip; }
      place(e.clientX, e.clientY); tip.classList.add('on');
    });
    document.addEventListener('focusin', e => {
      const t = e.target.closest?.('[data-tip]'); if (!t) return hide();
      const r = t.getBoundingClientRect(); tip.innerHTML = t.dataset.tip; tip.dataset.for = t.dataset.tip; place(r.left, r.bottom - 10); tip.classList.add('on');
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('click', hide);
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-edit][role="button"]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    });
  }
  return { picture, measures, gauge, sentence, install, T, TONE, REACT, layout };
})();
