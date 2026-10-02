/* ============================================================================
   Backed Claims: AI resources and AI talk in US 10-Ks (Paper A companion).

   Every number on the site is read from data/*.json, which build_data.py bakes
   from the analysis outputs. Nothing is typed in here except words.
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const V = '?v=12';                                        // bump on each release: GitHub Pages caches hard
  const J = (p) => fetch('data/' + p + V).then((r) => r.json());
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function countTo(el, to, suffix) {                       // a stat tile counts up to its value once
    if (REDUCED) { el.textContent = fmtInt(to) + (suffix || ''); return; }
    let t0 = null, done = false;
    const step = (ts) => {
      if (done) return;
      if (t0 === null) t0 = ts;
      const t = Math.min(1, (ts - t0) / 1000), k = 1 - Math.pow(1 - t, 3);
      el.textContent = fmtInt(to * k) + (suffix || '');
      if (t < 1) requestAnimationFrame(step); else done = true;
    };
    requestAnimationFrame(step);
    setTimeout(() => { if (!done) { done = true; el.textContent = fmtInt(to) + (suffix || ''); } }, 1300);
  }
  const fmtInt = (n) => Number(n).toLocaleString('en-US');
  const pfmt = (p) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''));
  const pct = (v, d) => (v * 100).toFixed(d === undefined ? 0 : d) + '%';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const C = window.Charts;

  const SLUG = {
    'Software & IT services': 'software_it_services', 'Computers & chips': 'computers_chips',
    'Aerospace & defense': 'aerospace_defense', 'Auto manufacturing': 'auto_manufacturing',
    'Pharma & biotech': 'pharma_biotech', 'Retail': 'retail', 'Utilities': 'utilities',
    'Construction': 'construction', 'Construction machinery': 'construction_machinery',
  };
  const SECTOR_VAR = {
    'Software & IT services': '--i1', 'Computers & chips': '--i2', 'Aerospace & defense': '--i3',
    'Auto manufacturing': '--i4', 'Pharma & biotech': '--i5', 'Retail': '--i6',
    'Utilities': '--i7', 'Construction': '--i8', 'Construction machinery': '--i9',
  };
  const RES_NAME = {
    L1_RD_SALES0: 'R&D / revenue (R₁)', L1_LOG_AI_PAT_STOCK: 'AI patent portfolio (R₂)',
    L1_AI_WORKER: 'AI-worker share (R₃)',
  };

  // --------------------------------------------------------------- data pool
  const DATA = {};
  const loaded = {};
  function need(names, fn) {
    Promise.all(names.map((n) => DATA[n] || (DATA[n] = J(n + '.json')))).then((vs) => {
      const o = {};
      names.forEach((n, i) => (o[n] = vs[i]));
      fn(o);
    });
  }

  // --------------------------------------------------------------------- nav
  $$('#nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  function show(v) {
    $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    $$('.view').forEach((s) => (s.hidden = s.id !== 'view-' + v));
    if (v !== 'overview' && window.Hero) Hero.pause();
    if (!loaded[v]) { loaded[v] = true; INIT[v](); }
    window.scrollTo({ top: 0 });
  }

  // ============================================================== OVERVIEW
  function initOverview() {
    need(['headline', 'models', 'diffusion', 'hero'], ({ headline: H, models: M, diffusion: D, hero: HR }) => {
      if (window.Hero) Hero.init(HR);
      countTo($('#ov-n10k'), H.n10k);
      $('#ov-span').textContent = 'FY' + H.fy0 + '-' + H.fy1;
      countTo($('#ov-firms'), H.firms);
      countTo($('#ov-nai'), H.nai);
      countTo($('#ov-nc'), H.nC);
      verdicts(M);
      outcomeGrid(M);
      const seg = $('#ov-seg');
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        diffusion(D, b.dataset.k);
      });
      diffusion(D, 'C');
    });
  }

  function est(M, model, term, fe, y) {
    const r = M.models.find((m) => m.model === model && m.term === term && m.fe === fe && m.y === (y || 'ln_C'));
    return r || null;
  }
  const pp = (r) => (r.coef > 0 ? '+' : '−') + ' (p ' + pfmt(r.p) + ')';

  // resources x {C, G, F}, both designs, as plain marks (owner 2026-10-01): the comparison outcomes beside the claims
  function outcomeGrid(M) {
    const RES = [['L1_RD_SALES0', 'R&amp;D / revenue (R₁)'], ['L1_LOG_AI_PAT_STOCK', 'AI patent portfolio (R₂)'],
                 ['L1_AI_WORKER', 'AI-worker share (R₃)']];
    const OUT = [['ln_C', 'Specific capability claims (C)', 'hypothesized'], ['ln_G', 'Generic AI risk (G)', 'comparison'],
                 ['ln_F', 'Firm-specific AI risk (F)', 'comparison']];
    const mark = (r, fe) => {
      if (!r) return '<b class="om nil" title="not estimated">·</b>';
      const sig = r.p < .05, cls = !sig ? 'nil' : r.coef > 0 ? 'up' : 'dn', g = !sig ? '○' : r.coef > 0 ? '▲' : '▼';
      const tip = (fe === 'WITHIN' ? 'within firm' : 'between firms') + ': ' + fnum(r.coef) + ' (SE ' + fnum(r.se) + ', p ' + pfmt(r.p) + ')';
      return '<b class="om ' + cls + '" title="' + tip + '">' + g + '</b>';
    };
    let h = '<div class="og-row og-head"><span></span>' +
      OUT.map(([, lab, kind]) => '<span>' + lab + '<small>' + kind + '</small></span>').join('') + '</div>';
    RES.forEach(([term, lab]) => {
      h += '<div class="og-row"><span class="og-res">' + lab + '</span>' + OUT.map(([y]) => {
        const m = 'H1 ' + term;
        return '<span class="og-cell">' + mark(est(M, m, term, 'WITHIN', y), 'WITHIN') + mark(est(M, m, term, 'BETWEEN', y), 'BETWEEN') + '</span>';
      }).join('') + '</div>';
    });
    const host = $('#ov-ogrid');
    host.innerHTML = h;
    if (REDUCED) return;
    host.querySelectorAll('.og-cell').forEach((c, i) => { c.style.animationDelay = (200 + i * 90) + 'ms'; c.classList.add('pop'); });
  }

  function verdicts(M) {
    const rd = ['H1 L1_RD_SALES0', 'L1_RD_SALES0'], ap = ['H1 L1_LOG_AI_PAT_STOCK', 'L1_LOG_AI_PAT_STOCK'];
    const h2a = est(M, 'H2 L1_RD_SALES0 x HIGH_AIIE', 'RxM', 'WITHIN'), h2aB = est(M, 'H2 L1_RD_SALES0 x HIGH_AIIE', 'RxM', 'BETWEEN');
    const h2b = est(M, 'H2 L1_LOG_AI_PAT_STOCK x INTERNAL_DEV', 'RxM', 'WITHIN'), h2bB = est(M, 'H2 L1_LOG_AI_PAT_STOCK x INTERNAL_DEV', 'RxM', 'BETWEEN');
    const h3r = est(M, 'H3 L1_RD_SALES0 baseline', 'RxL', 'WITHIN'), h3rB = est(M, 'H3 L1_RD_SALES0 baseline', 'RxL', 'BETWEEN');
    const h3p = est(M, 'H3 L1_LOG_AI_PAT_STOCK baseline', 'RxL', 'WITHIN'), h3pB = est(M, 'H3 L1_LOG_AI_PAT_STOCK baseline', 'RxL', 'BETWEEN');
    // each finding as a small animated scene (owner 2026-10-01): the statement in words on the card, the
    // estimates behind a toggle; every number still comes from models.json
    const FO = 'style="transform-box:fill-box;transform-origin:center"';
    const flake = (cx, cy, r) => {                                         // a six-fold snowflake: arms with outward branches
      let s = '';
      for (let a = 0; a < 6; a++) {
        const d = a * Math.PI / 3, ux = Math.cos(d), uy = Math.sin(d);
        s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r * ux).toFixed(1) + '" y2="' + (cy + r * uy).toFixed(1) + '"/>';
        const bx = cx + .55 * r * ux, by = cy + .55 * r * uy;
        for (const w of [-1, 1]) {
          const b = d + w * Math.PI / 3;
          s += '<line x1="' + bx.toFixed(1) + '" y1="' + by.toFixed(1) + '" x2="' + (bx + .4 * r * Math.cos(b)).toFixed(1) +
               '" y2="' + (by + .4 * r * Math.sin(b)).toFixed(1) + '"/>';
        }
      }
      return '<g stroke="#2166ac" stroke-width="1.2" stroke-linecap="round" fill="none">' + s +
             '<circle cx="' + cx + '" cy="' + cy + '" r="1.4" fill="#2166ac" stroke="none"/></g>';
    };
    const block = (x, y, lab) => '<g><rect x="' + x + '" y="' + y + '" width="46" height="17" rx="3" fill="#D4EBF2" stroke="#555" stroke-width=".8"/>' +
      '<text x="' + (x + 23) + '" y="' + (y + 12) + '" text-anchor="middle" font-size="8.5">' + lab + '</text></g>';
    // a speech bubble drawn as ONE outline (rounded body plus tail), so no stroke cuts across the tail's base
    const bubble = (x, y, lab, cls) => {
      const w = 68, h = 26, r = 8, tx = x + 12;
      const d = 'M' + (x + r) + ',' + y + ' H' + (x + w - r) + ' Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
        ' V' + (y + h - r) + ' Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) +
        ' H' + (tx + 9) + ' L' + (tx - 5) + ',' + (y + h + 8) + ' L' + tx + ',' + (y + h) +
        ' H' + (x + r) + ' Q' + x + ',' + (y + h) + ' ' + x + ',' + (y + h - r) + ' V' + (y + r) + ' Q' + x + ',' + y + ' ' + (x + r) + ',' + y + ' Z';
      return '<g class="' + (cls || '') + '" ' + FO + '><path d="' + d + '" fill="#D9EAD3" stroke="#555" stroke-width=".8" stroke-linejoin="round"/>' +
        '<text x="' + (x + w / 2) + '" y="' + (y + 17) + '" text-anchor="middle" font-size="8.5">' + lab + '</text></g>';
    };
    const arrow = (cls, extra) => '<g class="' + cls + '" ' + (extra || '') + '><line x1="62" y1="36" x2="136" y2="36" stroke="#3a3a3a" stroke-width="2"/>' +
      '<path d="M136,31 l9,5 l-9,5 z" fill="#3a3a3a"/></g>';
    const scenes = {
      h1: '<svg class="vscene" viewBox="0 0 220 76">' + block(8, 10, 'R&amp;D') + block(8, 48, 'patents') +
          arrow('a-draw') + bubble(146, 22, 'specific claims', 'a-pop') + '</svg>',
      h2: '<svg class="vscene" viewBox="0 0 220 76">' +
          '<rect x="112" y="12" width="96" height="40" rx="5" fill="#EAD1DC" stroke="#555" stroke-width=".8"/>' +
          '<text x="189" y="35" text-anchor="middle" font-size="8">sector</text>' +
          '<rect x="120" y="22" width="50" height="21" fill="#fff" stroke="#555" stroke-width=".7"/>' +
          '<g class="a-slide" ' + FO + '>' + block(122, 24, 'resource') + '</g>' +
          '<text x="110" y="68" text-anchor="middle" font-size="8.5" fill="#555">the sector that fits the resource</text></svg>',
      h3b: '<svg class="vscene" viewBox="0 0 220 76">' + block(8, 28, 'patents') +
           arrow('a-thin', 'opacity=".35"') + bubble(146, 22, 'specific claims', 'a-shrink') +
           '<g class="a-snow" ' + FO + '>' + flake(99, 15, 11) + '</g></svg>',
      h3a: '<svg class="vscene" viewBox="0 0 220 76">' + block(8, 28, 'R&amp;D') +
           '<g opacity=".4"><line x1="62" y1="36" x2="136" y2="36" stroke="#3a3a3a" stroke-width="1.6" stroke-dasharray="5 4"/>' +
           '<path d="M136,31 l9,5 l-9,5 z" fill="#3a3a3a"/></g>' + bubble(146, 22, 'specific claims', '') +
           '<g class="a-scan" ' + FO + '><circle cx="99" cy="30" r="11" fill="none" stroke="#333" stroke-width="2"/>' +
           '<line x1="107" y1="38" x2="116" y2="47" stroke="#333" stroke-width="3" stroke-linecap="round"/></g></svg>',
    };
    const rows = [
      ['ok', 'H1 alignment', scenes.h1, 'Resources back the claims',
       'Firms with more R&D and larger AI patent portfolios make more specific AI capability claims.',
       'R&D intensity ' + pp(est(M, rd[0], rd[1], 'WITHIN')) + ' | ' + pp(est(M, rd[0], rd[1], 'BETWEEN')) +
       ' · AI patent portfolio ' + pp(est(M, ap[0], ap[1], 'WITHIN')) + ' | ' + pp(est(M, ap[0], ap[1], 'BETWEEN')) + ', within | between firms'],
      ['ok', 'H2 congruence', scenes.h2, 'Resources matter most where they fit the industry',
       'Patents align with claims in sectors that develop AI internally; R&D where industry AI exposure is high.',
       'AI patent portfolio × internal AI development ' + pp(h2b) + ' | ' + pp(h2bB) +
       ' · R&D intensity × high industry AI exposure ' + pp(h2a) + ' | ' + pp(h2aB)],
      ['ok', 'H3b chilling', scenes.h3b, 'Litigation cools the patent-backed claims',
       'Where securities lawsuits are more common in a sector, the patent-claims association weakens.',
       'AI patent portfolio × litigation exposure ' + pp(h3p) + ' | ' + pp(h3pB)],
      ['half', 'H3a screening', scenes.h3a, 'Little sign of screening',
       'Litigation strengthens the R&D association only in the pooled within-firm model.',
       'R&D intensity × litigation exposure ' + pp(h3r) + ' within firm, but ' + pp(h3rB) + ' between firms and in no single sector'],
    ];
    $('#ov-verdicts').innerHTML = rows.map(([cls, tag, scene, title, plain, stat]) =>
      '<div class="verdict ' + cls + '" role="button" tabindex="0" title="Open the Findings view">' +
      '<span class="vtag">' + tag + '</span>' + scene + '<b>' + title + '</b><small>' + plain + '</small>' +
      '<div class="vstats" hidden>' + stat + '</div></div>').join('');
    const cards = $$('#ov-verdicts .verdict');
    cards.forEach((c) => {
      c.addEventListener('click', () => show('findings'));
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') show('findings'); });
    });
    const estBtn = $('#ov-est');
    estBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const showIt = estBtn.getAttribute('aria-pressed') !== 'true';
      estBtn.setAttribute('aria-pressed', String(showIt));
      estBtn.textContent = showIt ? 'Hide the estimates' : 'Show the estimates';
      $$('#ov-verdicts .vstats').forEach((d) => (d.hidden = !showIt));
    });
    if (REDUCED) { cards.forEach((c) => c.classList.add('pop')); return; }
    cards.forEach((c, i) => { c.style.animationDelay = (250 + i * 180) + 'ms'; c.classList.add('pop'); });
    let k = -1;
    const spot = setInterval(() => {
      k = (k + 1) % (cards.length + 1);
      cards.forEach((c, i) => c.classList.toggle('live', i === k));
    }, 2400);
    const stopSpot = () => { clearInterval(spot); cards.forEach((c) => c.classList.remove('live')); };
    document.addEventListener('pointerdown', stopSpot, { once: true, capture: true });
    window.addEventListener('wheel', stopSpot, { once: true, passive: true, capture: true });
  }

  function diffusion(D, k) {
    const heavy = 'All sectors';
    const series = D.series.filter((s) => s.name !== heavy).map((s) => ({
      name: s.name, color: SECTOR_VAR[s.name], width: 1.8, dot: 3, opacity: 0.9,
      values: s[k],
    }));
    const all = D.series.find((s) => s.name === heavy);
    series.push({ name: heavy, color: '--ink', width: 3.2, dot: 3.8, values: all[k] });
    C.lineChart($('#ch-diffusion'), {
      years: D.years, series, height: 360, yFmt: (v) => pct(v),
      yLabel: { C: 'share of 10-Ks with a specific claim', G: 'share with generic AI risk', F: 'share with firm-specific AI risk', AI: 'share with any AI language' }[k],
      tipFmt: (v, yr, s) => {
        const row = D.series.find((x) => x.name === s.name);
        return pct(v, 1) + ' of ' + fmtInt(row.n[D.years.indexOf(yr)]) + ' 10-Ks';
      },
    });
    // the lines draw in from the left on load and on every outcome toggle (owner 2026-10-01)
    if (REDUCED) return;
    const svg = $('#ch-diffusion svg');
    if (!svg) return;
    svg.querySelectorAll('polyline').forEach((pl, i) => {
      const L = pl.getTotalLength();
      pl.style.transition = 'none'; pl.style.strokeDasharray = L; pl.style.strokeDashoffset = L;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        pl.style.transition = 'stroke-dashoffset 1s ease-out ' + (i * 35) + 'ms';
        pl.style.strokeDashoffset = '0';
      }));
      setTimeout(() => { pl.style.strokeDasharray = ''; pl.style.strokeDashoffset = ''; pl.style.transition = ''; }, 1500 + i * 35);
    });
    svg.querySelectorAll('circle').forEach((c) => {
      c.style.transition = 'none'; c.style.opacity = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        c.style.transition = 'opacity .45s ease 950ms'; c.style.opacity = '1';
      }));
      setTimeout(() => { c.style.opacity = ''; c.style.transition = ''; }, 1800);
    });
  }

  // ============================================================== FINDINGS
  function initFindings() {
    need(['models', 'marginal', 'slopes'], ({ models: M, marginal: MG, slopes: SL }) => {
      h1Forests(M); h2Forests(M);
      const seg = $('#h3-seg');
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        h3Lines(MG, b.dataset.fe);
      });
      h3Lines(MG, 'WITHIN');
      const sseg = $('#sl-seg');
      sseg.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        sseg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        slopeChart(M, SL, b.dataset.res, b.dataset.fe);
      });
      slopeChart(M, SL, 'log AI patent stock', 'WITHIN');
    });
  }

  function fpoint(r, name, hollow) {
    return { est: r.coef, se: r.se, hollow, name,
             color: hollow ? '--ink-2' : '--accent',
             tip: 'estimate ' + r.coef.toFixed(3).replace(/^(-?)0\./, '$1.') + ', SE ' + r.se.toFixed(3).replace(/^0\./, '.') +
                  ', p ' + pfmt(r.p) + '<br>' + fmtInt(r.n) + ' firm-years, ' + fmtInt(r.firms) + ' firms' };
  }

  function h1Forests(M) {
    const host = $('#h1-forests'); host.innerHTML = '';
    [['H1 L1_RD_SALES0', 'L1_RD_SALES0'], ['H1 L1_LOG_AI_PAT_STOCK', 'L1_LOG_AI_PAT_STOCK'], ['H1 L1_AI_WORKER', 'L1_AI_WORKER']]
      .forEach(([model, term]) => {
        const div = document.createElement('div');
        div.innerHTML = '<h3 class="mini-h">' + RES_NAME[term] + '</h3><div class="chart"></div>';
        host.appendChild(div);
        const rows = [['ln_C', 'claims (C)', true], ['ln_G', 'generic risk (G)', false], ['ln_F', 'firm risk (F)', false]]
          .map(([y, label, bold]) => {
            const w = est(M, model, term, 'WITHIN', y), b = est(M, model, term, 'BETWEEN', y);
            return w && b ? { label, bold, points: [fpoint(w, 'within firm'), fpoint(b, 'between firms', true)] } : null;
          }).filter(Boolean);
        C.forest(div.querySelector('.chart'), { rows, labelW: 96, xFmt: (t) => String(t).replace(/^(-?)0\./, '$1.') });
      });
    C.legend(host, [{ name: 'within firm (filled)', color: '--accent' }, { name: 'between firms (hollow)', color: '--ink-2' }]);
  }

  function h2Forests(M) {
    const host = $('#h2-forests'); host.innerHTML = '';
    [{ model: 'H2 L1_LOG_AI_PAT_STOCK x INTERNAL_DEV', main: 'L1_LOG_AI_PAT_STOCK',
       title: 'AI patent portfolio × internal AI development (S₂)',
       rows: [['L1_LOG_AI_PAT_STOCK', 'AI patent portfolio alone'], ['RxM', '× internal development']] },
     { model: 'H2 L1_RD_SALES0 x HIGH_AIIE', main: 'L1_RD_SALES0',
       title: 'R&D intensity × high industry AI exposure (S₁)',
       rows: [['L1_RD_SALES0', 'R&D intensity alone'], ['RxM', '× high AI exposure']] }]
      .forEach((cfgRow) => {
        const div = document.createElement('div');
        div.innerHTML = '<h3 class="mini-h">' + cfgRow.title + '</h3><div class="chart"></div>';
        host.appendChild(div);
        const rows = cfgRow.rows.map(([term, label]) => {
          const w = est(M, cfgRow.model, term, 'WITHIN'), b = est(M, cfgRow.model, term, 'BETWEEN');
          return w && b ? { label, bold: term === 'RxM', points: [fpoint(w, 'within firm'), fpoint(b, 'between firms', true)] } : null;
        }).filter(Boolean);
        C.forest(div.querySelector('.chart'), { rows, labelW: 128, xFmt: (t) => String(t).replace(/^(-?)0\./, '$1.') });
      });
  }

  function h3Lines(MG, fe) {
    const host = $('#h3-lines'); host.innerHTML = '';
    MG.filter((m) => m.fe === fe).forEach((m) => {
      const div = document.createElement('div');
      div.innerHTML = '<h3 class="mini-h">' + (m.resource === 'R&D / revenue' ? 'R&D / revenue (R₁)' : 'AI patent portfolio (R₂)') + '</h3><div class="chart"></div>';
      host.appendChild(div);
      C.bandLine(div.querySelector('.chart'), {
        x: m.x, xFmt: (v) => pct(v, 1), yFmt: (v) => String(+v.toFixed(3)).replace(/^(-?)0\./, '$1.'),
        yLabel: 'effect on ln(1 + C)',
        series: [{ name: m.resource, eff: m.eff, lo: m.lo, hi: m.hi,
                   color: m.resource === 'R&D / revenue' ? '--accent' : '--c2' }],
        tipFmt: (x, e2, lo, hi) => 'suit rate ' + pct(x, 1) + '<br>effect ' + e2.toFixed(3).replace(/^(-?)0\./, '$1.') +
                 ' [' + lo.toFixed(3).replace(/^(-?)0\./, '$1.') + ', ' + hi.toFixed(3).replace(/^(-?)0\./, '$1.') + ']',
      });
    });
  }

  function slopeChart(M, SL, res, fe) {
    const rows = SL.filter((s) => s.resource === res && s.fe === fe && s.spec === 'H1 slopes' &&
                                  s.kind === 'slope' && s.firms >= 20 && s.industry !== 'All sectors')
      .sort((a, b) => b.coef - a.coef)
      .map((s) => ({ label: s.industry, points: [{
        est: s.coef, se: s.se, name: s.mode === 'in-house' ? 'develops AI internally' : 'obtains AI externally',
        color: s.mode === 'in-house' ? '--c2' : '--c3',
        tip: 'slope ' + s.coef.toFixed(3).replace(/^(-?)0\./, '$1.') + ', p ' + pfmt(s.p) +
             '<br>' + fmtInt(s.firms) + ' firms hold the resource' }] }));
    C.forest($('#ch-slopes'), { rows, w: 760, labelW: 170, rowH: 30, xFmt: (t) => String(t).replace(/^(-?)0\./, '$1.') });
    C.legend($('#ch-slopes'), [{ name: 'develops AI internally', color: '--c2' }, { name: 'obtains AI externally', color: '--c3' }]);
    need(['models'], ({ models: MM }) => {
      const wd = MM.wald.filter((w) => w.resource === res && w.spec === 'H1 slopes' && w.kind === 'slope');
      const one = wd.find((w) => w.fe === fe);
      $('#sl-note').textContent = one
        ? 'Sectors drawn: at least 20 firms hold the resource. Wald test that the drawn slopes are equal, this design: p ' +
          pfmt(one.p) + ' across ' + one.industries + ' sectors.'
        : '';
    });
  }

  // ============================================================== SECTORS
  function initSectors() {
    need(['sectors', 'diffusion'], ({ sectors: S, diffusion: D }) => {
      const host = $('#sec-cards');
      host.innerHTML = '<div class="sec-grid">' + S.map((s) => {
        const d = D.series.find((x) => x.name === s.name);
        return '<div class="card sec-card"><div class="sec-head"><h2>' + esc(s.name) + '</h2>' +
          '<span class="pill ' + (s.mode === 'in-house' ? 'yes' : '') + '">' +
          (s.mode === 'in-house' ? 'develops AI internally' : 'obtains AI externally') + '</span></div>' +
          '<div class="kv">' +
          '<div><div class="k">firms / firm-years</div><div class="v">' + fmtInt(s.firms) + ' / ' + fmtInt(s.fy) + '</div></div>' +
          '<div><div class="k">10-Ks with a specific claim</div><div class="v">' + pct(s.anyC, 1) + '</div></div>' +
          '<div><div class="k">with generic AI risk</div><div class="v">' + pct(s.anyG, 1) + '</div></div>' +
          '<div><div class="k">median R&D / revenue</div><div class="v">' + (s.rd_med === 0 ? '0' : String(+s.rd_med.toFixed(2)).replace(/^0\./, '.')) + '</div></div>' +
          '<div><div class="k">firm-years reporting R&D</div><div class="v">' + pct(s.rd_pos) + '</div></div>' +
          '<div><div class="k">with an AI patent portfolio</div><div class="v">' + pct(s.pat) + '</div></div>' +
          '<div><div class="k">mean litigation exposure</div><div class="v">' + pct(s.suit, 1) + '</div></div>' +
          '<div><div class="k">high industry AI exposure</div><div class="v">' + (s.hi_aiie === null ? 'n/a' : pct(s.hi_aiie)) + '</div></div>' +
          '</div><div class="sec-spark">' + C.spark(d.C.map((v) => v || 0), { color: SECTOR_VAR[s.name], w: 220, h: 34 }) +
          '<span>share of 10-Ks with a specific claim, FY' + D.years[0] + '–' + D.years[D.years.length - 1] + '</span></div></div>';
      }).join('') + '</div>';
    });
  }

  // ============================================================== FILINGS
  const SENT = {};
  function sentFor(slug) {
    return SENT[slug] || (SENT[slug] = J('sentences/' + slug + '.json').catch(() => ({})));
  }
  function initFilings() {
    need(['firms', 'diffusion'], ({ firms: F, diffusion: D }) => {
      const sel = $('#inv-ind');
      const sectors = Object.keys(SLUG);
      sel.innerHTML = sectors.map((s) => '<option>' + esc(s) + '</option>').join('');
      sel.value = 'Software & IT services';
      const years = []; for (let y = 2014; y <= 2025; y++) years.push(y);
      const render = () => invRender(F, years);
      sel.addEventListener('change', render);
      $('#inv-c').addEventListener('change', render);
      let t = null;
      $('#inv-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 150); });
      render();
    });
  }
  function secUrl(cik, adsh) {
    const plain = adsh.replace(/-/g, '');
    return 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + plain + '/' + adsh + '-index.htm';
  }
  function invRender(F, years) {
    const q = $('#inv-search').value.trim().toLowerCase();
    const onlyC = $('#inv-c').checked;
    const sector = $('#inv-ind').value;
    let rows = q ? F.filter((f) => f.name.toLowerCase().includes(q)) : F.filter((f) => f.ind === sector);
    if (onlyC) rows = rows.filter((f) => f.years.some((y) => y[3] > 0));
    $('#inv-count').textContent = fmtInt(rows.length) + ' firms';
    const grid = $('#inv-grid');
    const cap = 220;
    const head = '<div class="inv-row inv-head"><span></span>' +
      years.map((y) => '<span class="yh">' + String(y).slice(2) + '</span>').join('') + '<span class="yh">claims</span></div>';
    const html = rows.slice(0, cap).map((f) => {
      const by = {}; f.years.forEach((y) => (by[y[0]] = y));
      const totC = f.years.reduce((a, y) => a + y[3], 0);
      const cells = years.map((yr) => {
        const y = by[yr];
        if (!y) return '<span class="inv-cell"></span>';
        const [fy, op, nai, nC] = y;
        const lv = !op ? 'x' : nai === 0 ? 0 : nC === 0 ? 1 : nC <= 2 ? 2 : 3;
        return '<a class="inv-cell lv-' + lv + '" href="' + secUrl(f.cik, y[7]) + '" target="_blank" rel="noopener"' +
          ' data-cik="' + f.cik + '" data-fy="' + fy + '" data-ind="' + esc(f.ind) + '"' +
          ' data-n="' + nai + '" data-c="' + nC + '" data-g="' + y[4] + '" data-f="' + y[5] + '"' +
          ' aria-label="' + esc(f.name) + ' FY' + fy + '"></a>';
      }).join('');
      return '<div class="inv-row"><button class="inv-name" title="' + esc(f.name) + '">' + esc(f.name) + '</button>' +
        cells + '<span class="inv-tot' + (totC ? '' : ' zero') + '">' + (totC || '') + '</span></div>';
    }).join('');
    grid.innerHTML = head + html + (rows.length > cap
      ? '<p class="m-note">Showing the first ' + cap + ' of ' + fmtInt(rows.length) + ' firms; refine the search to see the rest.</p>' : '');
    const names = grid.querySelectorAll('.inv-name');
    rows.slice(0, names.length).forEach((f, i) => names[i].addEventListener('click', () => firmPanel(f)));
    grid.querySelectorAll('a.inv-cell').forEach((a) => {
      a.addEventListener('mousemove', async (e) => {
        const d = a.dataset;
        const base = '<b>' + esc(a.getAttribute('aria-label')) + '</b><br>' +
          d.n + ' AI sentences · ' + d.c + ' specific claims, ' + d.g + ' generic risk, ' + d.f + ' firm risk';
        C.showTip(base, e);
        if (+d.n > 0) {
          const s = (await sentFor(SLUG[d.ind]))[d.cik + '_' + d.fy];
          if (s) C.showTip(base + '<q>' + esc(s.s) + '</q><i>' +
            (s.c ? 'a specific claim, ' + s.pts + ' of 6 points' : 'the filing’s first coded AI sentence') +
            ' · click to open the 10-K</i>', e);
        }
      });
      a.addEventListener('mouseleave', C.hideTip);
    });
  }

  // the firm profile (owner 2026-10-01): clicking a company name shows its disclosure and resource series,
  // the same firm-year values the models read; a sparkline skips years where the value is missing
  function fspark(years, vals, color) {
    const W2 = 150, H2 = 34, pts = [];
    const vs = vals.filter((v) => v != null);
    if (!vs.length) return '<span class="fp-na">no data</span>';
    const max = Math.max(...vs, 1e-9), x = (i) => (i / Math.max(1, vals.length - 1)) * W2;
    const y = (v) => H2 - 3 - (v / max) * (H2 - 8);
    let seg = [];
    vals.forEach((v, i) => {
      if (v == null) { if (seg.length) pts.push(seg); seg = []; }
      else seg.push(x(i).toFixed(1) + ',' + y(v).toFixed(1));
    });
    if (seg.length) pts.push(seg);
    return '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" class="fp-spark">' +
      pts.map((p) => p.length > 1
        ? '<polyline points="' + p.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
        : '<circle cx="' + p[0].split(',')[0] + '" cy="' + p[0].split(',')[1] + '" r="2" fill="' + color + '"/>').join('') + '</svg>';
  }
  function firmPanel(f) {
    const host = $('#firm-panel');
    const ys = f.years, fys = ys.map((y) => y[0]);
    const lastOf = (vals) => { for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return vals[i]; return null; };
    const fmtPat = (v) => (v == null ? 'n/a' : v >= 10 ? fmtInt(Math.round(v)) : v.toFixed(1));
    const series = [
      ['Specific capability claims (C)', 'per 10,000 words', ys.map((y) => y[6]), '#111111', (v) => (v == null ? 'n/a' : fnum(v))],
      ['R&D / revenue (R₁), t-1', 'ratio, capped at 1', ys.map((y) => y[8]), '#0b3d5c', (v) => (v == null ? 'n/a' : fnum(v))],
      ['AI patent stock (R₂), t-1', 'patents, before the log', ys.map((y) => y[9]), '#6a51a3', fmtPat],
      ['AI-worker share (R₃), t-1', 'share of employees, to FY2022', ys.map((y) => y[10]), '#1f8a70', (v) => (v == null ? 'n/a' : fnum(v))],
    ];
    host.innerHTML = '<div class="fp-head"><b>' + esc(f.name) + '</b><span>' + esc(f.ind) +
      ' · FY' + fys[0] + ' to FY' + fys[fys.length - 1] + '</span>' +
      '<button class="fp-x" aria-label="Close">×</button></div><div class="fp-grid">' +
      series.map(([lab, unit, vals, col, fm]) =>
        '<div class="fp-item"><div class="fp-lab">' + lab + '</div><div class="fp-unit">' + unit + '</div>' +
        fspark(fys, vals, col) + '<div class="fp-last">latest ' + fm(lastOf(vals)) + '</div></div>').join('') +
      '</div><p class="fp-note">These are the firm-year values the models read; a gap means the value is missing for that year.</p>';
    host.hidden = false;
    host.querySelector('.fp-x').addEventListener('click', () => (host.hidden = true));
    host.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'nearest' });
  }

  // ============================================================== METHOD
  // What each variable is: the raw material it starts as, its source, and its distribution over
  // the estimation sample. Stats come from data/variables.json, baked from the same results file
  // as the manuscript's descriptive table; only the words here are typed.
  const VARMETA = {
    C: { name: 'Specific capability claims (C)', raw: '10-K sentences',
         unit: 'sentences per 10,000 words',
         src: 'Sentences of the filing, classified by the three coders: a claim describes the firm’s own AI capability and meets at least 3 of 6 specificity criteria.' },
    G: { name: 'Generic AI risk (G)', raw: '10-K sentences',
         unit: 'sentences per 10,000 words',
         src: 'Boilerplate AI risk language that could appear in almost any firm’s filing.' },
    F: { name: 'Firm-specific AI risk (F)', raw: '10-K sentences',
         unit: 'sentences per 10,000 words',
         src: 'AI risk language tied to the firm’s own products, operations or deployments.' },
    L1_RD_SALES0: { name: 'R&D / revenue (R₁)', raw: 'accounting figures',
         unit: 'ratio at t-1, capped at 1',
         src: 'Two lines of the firm’s own financial statements (Compustat and SEC XBRL): R&D expense over revenue.' },
    L1_LOG_AI_PAT_STOCK: { name: 'AI patent portfolio (R₂)', raw: 'patent grants',
         unit: 'ln(1 + patent stock) at t-1',
         src: 'USPTO patents classified as AI by the AI Patent Dataset, accumulated per firm with 15% annual depreciation.' },
    L1_AI_WORKER: { name: 'AI-worker share (R₃)', raw: 'workforce records',
         unit: 'share of employees at t-1',
         src: 'The share of the firm’s employees in AI roles, from the replication package of a published study; available to fiscal year 2022.' },
    HIGH_AIIE: { name: 'High industry AI exposure (S₁)', raw: 'occupation scores',
         unit: 'above the panel median',
         src: 'A published occupation-based AI exposure score of the firm’s four-digit NAICS industry, so exposure can differ within a sector.' },
    INTERNAL_DEV: { name: 'Industry builds AI in-house (S₂)', raw: 'sector classification',
         unit: 'in-house sector',
         src: 'Equal to 1 in the five sectors classified as predominantly developing AI within their products or processes.' },
    IND_LIT_RATE: { name: 'Litigation exposure (L)', raw: 'class actions',
         unit: 'share of sector firms sued',
         src: 'Securities class actions (Audit Analytics, Stanford Clearinghouse): the share of the sector’s firms named as defendants in the calendar year before the filing.' },
  };
  const fnum = (v) => {
    if (v === 0) return '0';
    const a = Math.abs(v);
    const s = a >= 100 ? v.toFixed(0) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
    return s.replace(/^(-?)0\./, '$1.');
  };
  function varCards(VB) {
    const host = $('#var-cards');
    host.innerHTML = VB.map((v, i) => {
      const m = VARMETA[v.key];
      const W = 260, H = 64, n = v.counts.length, bw = W / n;
      const peak = Math.sqrt(Math.max(...v.counts, 1));
      const bars = v.counts.map((c, k) => {
        const h = c ? Math.max(2, (Math.sqrt(c) / peak) * (H - 4)) : 0;
        return c ? '<rect data-k="' + k + '" x="' + (k * bw + 0.5).toFixed(1) + '" y="' + (H - h).toFixed(1) +
          '" width="' + (bw - 1).toFixed(1) + '" height="' + h.toFixed(1) + '"></rect>' : '';
      }).join('');
      const xl = v.binary ? ['0', '1'] : [fnum(v.edges[0]), fnum(v.edges[n])];
      const tail = v.binary
        ? 'equal to 1 in ' + pct(v.mean, 0) + ' of firm-years'
        : (v.zero > 0.005 ? 'exactly zero in ' + pct(v.zero, 0) + ' of firm-years' : '');
      return '<div class="varcard"><div class="vc-top"><b>' + m.name + '</b>' +
        '<span class="vc-tag">' + m.raw + '</span></div>' +
        '<p class="vc-src">' + m.src + '</p>' +
        '<svg class="vc-hist" data-i="' + i + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' + bars + '</svg>' +
        '<div class="vc-ax"><span>' + xl[0] + '</span><span>' + m.unit + '</span><span>' + xl[1] + '</span></div>' +
        '<div class="vc-stats">N ' + fmtInt(v.n) + ' · mean ' + fnum(v.mean) + ' · SD ' + fnum(v.sd) +
        ' · min ' + fnum(v.min) + ' · max ' + fnum(v.max) + (tail ? ' · ' + tail : '') + '</div></div>';
    }).join('');
    $$('#var-cards .vc-hist').forEach((svg) => {
      const v = VB[+svg.dataset.i];
      svg.querySelectorAll('rect').forEach((rc) => {
        const k = +rc.dataset.k;
        const range = v.binary ? (k ? '1' : '0')
          : fnum(v.edges[k]) + ' to ' + fnum(v.edges[k + 1]);
        rc.addEventListener('mousemove', (e) => C.showTip('<b>' + range + '</b><br>' +
          fmtInt(v.counts[k]) + ' firm-years', e));
        rc.addEventListener('mouseleave', C.hideTip);
      });
    });
  }
  function initMethod() {
    need(['agreement', 'variables'], ({ agreement: A, variables: VB }) => {
      varCards(VB);
      const fields = Array.from(new Set(A.map((r) => r.field)));
      const pairs = Array.from(new Set(A.map((r) => r.pair))).filter((p) => p !== 'no_majority');
      const name = { 'ministral-phi4': 'Ministral × Phi-4', 'ministral-qwen': 'Ministral × Qwen',
                     'phi4-qwen': 'Phi-4 × Qwen', unanimous: 'all three agree' };
      const fname = { about: 'about AI?', cap: 'capability', risk: 'risk kind', tone: 'tone', spec: 'specificity' };
      $('#agree-tbl').innerHTML = '<div class="tablewrap"><table class="data"><thead><tr><th>coder pair</th>' +
        fields.map((f) => '<th class="num">' + (fname[f] || f) + '</th>').join('') + '</tr></thead><tbody>' +
        pairs.map((p) => '<tr><td>' + (name[p] || p) + '</td>' + fields.map((f) => {
          const r = A.find((x) => x.pair === p && x.field === f);
          return '<td class="num">' + (r ? pct(r.agree, 1) : '—') + '</td>';
        }).join('') + '</tr>').join('') + '</tbody></table></div>' +
        '<p class="note">Pairwise agreement of the three coders on every coded sentence; labels need 2-of-3.</p>';
    });
    scorer();
  }

  // The six specificity points as rough pattern rules. The real coding is three
  // LLMs reading with a codebook; this is a sketch so a visitor can feel the rubric.
  const CHECKS = [
    ['action', 'an action, not an intention', /\b(deploy(?:ed|s|ing)?|launch(?:ed|es|ing)?|us(?:es|ed|ing)|operat\w+|power(?:s|ed|ing)?|embed(?:ded|s)?|integrat\w+|runs?|running|serv(?:es|ing)|deliver\w+|process(?:es|ing)?|automat\w+|answers?|handles?|detects?|predicts?|leverag\w+|provid(?:es|ing)|offers?|puts?|gives?|generat\w+|analyz\w+|optimiz\w+|enables?)\b/i],
    ['use case', 'what it is used for', /\b(customers?|patients?|drivers?|users?|clients?|claims?|fraud|diagnos\w+|recommend\w+|search|support|underwrit\w+|inventory|logistics|scheduling|pricing|maintenance|manufactur\w+|questions?|orders?|routes?|safety|employees?|workforce|talent|hiring|sentiment|engagement|dashboards?|billing|payments?|security|marketing|sales|supply chain|forecast\w+|translat\w+)\b/i],
    ['named product', 'a product or system with a name', /™|®|\([A-Z]{2,6}\)|"[^"]{2,40}"|\b[A-Za-z]*[a-z][A-Z]\w+\b|(?:[a-z,;:]\s+)(?:[A-Z][\w-]+\s+){1,3}[A-Z][\w-]+/],
    ['number', 'a quantity', /\d\s*%|\$\s?\d|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:thousand|million|billion)\b|\b(?:over|more than|nearly|about|up to)\s+\S*\d/i],
    ['date or stage', 'when, or how far along', /\b(?:19|20)\d{2}\b|\b(?:now|currently|recently|pilot|beta|generally available|year-over-year|this year|patent[- ]pending|in production|rolled out|commercially)\b/i],
    ['verifiable detail', 'something an outsider could check', null],
  ];
  function scorer() {
    let exText = null, exPts = null;
    const run = () => {
      const s = $('#sc-in').value.trim();
      if (!s) { $('#sc-out').innerHTML = ''; $('#sc-sum').textContent = ''; return; }
      const hits = CHECKS.map(([k, d, rx]) => rx ? rx.test(s) : false);
      hits[5] = hits[2] || hits[3] || hits[4];
      const n = hits.filter(Boolean).length;
      $('#sc-out').innerHTML = CHECKS.map(([k, d], i) =>
        '<div class="sc-pt' + (hits[i] ? ' on' : '') + '"><b>' + k + '</b><small>' + d + '</small></div>').join('');
      const coders = (s === exText && exPts !== null)
        ? ' · the paper’s three coders, reading the sentence in its filing context, gave it <b>' + exPts + ' of 6</b>' : '';
      $('#sc-sum').innerHTML = '<b>' + n + ' of 6 points</b> · ' +
        (n >= 3 ? 'would count as a specific capability claim' : 'below the 3-point bar: not specific') +
        ' <small>(by these rough rules, not the paper’s coders' + coders + ')</small>';
    };
    $('#sc-go').addEventListener('click', run);
    $('#sc-in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
    $('#sc-ex').addEventListener('click', async () => {
      const s = await sentFor('software_it_services');
      const all = Object.values(s);
      const best = all.filter((x) => x.c && x.pts >= 5 && x.s.length < 340);
      const pick = best[Math.floor(Math.random() * best.length)] || all[0];
      exText = pick.s; exPts = pick.pts;
      $('#sc-in').value = pick.s; run();
    });
  }

  const INIT = { overview: initOverview, findings: initFindings, sectors: initSectors,
                 filings: initFilings, method: initMethod };
  loaded.overview = true; initOverview();
})();
