/* ============================================================================
   The opening picture: one dot per 10-K filing (22,780), drawn on canvas.
   Four stages, autoplaying on arrival (motion-and-hosting recipe):
     0  every filing, in columns by fiscal year
     1  AI language spreads, a year-by-year sweep
     2  specific capability claims stay rare
     3  the dots regroup by sector: claims concentrate where sectors build AI
   It always runs: only its Pause pill stops it (owner 2026-10-02), and it
   restarts from the first stage whenever the Overview tab is opened again.
   Numbers in the readout count between values. prefers-reduced-motion lands on
   the final stage with no animation.
   ========================================================================= */
(function (global) {
  'use strict';
  var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
  var reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = function (fn) {
    var done = false;
    requestAnimationFrame(function (t) { if (!done) { done = true; fn(t); } });
    setTimeout(function () { if (!done) { done = true; fn(performance.now()); } }, 90);
  };
  var fmtInt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var fmtPct = function (n) { return Math.round(n) + '%'; };

  var D = null, cv, ctx, wrap, capEl, numEl, subEl;
  var dots = [], layouts = {}, colors = {};
  var cur = { stage: -1, sweep: 12 };
  var anim = null;

  function colorSet() {
    colors = {
      base: '#ded9cd', faded: '#eceae3',
      ai: css('--i7') || '#5b8fb3',
      claim: css('--c2') || '#009E73',
      ink: css('--ink') || '#111'
    };
  }

  /* pack each column bottom-up; pitch chosen so the tallest column fits */
  function layout(colOf, ncol, gapAfter) {
    var W = cv.width / DPR, H = cv.height / DPR, top = 8, bottom = 22;
    var counts = []; for (var c = 0; c < ncol; c++) counts.push(0);
    dots.forEach(function (d) { counts[colOf(d)]++; });
    var gap = 10, extra = gapAfter >= 0 ? 14 : 0;
    var colW = (W - gap * (ncol - 1) - extra) / ncol;
    var maxN = Math.max.apply(null, counts);
    var p = Math.max(1.6, Math.min(3.4, Math.sqrt(colW * (H - top - bottom) / maxN) * 0.97));
    var perRow = Math.max(1, Math.floor(colW / p));
    var x0 = [], acc = 0;
    for (c = 0; c < ncol; c++) { x0.push(acc); acc += colW + gap + (c === gapAfter ? extra : 0); }
    var idx = counts.map(function () { return 0; });
    var pos = new Float32Array(dots.length * 2);
    dots.forEach(function (d, i) {
      var c2 = colOf(d), k = idx[c2]++;
      pos[2 * i] = x0[c2] + (k % perRow) * p + p / 2;
      pos[2 * i + 1] = H - bottom - Math.floor(k / perRow) * p - p / 2;
    });
    return { pos: pos, p: p, x0: x0, colW: colW, H: H, bottom: bottom };
  }

  var DPR = Math.min(2, global.devicePixelRatio || 1);
  function size() {
    var w = wrap.clientWidth, h = Math.max(300, Math.min(380, w * 0.46));
    cv.width = w * DPR; cv.height = h * DPR; cv.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function build() {
    size(); colorSet();
    /* within each column: no-AI first (bottom), AI, then claims, so the lit dots surface on top */
    dots.sort(function (a, b) { return (a.y - b.y) || (a.l - b.l) || (a.s - b.s); });
    layouts.year = layout(function (d) { return d.y; }, 12, -1);
    var secOrder = [], inh = [], buy = [];
    D.sectors.forEach(function (s, i) { (D.inhouse[i] ? inh : buy).push(i); });
    secOrder = inh.concat(buy);
    var rank = {}; secOrder.forEach(function (s, i) { rank[s] = i; });
    dots.sort(function (a, b) { return (rank[a.s] - rank[b.s]) || (a.l - b.l); });
    layouts.sector = layout(function (d) { return rank[d.s]; }, 9, inh.length - 1);
    layouts.sector.order = secOrder; layouts.sector.nInh = inh.length;
    /* back to year order as the resting order of the dot array */
    dots.forEach(function (d, i) { d.sx = layouts.sector.pos[2 * i]; d.sy = layouts.sector.pos[2 * i + 1]; });
    dots.sort(function (a, b) { return (a.y - b.y) || (a.l - b.l) || (a.s - b.s); });
    layouts.year = layout(function (d) { return d.y; }, 12, -1);
    dots.forEach(function (d, i) { d.yx = layouts.year.pos[2 * i]; d.yy = layouts.year.pos[2 * i + 1]; });
  }

  function dotColor(d, stage, sweep) {
    if (stage === 0) return colors.base;
    if (stage === 1) return d.y <= sweep && d.l >= 2 ? colors.ai : colors.base;
    if (stage === 2) return d.l === 3 ? colors.claim : d.l === 2 ? colors.ai : colors.faded;
    return d.l === 3 ? colors.claim : d.l === 2 ? '#bcd2df' : colors.faded;
  }

  function draw(stage, sweep, mix) {
    var L = stage === 3 ? layouts.sector : layouts.year;
    var p = (stage === 3 ? layouts.sector.p : layouts.year.p) - 0.7;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var x = stage === 3 ? d.yx + (d.sx - d.yx) * mix : d.sx + (d.yx - d.sx) * mix;
      var y = stage === 3 ? d.yy + (d.sy - d.yy) * mix : d.sy + (d.yy - d.sy) * mix;
      ctx.fillStyle = dotColor(d, stage, sweep);
      ctx.fillRect(x - p / 2, y - p / 2, p, p);
    }
    labels(stage, mix);
  }

  function labels(stage, mix) {
    var H = cv.height / DPR;
    ctx.fillStyle = '#8a8578'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
    if (stage < 3 || mix < 1) {
      var Ly = layouts.year;
      for (var c = 0; c < 12; c += 2) ctx.fillText(String(2014 + c), Ly.x0[c] + Ly.colW / 2, H - 6);
    }
    if (stage === 3 && mix > 0.5) {
      var Ls = layouts.sector, half = Ls.x0[Ls.nInh - 1] + Ls.colW;
      ctx.fillText('develop AI internally', (Ls.x0[0] + half) / 2, H - 6);
      ctx.fillText('obtain AI externally', (Ls.x0[Ls.nInh] + Ls.x0[8] + Ls.colW) / 2, H - 6);
    }
  }

  /* ----------------------------------------------------------- readout */
  var lastNum = 0;
  function readout(cap, value, fmt, sub) {
    capEl.textContent = cap; subEl.textContent = sub;
    var from = lastNum, to = value; lastNum = value;
    if (reduced) { numEl.textContent = fmt(to); return; }
    var t0 = null, dur = 900, done = false;
    function step(ts) {
      if (done) return;
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur), k = 1 - Math.pow(1 - t, 3);
      numEl.textContent = fmt(from + (to - from) * k);
      if (t < 1) raf(step); else done = true;
    }
    raf(step);
    setTimeout(function () { if (!done) { done = true; numEl.textContent = fmt(to); } }, dur + 300);
  }

  /* ----------------------------------------------------------- stages */
  function tween(stage, ms, onFrame) {
    if (anim) anim.stop = true;
    var a = { stop: false }; anim = a;
    var t0 = null;
    function step(ts) {
      if (a.stop) return;
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / ms), k = 1 - Math.pow(1 - t, 3);
      onFrame(k);
      if (t < 1) raf(step);
    }
    raf(step);
  }

  function setStage(s, sweep) {
    var from = cur.stage; cur.stage = s; cur.sweep = sweep === undefined ? 12 : sweep;
    if (reduced) { draw(s, cur.sweep, 1); return; }
    if ((s === 3) !== (from === 3) && from !== -1) {
      tween(s, 650, function (k) { draw(s, cur.sweep, k); });
    } else {
      draw(s, cur.sweep, 1);
    }
  }

  /* ----------------------------------------------------------- the tour */
  var playing = false, gen = 0, idx = 0, btn, bar, tourEl;
  var C = null;   // counts for the readout

  function steps() {
    var opShare = function (yr) {
      var n = 0, ai = 0;
      dots.forEach(function (d) { if (d.y === yr - 2014 && d.l >= 1) { n++; if (d.l >= 2) ai++; } });
      return n ? 100 * ai / n : 0;
    };
    return [
      { ms: 2600, run: function (sl) {
          setStage(0);
          readout('One dot per 10-K filing', C.n10k, fmtInt, 'Form 10-K filings from ' + fmtInt(C.firms) + ' firms in nine sectors, fiscal years 2014 to 2025');
          return sl(2600);
        } },
      { ms: 12 * 420 + 900, run: function (sl) {
          var chain = Promise.resolve();
          for (var y = 0; y <= 11; y++) (function (y2) {
            chain = chain.then(function () {
              cur.sweep = y2; setStage(1, y2); draw(1, y2, 1);
              readout('AI language spreads', opShare(2014 + y2), fmtPct, 'of operating firms mention AI in fiscal year ' + (2014 + y2));
              return sl(y2 >= 8 ? 560 : 420);
            });
          })(y);
          return chain;
        } },
      { ms: 3200, run: function (sl) {
          setStage(2);
          readout('Specific capability claims are uncommon', C.nC10k, fmtInt, '10-K filings contain at least one specific capability claim');
          return sl(3200);
        } },
      { ms: 4200, run: function (sl) {
          setStage(3);
          readout('Claims concentrate where AI is developed internally', C.cSoft, fmtPct, 'of software 10-Ks contain a specific claim, against ' + fmtPct(C.cRetail) + ' in retail');
          return sl(4200);
        } }
    ];
  }

  function sleep(ms) {
    var g = gen;
    return new Promise(function (res, rej) {
      setTimeout(function () { (g === gen && playing) ? res() : rej('stop'); }, ms);
    });
  }
  function loop() {
    var g = gen, S = steps(), s = S[idx];
    progress(S, s);
    s.run(sleep).then(function () {
      if (g !== gen) return;
      idx = (idx + 1) % S.length;
      loop();
    }, function () {});
  }
  function progress(S, s) {
    var total = S.reduce(function (a, x) { return a + x.ms; }, 0);
    var before = S.slice(0, idx).reduce(function (a, x) { return a + x.ms; }, 0);
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(' + before / total + ')';
    bar.getBoundingClientRect();
    bar.style.transition = 'transform ' + s.ms + 'ms linear';
    bar.style.transform = 'scaleX(' + (before + s.ms) / total + ')';
  }
  function paint() {
    tourEl.classList.toggle('on', playing);
    btn.querySelector('.tour-t').textContent = playing ? 'Pause' : 'Play';
  }
  function play() { if (playing || reduced) return; playing = true; gen++; paint(); loop(); }
  function pause() {
    if (!playing) return;
    playing = false; gen++;
    var now = getComputedStyle(bar).transform;
    bar.style.transition = 'none'; bar.style.transform = now;
    paint();
  }
  function restart() { if (reduced || !btn) return; playing = false; gen++; idx = 0; play(); }   // from the first stage

  /* ----------------------------------------------------------- boot */
  function init(data) {
    D = data; C = D.counts;
    wrap = document.getElementById('hero-wrap'); cv = document.getElementById('hero-cv');
    capEl = document.getElementById('hero-cap'); numEl = document.getElementById('hero-num'); subEl = document.getElementById('hero-sub');
    tourEl = document.getElementById('hero-tour');
    if (!wrap || !cv) return;
    ctx = cv.getContext('2d');
    dots = D.y.map(function (y, i) { return { y: y, s: D.s[i], l: D.l[i] }; });
    build();
    tourEl.innerHTML = '<button type="button" class="tour-btn"><span class="tour-t">Play</span><i class="tour-bar"></i></button>';
    btn = tourEl.querySelector('.tour-btn'); bar = tourEl.querySelector('.tour-bar');
    btn.addEventListener('click', function () { playing ? pause() : play(); });
    global.addEventListener('resize', function () { build(); draw(Math.max(0, cur.stage), cur.sweep, 1); });
    if (reduced) {
      setStage(3);
      readout('Claims concentrate where AI is developed internally', C.cSoft, fmtPct, 'of software 10-Ks contain a specific claim, against ' + fmtPct(C.cRetail) + ' in retail');
    } else {
      setStage(0);
      play();
    }
  }

  /* the SVG twin of the current stage, for vector print captures: the canvas is replaced by an
     SVG with one rect per filing, so the screenshot figure keeps every dot vector */
  function vector() {
    if (!D || !cv) return false;
    var w = cv.width / DPR, h = cv.height / DPR;
    var sec = cur.stage === 3, L = sec ? layouts.sector : layouts.year;
    var p = L.p - 0.7, out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
                              '" width="' + w + '" height="' + h + '" role="img">'];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i], x = sec ? d.sx : d.yx, y = sec ? d.sy : d.yy;
      out.push('<rect x="' + (x - p / 2).toFixed(1) + '" y="' + (y - p / 2).toFixed(1) +
               '" width="' + p.toFixed(1) + '" height="' + p.toFixed(1) +
               '" fill="' + dotColor(d, cur.stage, cur.sweep) + '"/>');
    }
    var tx = function (x, s) { out.push('<text x="' + x + '" y="' + (h - 6) + '" font-family="Inter,sans-serif" font-size="11" fill="#8a8578" text-anchor="middle">' + s + '</text>'); };
    if (!sec) { for (var c = 0; c < 12; c += 2) tx(layouts.year.x0[c] + layouts.year.colW / 2, String(2014 + c)); }
    else {
      var Ls = layouts.sector, half = Ls.x0[Ls.nInh - 1] + Ls.colW;
      tx((Ls.x0[0] + half) / 2, 'develop AI internally');
      tx((Ls.x0[Ls.nInh] + Ls.x0[8] + Ls.colW) / 2, 'obtain AI externally');
    }
    out.push('</svg>');
    var host = document.createElement('div');
    host.innerHTML = out.join('');
    cv.replaceWith(host.firstChild);
    return true;
  }

  global.Hero = { init: init, pause: pause, restart: restart, vector: vector,
                  stage: function (s) { pause(); setStage(s, 12); } };     // deterministic hooks for tests and screenshots
})(window);
