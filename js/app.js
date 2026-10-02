/* ============================================================================
   Backed Claims: AI resources and AI talk in US 10-Ks (Paper A companion).

   Every number on the site is read from data/*.json, which build_data.py bakes
   from the analysis outputs. Nothing is typed in here except words.
   ========================================================================= */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const V = '?v=13';                                        // bump on each release: GitHub Pages caches hard
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
    if (v !== 'filings' && loaded.filings) leaveFilings();
    if (!loaded[v]) { loaded[v] = true; INIT[v](); }
    else if (v === 'filings') startTour();
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
  // The grid (one square per firm-year) opens a FILING WINDOW (owner 2026-10-02, after the paper-3 review panel):
  // every coded sentence of that 10-K, grouped by type with its six specificity criteria, beside the firm's
  // resources as the models read them (fiscal year t-1). A short tour plays when the tab opens; any click, key,
  // wheel or touch stops it and hands control to the reader.
  const SENT = {}, CODED = {}, PROF = {};
  function sentFor(slug) {
    return SENT[slug] || (SENT[slug] = J('sentences/' + slug + '.json').catch(() => ({})));
  }
  const codedFor = (cik) => CODED[cik] || (CODED[cik] = J('coded/' + cik + '.json').catch(() => ({})));
  const profFor = (ind) => PROF[ind] || (PROF[ind] = J('profiles/' + SLUG[ind] + '.json').catch(() => ({})));
  const FS = { F: null, byCik: {}, SY: null, years: [], render: null };
  const IN_HOUSE = new Set(['Software & IT services', 'Computers & chips', 'Aerospace & defense', 'Auto manufacturing', 'Pharma & biotech']);

  function initFilings() {
    need(['firms', 'sector_year'], ({ firms: F, sector_year: SY }) => {
      FS.F = F; FS.SY = SY;
      F.forEach((f) => (FS.byCik[f.cik] = f));
      const sel = $('#inv-ind');
      sel.innerHTML = Object.keys(SLUG).map((s) => '<option>' + esc(s) + '</option>').join('');
      sel.value = 'Software & IT services';
      for (let y = 2014; y <= 2025; y++) FS.years.push(y);
      FS.render = () => invRender(F, FS.years);
      sel.addEventListener('change', FS.render);
      $('#inv-c').addEventListener('change', FS.render);
      let t = null;
      $('#inv-search').addEventListener('input', () => { clearTimeout(t); t = setTimeout(FS.render, 150); });
      const grid = $('#inv-grid');
      grid.addEventListener('click', (e) => {
        const a = e.target.closest('a.inv-cell');
        if (a) {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;   // modifier-click: the 10-K itself
          e.preventDefault(); C.hideTip(); openFiling(+a.dataset.cik, +a.dataset.fy); return;
        }
        const b = e.target.closest('.inv-name');
        if (b) { C.hideTip(); const f = FS.byCik[+b.dataset.cik]; openFiling(f.cik, latestFy(f)); }
      });
      grid.addEventListener('mousemove', hoverCell);
      grid.addEventListener('mouseleave', C.hideTip);
      $('#inv-tour').addEventListener('click', () => (TOUR.on ? stopTour(null) : startTour()));
      FS.render();
      startTour();
    });
  }
  function latestFy(f) {
    for (let i = f.years.length - 1; i >= 0; i--) if (f.years[i][2] > 0) return f.years[i][0];
    return f.years[f.years.length - 1][0];
  }
  function secUrl(cik, adsh) {
    const plain = adsh.replace(/-/g, '');
    return 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + plain + '/' + adsh + '-index.htm';
  }
  const LV = (y) => (!y[1] ? 'x' : y[2] === 0 ? 0 : y[3] === 0 ? 1 : y[3] <= 2 ? 2 : 3);
  function invRender(F, years) {
    const q = $('#inv-search').value.trim().toLowerCase();
    const onlyC = $('#inv-c').checked;
    const sector = $('#inv-ind').value;
    let rows = q ? F.filter((f) => f.name.toLowerCase().includes(q)) : F.filter((f) => f.ind === sector);
    if (onlyC) rows = rows.filter((f) => f.years.some((y) => y[3] > 0));
    $('#inv-count').textContent = fmtInt(rows.length) + ' firms';
    const cap = 220;
    const head = '<div class="inv-row inv-head"><span></span>' +
      years.map((y) => '<span class="yh">' + String(y).slice(2) + '</span>').join('') + '<span class="yh">claims</span></div>';
    const html = rows.slice(0, cap).map((f) => {
      const by = {}; f.years.forEach((y) => (by[y[0]] = y));
      const totC = f.years.reduce((a, y) => a + y[3], 0);
      const cells = years.map((yr) => {
        const y = by[yr];
        if (!y) return '<span class="inv-cell"></span>';
        return '<a class="inv-cell lv-' + LV(y) + '" href="' + secUrl(f.cik, y[7]) + '" target="_blank" rel="noopener"' +
          ' data-cik="' + f.cik + '" data-fy="' + y[0] + '" aria-label="' + esc(f.name) + ' FY' + y[0] + ', open its coded sentences"></a>';
      }).join('');
      return '<div class="inv-row" data-cik="' + f.cik + '"><button class="inv-name" data-cik="' + f.cik + '" title="Open ' + esc(f.name) +
        '’s latest 10-K with AI sentences">' + esc(f.name) + '</button>' +
        cells + '<span class="inv-tot' + (totC ? '' : ' zero') + '">' + (totC || '') + '</span></div>';
    }).join('');
    $('#inv-grid').innerHTML = head + html + (rows.length > cap
      ? '<p class="m-note">Showing the first ' + cap + ' of ' + fmtInt(rows.length) + ' firms; refine the search to see the rest.</p>' : '');
  }
  async function hoverCell(e) {
    const a = e.target.closest('a.inv-cell');
    if (!a) { C.hideTip(); return; }
    const f = FS.byCik[+a.dataset.cik], fy = +a.dataset.fy, y = f.years.find((r) => r[0] === fy);
    const base = '<b>' + esc(f.name) + ' · FY' + fy + '</b><br>' + y[2] + ' AI sentences · ' + y[3] + ' specific claims, ' +
      y[4] + ' generic risk, ' + y[5] + ' firm-specific risk';
    const tail = '<i>click to open the coded sentences and the firm’s resources</i>';
    C.showTip(base + tail, e);
    if (y[2] > 0) {
      const s = (await sentFor(SLUG[f.ind]))[f.cik + '_' + fy];
      if (s && a.matches(':hover')) C.showTip(base + '<q>' + esc(s.s) + '</q>' + tail, e);
    }
  }

  // ---------------------------------------------------------------- the filing window
  const KIND = {
    C: ['Specific capability claim', 'k-c'], V: ['Capability, below the three-criteria bar', 'k-v'],
    G: ['Generic AI risk', 'k-g'], F: ['Firm-specific AI risk', 'k-f'], O: ['Other AI mention', 'k-o'], X: ['Not about AI, excluded', 'k-x'],
  };
  const GROUP_ORDER = ['C', 'V', 'G', 'F', 'O', 'X'];
  const GROUP_TITLE = {
    C: 'Specific capability claims (C)', V: 'Capability statements below the bar', G: 'Generic AI risk (G)',
    F: 'Firm-specific AI risk (F)', O: 'Other AI mentions', X: 'Excluded: not about AI',
  };
  const SECTION = {
    item1: 'Item 1, Business', item1a: 'Item 1A, Risk factors', item1b: 'Item 1B', item2: 'Item 2, Properties',
    item3: 'Item 3, Legal proceedings', item5: 'Item 5, Market', item7: 'Item 7, MD&A', item7a: 'Item 7A', unsegmented: 'section not identified',
  };
  const CRIT = ['action', 'use case', 'named product', 'number', 'date or stage', 'verifiable detail'];
  const AI_RX = /\b(artificial intelligence|machine[- ]learning|deep learning|neural networks?|generative AI|GenAI|large language models?|LLMs?|computer vision|natural language processing|NLP|cognitive computing|conversational AI|agentic AI|AI\/ML|A\.I\.|AI|ML)\b/g;
  const hl = (t) => esc(t).replace(AI_RX, '<mark class="kw">$1</mark>');
  const fragLink = (url, t) => {
    if (!url) return '';
    const w = t.replace(/[“”"‘’]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 7).join(' ');
    return url + '#:~:text=' + encodeURIComponent(w);
  };
  const money = (m) => (m == null ? 'n/a' : Math.abs(m) >= 1000 ? '$' + (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' billion'
    : '$' + (Math.abs(m) >= 10 ? Math.round(m) : m.toFixed(1)) + ' million');
  const pctTxt = (v, d) => (v == null ? 'n/a' : (v * 100).toFixed(d === undefined ? 1 : d) + '%');
  let WIN = null;

  function closeWindow() {
    if (!WIN) return;
    WIN.el.remove(); WIN = null;
    document.removeEventListener('keydown', winKeys);
  }
  function winKeys(e) {
    if (!WIN) return;
    if (e.key === 'Escape') closeWindow();
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const f = FS.byCik[WIN.cik], fys = f.years.map((y) => y[0]), i = fys.indexOf(WIN.fy) + (e.key === 'ArrowRight' ? 1 : -1);
      if (i >= 0 && i < fys.length) { e.preventDefault(); fillWindow(WIN.cik, fys[i]); }
    }
  }
  function openFiling(cik, fy, opts) {
    closeWindow();
    const f = FS.byCik[cik];
    const el = document.createElement('div');
    el.className = 'modal-back fw-back';
    el.innerHTML = '<div class="modal fw" role="dialog" aria-modal="true" aria-label="Coded sentences and resources for ' + esc(f.name) + '"></div>';
    document.body.appendChild(el);
    WIN = { el, cik, fy, tour: !!(opts && opts.tour), filter: 'all' };
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('.modal-x')) { closeWindow(); return; }
      const yb = e.target.closest('.fw-yr'); if (yb) { fillWindow(cik, +yb.dataset.fy); return; }
      const fb = e.target.closest('.fw-filter'); if (fb) { WIN.filter = fb.dataset.k; paintFilter(); }
    });
    document.addEventListener('keydown', winKeys);
    fillWindow(cik, fy);
  }
  function paintFilter() {
    if (!WIN) return;
    WIN.el.querySelectorAll('.fw-filter').forEach((b) => b.classList.toggle('on', b.dataset.k === WIN.filter));
    WIN.el.querySelectorAll('.fw-group').forEach((g) => (g.hidden = WIN.filter !== 'all' && g.dataset.k !== WIN.filter));
  }
  async function fillWindow(cik, fy) {
    if (!WIN) return;
    WIN.fy = fy; WIN.filter = 'all';
    const f = FS.byCik[cik], box = WIN.el.querySelector('.fw');
    const yrow = f.years.find((y) => y[0] === fy);
    box.innerHTML = '<div class="fw-headwrap">' + head(f, fy, yrow, '') + '</div>' +
      '<div class="fw-body"><section class="fw-sents"><p class="m-note">Loading the coded sentences…</p></section>' +
      '<aside class="fw-res"><p class="m-note">Loading the resources…</p></aside></div>';
    const [coded, prof] = await Promise.all([codedFor(cik), profFor(f.ind)]);
    if (!WIN || WIN.cik !== cik || WIN.fy !== fy) return;               // the reader moved on while this loaded
    const rec = coded[String(fy)] || { u: '', s: [] };
    box.querySelector('.fw-headwrap').innerHTML = head(f, fy, yrow, rec.u);
    box.querySelector('.fw-sents').innerHTML = sentencesHtml(rec, yrow);
    box.querySelector('.fw-res').innerHTML = resourcesHtml(f, fy, prof[String(cik)] || []);
    paintFilter();
    if (WIN.tour) tourScroll(box.querySelector('.fw-sents'));
  }
  function head(f, fy, yrow, url) {
    const kind = IN_HOUSE.has(f.ind) ? 'sector builds AI in-house' : 'sector buys AI';
    const link = url || (yrow ? secUrl(f.cik, yrow[7]) : '');
    const chips = f.years.map((y) => '<button class="fw-yr lv-' + LV(y) + (y[0] === fy ? ' on' : '') + '" data-fy="' + y[0] +
      '" title="FY' + y[0] + ': ' + y[3] + ' specific claims">' + String(y[0]).slice(2) + '</button>').join('');
    return '<div class="modal-head"><h3>' + esc(f.name) + ' <span class="fw-fy">FY' + fy + ' 10-K</span></h3>' +
      '<span class="m-meta">' + esc(f.ind) + ' · ' + kind + '</span>' +
      (link ? '<a class="modal-open" target="_blank" rel="noopener" href="' + link + '">10-K on sec.gov ↗</a>' : '') +
      '<button class="modal-x" aria-label="Close">×</button></div>' +
      '<div class="fw-years"><span>other years</span>' + chips + '<small>← → keys switch years · Esc closes</small></div>';
  }
  function sentencesHtml(rec, yrow) {
    const S = rec.s;
    if (!S.length) {
      return '<p class="fw-empty">No sentence in this 10-K matched the AI lexicon, so nothing was coded. ' +
        (yrow && !yrow[1] ? 'The filing is also outside the operating screen that year.' : '') + '</p>';
    }
    const groups = {}; GROUP_ORDER.forEach((k) => (groups[k] = []));
    S.forEach((s) => groups[s[2][0]].push(s));
    const counts = GROUP_ORDER.filter((k) => groups[k].length);
    const filters = '<div class="fw-filters"><button class="fw-filter on" data-k="all">all ' + S.length + '</button>' +
      counts.map((k) => '<button class="fw-filter ' + KIND[k][1] + '" data-k="' + k + '">' + GROUP_TITLE[k].replace(/ \([CGF]\)$/, '') +
        ' ' + groups[k].length + '</button>').join('') + '</div>';
    return filters + GROUP_ORDER.filter((k) => groups[k].length).map((k) =>
      '<div class="fw-group" data-k="' + k + '"><h4 class="' + KIND[k][1] + '">' + GROUP_TITLE[k] + ' <span>' + groups[k].length + '</span></h4>' +
      groups[k].map((s) => card(s, rec.u)).join('') + '</div>').join('') +
      '<p class="m-note">Each sentence is shown as the three language models coded it (a label needs two of three votes). ' +
      'Links jump to the sentence in the 10-K where the browser can find it.</p>';
  }
  function card(s, url) {
    const [t, sec, k, cap, crit] = s;
    const badges = k.split('').map((c) => '<span class="kb ' + KIND[c][1] + '">' + KIND[c][0] + '</span>').join('');
    let critHtml = '';
    if (crit) {
      const n = crit.split('').filter((c) => c === '1').length;
      critHtml = '<div class="fw-crit">' + CRIT.map((c, i) => '<span class="cr' + (crit[i] === '1' ? ' on' : '') + '">' + c + '</span>').join('') +
        '<b class="' + (n >= 3 ? 'ok' : '') + '">' + n + ' of 6' + (n >= 3 ? ' · a specific claim' : ' · below the bar of 3') + '</b></div>';
    }
    const capTxt = cap === 'u' ? '<span class="kc">current use</span>' : cap === 'i' ? '<span class="kc">intention</span>' : '';
    return '<div class="m-sent fw-card"><div class="fw-badges">' + badges + capTxt + '<span class="fw-sec">' + (SECTION[sec] || sec) + '</span></div>' +
      '<div class="m-txt">' + hl(t) + '</div>' + critHtml +
      (url ? '<div class="m-foot"><a target="_blank" rel="noopener" href="' + fragLink(url, t) + '">open at this sentence ↗</a></div>' : '') + '</div>';
  }

  // ---------------------------------------------------------------- resources beside the sentences
  function miniLine(xs, ys, med, sel, color, fmt) {
    const W = 260, H = 64, L = 4, R = 6, T = 8, B = 16;
    const all = ys.concat(med).filter((v) => v != null);
    if (!all.length) return '';
    const max = Math.max(...all, 1e-9), x = (i) => L + (i / Math.max(1, xs.length - 1)) * (W - L - R), y = (v) => T + (1 - v / max) * (H - T - B);
    const path = (vals) => {
      let d = '', pen = false;
      vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? ' L' : ' M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
      return d;
    };
    const dots = ys.map((v, i) => v == null ? '' : '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (xs[i] === sel ? 4 : 2) +
      '" fill="' + (xs[i] === sel ? color : '#fff') + '" stroke="' + color + '" stroke-width="1.4"><title>FY' + xs[i] + ' 10-K: ' + fmt(v) + '</title></circle>').join('');
    return '<svg class="fw-mini" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<path d="' + path(med) + '" fill="none" stroke="#9a9a9a" stroke-width="1.2" stroke-dasharray="3 3"/>' +
      '<path d="' + path(ys) + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round"/>' + dots +
      '<text x="' + L + '" y="' + (H - 3) + '" class="fw-ax">' + xs[0] + '</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 3) + '" class="fw-ax" text-anchor="end">' + xs[xs.length - 1] + '</text></svg>';
  }
  function miniBars(xs, series, sel) {
    const W = 260, H = 64, B = 16, T = 6, n = xs.length, bw = (W - 8) / n;
    const tot = xs.map((_, i) => series.reduce((a, s) => a + (s.v[i] || 0), 0));
    const max = Math.max(...tot, 1);
    let h = '';
    xs.forEach((yr, i) => {
      let y0 = H - B;
      series.forEach((s) => {
        const v = s.v[i] || 0; if (!v) return;
        const hh = (v / max) * (H - B - T);
        h += '<rect x="' + (4 + i * bw + 1).toFixed(1) + '" y="' + (y0 - hh).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + hh.toFixed(1) +
          '" fill="' + s.c + '" opacity="' + (yr === sel ? 1 : .55) + '"><title>FY' + yr + ' 10-K: ' + v + ' ' + s.n + '</title></rect>';
        y0 -= hh;
      });
      if (yr === sel) h += '<rect x="' + (4 + i * bw).toFixed(1) + '" y="' + T + '" width="' + bw.toFixed(1) + '" height="' + (H - B - T) + '" fill="none" stroke="#333" stroke-width=".8" stroke-dasharray="2 2"/>';
    });
    return '<svg class="fw-mini" viewBox="0 0 ' + W + ' ' + H + '">' + h +
      '<text x="4" y="' + (H - 3) + '" class="fw-ax">' + xs[0] + '</text><text x="' + (W - 4) + '" y="' + (H - 3) + '" class="fw-ax" text-anchor="end">' + xs[n - 1] + '</text></svg>';
  }
  function rank(p, ind) {
    if (p == null) return '';
    const v = Math.round(p * 100);
    return '<div class="fw-rank"><div class="fw-track"><i style="left:' + v + '%"></i></div><span>higher than <b>' + v + '%</b> of ' +
      esc(ind) + ' firms with data in the same 10-K year</span></div>';
  }
  function resourcesHtml(f, fy, rows) {
    const by = {}; rows.forEach((r) => (by[r[0]] = r));
    const r = by[fy], xs = rows.map((q) => q[0]);
    const med = (k) => xs.map((yr) => { const m = FS.SY.med[f.ind] && FS.SY.med[f.ind][String(yr)]; return m ? m[k] : null; });
    const m = (FS.SY.med[f.ind] || {})[String(fy)] || [];
    const prior = fy - 1;
    if (!r) return '<p class="m-note">No resource data for this firm-year.</p>';
    const [, , rd, rev, emp, rdr, rdp, aip, pat, stock, stp, aiw, awp, suits] = r;
    const lastAiw = (() => { for (let i = rows.length - 1; i >= 0; i--) if (rows[i][11] != null && rows[i][0] <= fy) return rows[i]; return null; })();
    const yrsUpTo = xs;
    const dis = f.years;
    const dxs = dis.map((y) => y[0]);
    const block = (title, sym, body) => '<div class="fw-rb"><h5>' + title + ' <span>' + sym + '</span></h5>' + body + '</div>';
    let h = '<h4 class="fw-res-h">Resources behind this 10-K</h4><p class="fw-res-sub">Measured in FY' + prior +
      ', the fiscal year before the filing, as in the models; the dashed line is the ' + esc(f.ind) + ' median.</p>';
    // R&D intensity
    h += block('R&amp;D intensity', 'R₁',
      (rdr == null ? '<p class="fw-big na">not reported</p>'
        : '<p class="fw-big">' + pctTxt(rdr) + '<small> of revenue</small></p>' +
          '<p class="fw-line">R&amp;D ' + money(rd) + ' on revenue of ' + money(rev) + ' in FY' + prior + (rdr >= 1 ? ' (capped at 100% in the models)' : '') +
          '; sector median ' + pctTxt(m[0]) + '.</p>' + rank(rdp, f.ind)) +
      miniLine(yrsUpTo, rows.map((q) => q[5]), med(0), fy, '#0b3d5c', (v) => pctTxt(v)));
    // AI patents
    h += block('AI patent portfolio', 'R₂',
      (stock == null ? '<p class="fw-big na">not available</p>'
        : '<p class="fw-big">' + (stock >= 10 ? fmtInt(Math.round(stock)) : stock.toFixed(1)) + '<small> AI patents in the portfolio</small></p>' +
          '<p class="fw-line">' + (aip == null ? 'Grants for FY' + prior + ' are not yet in the patent data' : fmtInt(aip) + ' AI patent' + (aip === 1 ? '' : 's') + ' granted in FY' + prior +
          (pat ? ', ' + pctTxt(aip / pat, 0) + ' of the firm’s ' + fmtInt(pat) + ' patents' : '')) +
          '. The portfolio adds every AI patent granted to the firm, losing 15% of its weight each year; sector median ' + (m[1] == null ? 'n/a' : m[1].toFixed(1)) + '.</p>' +
          rank(stp, f.ind)) +
      miniLine(yrsUpTo, rows.map((q) => q[9]), med(1), fy, '#6a51a3', (v) => v.toFixed(1)));
    // AI workforce
    const awRow = aiw != null ? r : lastAiw;
    h += block('AI workforce', 'R₃',
      (awRow == null ? '<p class="fw-big na">not available</p><p class="fw-line">The AI-worker data reach the 10-Ks of fiscal year 2022 (measured in FY2021).</p>'
        : '<p class="fw-big">' + (awRow[11] * 1000).toFixed(awRow[11] * 1000 >= 10 ? 0 : 1) + '<small> of every 1,000 employees in AI roles</small></p>' +
          '<p class="fw-line">An AI-worker share of ' + pctTxt(awRow[11], 2) + ' in FY' + (awRow[0] - 1) +
          (awRow === r ? '' : ', the latest year the AI-worker data cover') +
          (awRow[4] ? '; the firm reported ' + fmtInt(awRow[4]) + ' employees that year' : '') + '.</p>' + (awRow === r ? rank(awp, f.ind) : '')) +
      miniLine(yrsUpTo, rows.map((q) => q[11]), med(2), fy, '#1f8a70', (v) => pctTxt(v, 2)));
    // litigation
    h += block('Litigation exposure', 'L',
      '<p class="fw-big">' + pctTxt(m[3]) + '<small> of ' + esc(f.ind) + ' firms sued</small></p>' +
      '<p class="fw-line">Share of the sector’s firms named in a securities class action in the calendar year before this filing. ' +
      (suits ? 'This company had been named in ' + fmtInt(suits) + ' securities class action' + (suits === 1 ? '' : 's') + ' before this filing.' : 'This company had not been named in one before this filing.') + '</p>');
    // disclosure over time
    h += block('AI disclosure in this firm’s 10-Ks', 'C, G, F',
      '<p class="fw-line">Sentences per filing: <i class="sw k-c"></i>specific claims <i class="sw k-g"></i>generic risk <i class="sw k-f"></i>firm-specific risk.</p>' +
      miniBars(dxs, [{ n: 'specific claims', c: '#111111', v: dis.map((y) => y[3]) }, { n: 'generic risk', c: '#c8641e', v: dis.map((y) => y[4]) },
        { n: 'firm-specific risk', c: '#6a51a3', v: dis.map((y) => y[5]) }], fy));
    return h;
  }

  // ---------------------------------------------------------------- the tour
  const TOUR = { on: false, timers: [], i: 0, stops: null, cell: null };
  function tourStops() {
    if (TOUR.stops) return TOUR.stops;
    TOUR.stops = Object.keys(SLUG).map((ind) => {
      let best = null;
      FS.F.forEach((f) => {
        if (f.ind !== ind) return;
        f.years.forEach((y) => { if (y[1] && y[3] > 0 && (!best || y[3] > best.n || (y[3] === best.n && y[0] > best.fy))) best = { cik: f.cik, fy: y[0], n: y[3], ind }; });
      });
      return best;
    }).filter(Boolean);
    return TOUR.stops;
  }
  const later = (ms, fn) => TOUR.timers.push(setTimeout(fn, ms));
  function pill() {
    const b = $('#inv-tour');
    if (!b) return;
    b.classList.toggle('on', TOUR.on);
    b.querySelector('.tp-t').textContent = TOUR.on ? 'Pause tour' : 'Play tour';
  }
  function startTour() {
    if (REDUCED || TOUR.on || !FS.F) return;
    TOUR.on = true; pill();
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, userTakesOver, { capture: true, passive: true }));
    tourStep();
  }
  function userTakesOver(e) {
    if (!e.isTrusted || !TOUR.on) return;
    if (e.target && e.target.closest && e.target.closest('#inv-tour')) return;   // the pill toggles on its own
    const inWindow = WIN && (e.type === 'keydown' || (e.target && e.target.closest && e.target.closest('.fw')));
    stopTour(inWindow ? 'keep' : null);
  }
  function stopTour(keep) {
    if (!TOUR.on) return;
    TOUR.on = false;
    TOUR.timers.forEach(clearTimeout); TOUR.timers = [];
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.removeEventListener(ev, userTakesOver, { capture: true }));
    if (TOUR.cell) TOUR.cell.classList.remove('tour-hit');
    if (WIN) { if (keep === 'keep') WIN.tour = false; else closeWindow(); }
    const bar = $('#inv-tour .tp-bar'); if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; }
    pill();
  }
  function tourStep() {
    if (!TOUR.on) return;
    const stops = tourStops(); if (!stops.length) return;
    const s = stops[TOUR.i % stops.length]; TOUR.i += 1;
    closeWindow();
    $('#inv-search').value = ''; $('#inv-c').checked = false;
    if ($('#inv-ind').value !== s.ind) { $('#inv-ind').value = s.ind; FS.render(); }
    const cell = $('#inv-grid a.inv-cell[data-cik="' + s.cik + '"][data-fy="' + s.fy + '"]');
    if (TOUR.cell) TOUR.cell.classList.remove('tour-hit');
    TOUR.cell = cell;
    const STEP = 9500;
    const bar = $('#inv-tour .tp-bar');
    if (bar) { bar.style.transition = 'none'; bar.style.width = '0'; void bar.offsetWidth; bar.style.transition = 'width ' + STEP + 'ms linear'; bar.style.width = '100%'; }
    if (cell) { cell.closest('.inv-row').scrollIntoView({ block: 'center', behavior: 'smooth' }); cell.classList.add('tour-hit'); }
    later(1300, () => openFiling(s.cik, s.fy, { tour: true }));
    later(STEP, () => { if (cell) cell.classList.remove('tour-hit'); tourStep(); });
  }
  function tourScroll(list) {
    if (!list) return;
    const target = list.querySelector('.fw-group[data-k="G"], .fw-group[data-k="F"]');
    if (!target) return;
    later(4200, () => { if (WIN && WIN.tour) list.scrollTo({ top: target.offsetTop - list.offsetTop - 8, behavior: 'smooth' }); });
  }
  const leaveFilings = () => { stopTour(null); closeWindow(); };

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
