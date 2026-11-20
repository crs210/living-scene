// Comic renderer. It knows nothing about the scene: every visible thing is an ELEMENT
// that arrives from the server as { id, layer, code, params }, where `code` is the body of
// a draw function (k, p, t, m) written by the director (Claude, or the recorded stand-in).
//   k = the drawing kit below (inked, wobbly, flat-colour primitives)
//   p = that element's own numbers, eased toward their latest targets  <- this is the morph
//   t = seconds, m = shared mood { val, tension, wind }
// A new element's numbers start at 0 and ease up, so things grow in rather than pop.

const cv = document.getElementById('c'), g = cv.getContext('2d');
const TAU = Math.PI * 2, INK = '#15111c', PAPER = '#e9dcc0';
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
let boil = 0;                     // re-seeds the line wobble a few times a second ("line boil")
let WOB = 1.7;                    // grows with tension: an agitated room gets a shakier line
let pass = 0;                     // second ink pass uses a different wobble, so lines look gone-over by hand
const REG = [2.4, 1.7];           // colour plate printed slightly off the ink plate
const jit = (q, i) => [q[0] + (hash(i * 12.9898 + (boil + pass * 31) * 78.233 + (q[0] | 0) * 0.37) - 0.5) * 2 * WOB, q[1] + (hash(i * 39.346 + (boil + pass * 31) * 11.135 + (q[1] | 0) * 0.41) - 0.5) * 2 * WOB];
const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

function trace(pts, close, curve, still) {
  const P = still ? pts : pts.map(jit), n = P.length;
  g.beginPath();
  if (curve && n > 2) {
    if (close) {
      g.moveTo((P[0][0] + P[n - 1][0]) / 2, (P[0][1] + P[n - 1][1]) / 2);
      for (let i = 0; i < n; i++) { const b = P[(i + 1) % n]; g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + b[0]) / 2, (P[i][1] + b[1]) / 2); }
    } else {
      g.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < n - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      g.lineTo(P[n - 1][0], P[n - 1][1]);
    }
  } else { g.moveTo(P[0][0], P[0][1]); for (let i = 1; i < n; i++) g.lineTo(P[i][0], P[i][1]); }
  if (close) g.closePath();
}
const ell = (x, y, rx, ry, n = 14) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * TAU) * rx, y + Math.sin(i / n * TAU) * ry]);

// ---------- the kit: everything scene code is allowed to call ----------
const k = {
  PI: Math.PI, clamp, lerp: (a, b, u) => a + (b - a) * u, rand: hash,
  mix(a, b, u) { const A = hex(a), B = hex(b); u = clamp(u); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * u).toString(16).padStart(2, '0')).join(''); },
  shape(pts, fill, o = {}) {
    if (pts.length < 2) return;
    const lw = o.lw ?? 4;
    g.save(); g.globalAlpha *= o.a ?? 1;
    if (fill) { g.save(); if (lw > 0) g.translate(REG[0], REG[1]); trace(pts, true, o.curve, o.still); g.fillStyle = fill; g.fill(); g.restore(); }
    if (lw > 0) {
      g.strokeStyle = o.ink || INK; g.lineJoin = g.lineCap = 'round';
      trace(pts, true, o.curve, o.still); g.lineWidth = lw; g.stroke();
      if (lw >= 3 && !o.still) { pass = 1; trace(pts, true, o.curve, false); pass = 0; g.lineWidth = lw * 0.4; g.globalAlpha *= 0.75; g.stroke(); }
    }
    g.restore();
  },
  rect(x, y, w, h, fill, o) { if (w > 0.5 && h > 0.5) k.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, o); },
  blob(x, y, rx, ry, fill, o = {}) { if (rx > 0.4 && ry > 0.4) k.shape(ell(x, y, rx, ry), fill, { curve: true, ...o }); },
  line(pts, lw = 4, color = INK, o = {}) {
    if (pts.length < 2) return;
    g.save(); g.globalAlpha *= o.a ?? 1; trace(pts, false, o.curve, o.still);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = g.lineJoin = 'round'; g.stroke();
    if (lw >= 4 && !o.still) { pass = 1; trace(pts, false, o.curve, false); pass = 0; g.lineWidth = lw * 0.4; g.globalAlpha *= 0.7; g.stroke(); }
    g.restore();
  },
  // halftone: a dot screen clipped to a polygon; fade 'up' / 'down' shrinks the dots across it
  dots(pts, color, size = 3, gap = 10, o = {}) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    g.save(); g.globalAlpha *= o.a ?? 1; trace(pts, true, false, true); g.clip(); g.fillStyle = color; g.beginPath();
    let row = 0; for (let y = y0; y <= y1; y += gap * 0.866, row++) {
      const u = (y - y0) / Math.max(1, y1 - y0), r = size * (o.fade === 'down' ? u : o.fade === 'up' ? 1 - u : 1); if (r < 0.35) continue;
      for (let x = x0 + (row % 2) * gap / 2; x <= x1; x += gap) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
    }
    g.fill(); g.restore();
  },
  hatch(pts, color = INK, gap = 8, lw = 1.6) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    g.save(); trace(pts, true, false, true); g.clip(); g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
    const h = y1 - y0; for (let x = x0 - h; x <= x1; x += gap) { g.moveTo(x, y1); g.lineTo(x + h, y0); }
    g.stroke(); g.restore();
  },
  // a printed glow: flat disc, then rings of shrinking dots
  glow(x, y, r, color, a = 1) {
    if (r < 2 || a <= 0.01) return;
    g.save(); g.globalAlpha *= clamp(a); g.fillStyle = color;
    g.globalAlpha *= 0.55; g.beginPath(); g.arc(x, y, r * 0.42, 0, TAU); g.fill(); g.globalAlpha /= 0.55;
    g.beginPath(); const gap = 9;
    for (let rad = r * 0.42, ring = 0; rad < r; rad += gap, ring++) { const s = 3.4 * (1 - (rad - r * 0.42) / (r * 0.58)); if (s < 0.4) break; const n = Math.max(6, Math.floor(TAU * rad / gap)); for (let i = 0; i < n; i++) { const an = (i + (ring % 2) / 2) / n * TAU, px = x + Math.cos(an) * rad, py = y + Math.sin(an) * rad; g.moveTo(px + s, py); g.arc(px, py, s, 0, TAU); } }
    g.fill(); g.restore();
  },
  burst(x, y, r1, r2, n, fill, o) { const pts = []; for (let i = 0; i < n * 2; i++) { const an = i / (n * 2) * TAU - Math.PI / 2, r = i % 2 ? r2 : r1; pts.push([x + Math.cos(an) * r, y + Math.sin(an) * r]); } if (r1 > 0.5) k.shape(pts, fill, o); },
  alpha(a, fn) { if (a <= 0.01) return; g.save(); g.globalAlpha *= clamp(a); fn(); g.restore(); },
  // ---- ready-made pieces: less code for the director to write, and one consistent hand ----
  figure(x, y, h = 60, coat = '#d8372f', o = {}) {
    const s = h / 60, sw = o.walk !== undefined ? Math.sin(o.walk) * 8 * s : 0, skin = o.skin || '#f3c9a5';
    if (o.sit) {
      k.line([[x - 3 * s, y], [x - 2 * s, y + 18 * s]], 4 * s, INK); k.line([[x + 4 * s, y], [x + 6 * s, y + 18 * s]], 4 * s, INK);
      k.shape([[x - 9 * s, y - 26 * s], [x + 9 * s, y - 26 * s], [x + 10 * s, y], [x - 10 * s, y]], coat, { lw: 3 });
      k.blob(x + (o.bowed ? 4 * s : 0), y - (o.bowed ? 32 : 35) * s, 8 * s, 8 * s, skin, { lw: 2.5 }); return;
    }
    k.blob(x, y + 2 * s, 15 * s, 4 * s, INK, { lw: 0, a: 0.4 });
    k.line([[x, y - 22 * s], [x + sw, y]], 5 * s, INK); k.line([[x, y - 22 * s], [x - sw, y]], 5 * s, INK);
    k.shape([[x - 10 * s, y - 52 * s], [x + 10 * s, y - 52 * s], [x + 12 * s, y - 20 * s], [x - 12 * s, y - 20 * s]], coat, { lw: 3.5 });
    if (o.arms) { k.line([[x - 9 * s, y - 48 * s], [x - 21 * s, y - 72 * s]], 4 * s, INK); k.line([[x + 9 * s, y - 48 * s], [x + 21 * s, y - 72 * s]], 4 * s, INK); }
    k.blob(x + (o.bowed ? 4 * s : 0), y - (o.bowed ? 57 : 61) * s, 9 * s, 9 * s, skin, { lw: 3 });
    if (o.hair) k.shape([[x - 9 * s, y - 63 * s], [x - 5 * s, y - 72 * s], [x + 5 * s, y - 72 * s], [x + 9 * s, y - 63 * s]], o.hair, { lw: 2, curve: true });
  },
  tree(x, y, height = 200, o = {}) {
    const size = Math.max(0.05, height / 200);   // height is in pixels, trunk base at (x, y)
    const bare = clamp(o.bare ?? 0), bloom = clamp(o.bloom ?? 0), seed = o.seed || 1, sway = o.sway || 0, tips = [];
    const br = (bx, by, a, len, d, id) => {
      if (d > 4 || len < 4) return;
      const snapped = bare > 0.6 && d >= 1 && hash(id + seed * 7) < (bare - 0.6) * 1.6, L = snapped ? len * 0.45 : len, a2 = a + sway * 0.03 * (d + 1);
      const x2 = bx + Math.cos(a2) * L, y2 = by + Math.sin(a2) * L;
      k.line([[bx, by], [x2, y2]], Math.max(2, (5.5 - d) * 1.6 * size), INK);
      if (snapped) { k.line([[x2, y2], [x2 + 6 * size, y2 + 9 * size]], 2, INK); return; }
      if (d >= 2) tips.push([x2, y2, id]);
      br(x2, y2, a2 - 0.4 - hash(id + seed) * 0.25, len * 0.72, d + 1, id * 2); br(x2, y2, a2 + 0.36 + hash(id + seed + 0.5) * 0.25, len * 0.7, d + 1, id * 2 + 1);
    };
    br(x, y, -Math.PI / 2, 70 * size, 0, 1);
    for (const [tx, ty, id] of tips) {
      const r = (1 - bare) * (16 + hash(id) * 10) * size; if (r > 2) k.blob(tx, ty, r, r * 0.85, o.leaf || '#3f9a5a', { lw: 2.5 });
      if (bloom > 0.05 && hash(id + 3) < bloom) k.blob(tx + (hash(id + 5) - 0.5) * 14 * size, ty - 4 * size, 5 * size * (0.6 + bloom), 5 * size * (0.6 + bloom), o.flower || '#ee6f9a', { lw: 1.5 });
    }
  },
  cloud(x, y, w, fill = '#fbf6e9', o = {}) {
    const h = w * 0.16;
    k.shape([[x, y], [x + w * 0.16, y - h * 1.1], [x + w * 0.34, y - h * 0.7], [x + w * 0.5, y - h * 1.7], [x + w * 0.7, y - h * 0.8], [x + w * 0.86, y - h * 1.1], [x + w, y], [x + w * 0.8, y + h * 0.65], [x + w * 0.2, y + h * 0.75]], fill, { lw: 4, curve: true, a: o.a });
    if (o.dark) k.hatch([[x + w * 0.1, y], [x + w * 0.9, y], [x + w * 0.8, y + h * 0.7], [x + w * 0.2, y + h * 0.7]], INK, 7);
  },
  smoke(x, y, amount, colour, t, wind = 0) { for (let i = 0; i < 8; i++) { if (i > amount * 9) break; const u = (t * 0.06 + i / 8) % 1; k.blob(x + u * (30 + 160 * wind) + Math.sin(u * 9 + i) * 12, y - u * (120 + 80 * amount), 10 + u * (30 + 30 * amount), 8 + u * (20 + 20 * amount), colour || '#8d879c', { lw: 3, a: (1 - u) * 0.9 }); } },
  sparkle(x, y, r, colour = '#fbf6e9') { k.burst(x, y, r, r * 0.25, 4, colour, { lw: 0 }); },
  crack(x, y, len = 60, seed = 1) {
    let px = x, py = y; const pts = [[x, y]];
    for (let i = 1; i <= 5; i++) { px += (hash(seed + i) - 0.5) * len * 0.35; py += len / 5; pts.push([px, py]); if (i === 2 || i === 4) k.line([[px, py], [px + (hash(seed + i * 3) - 0.5) * len * 0.5, py + len * 0.18]], 2, INK, { still: true }); }
    k.line(pts, 2.5, INK, { still: true });
  },
  boards(x, y, w, h) { k.rect(x, y, w, h, '#2a2440', { lw: 3 }); k.shape([[x - 3, y + h * 0.18], [x + w + 3, y + h * 0.04], [x + w + 3, y + h * 0.3], [x - 3, y + h * 0.44]], '#8a6a4a', { lw: 2.5 }); k.shape([[x - 3, y + h * 0.58], [x + w + 3, y + h * 0.74], [x + w + 3, y + h * 0.98], [x - 3, y + h * 0.82]], '#8a6a4a', { lw: 2.5 }); },
  scribble(x, y, w, h, colour = '#ee6f9a', seed = 1) {
    const pts = []; for (let i = 0; i < 9; i++) pts.push([x + (i / 8) * w + (hash(seed + i) - 0.5) * w * 0.2, y + h / 2 + (i % 2 ? -1 : 1) * h * 0.45 * (0.5 + hash(seed + i * 2) * 0.5)]);
    k.line(pts, 4, colour, { curve: true, still: true }); k.line([[x + w * 0.1, y + h * 1.05], [x + w * 0.8, y + h]], 3, colour, { still: true });
  },
};

// ---------- scene store ----------
const els = new Map();       // id -> { layer, code, fn, cur, tgt, errors }
const mood = { val: 0, tension: 0, wind: 0, decay: 0, bloom: 0, light: 0.6, warmth: 0, storm: 0, rain: 0, mist: 0, wonder: 0, bond: 0 }, moodT = { ...mood };
let phase = 'gathering', note = '', slidersTouched = false;
let order = [], latestId = null, sceneMode = '';
const BANNED = /\b(window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|import|eval|Function|constructor|prototype|__proto__|localStorage|sessionStorage|location|navigator|cookie|postMessage|setTimeout|setInterval|while|require|process)\b/;
function compile(code) {
  // NOTE: a word blocklist is a seatbelt, not a sandbox. Before a public room, run scene code
  // in a sandboxed iframe or worker. Audience text can steer what the model writes.
  if (BANNED.test(code) || code.length > 6000) throw new Error('scene code rejected by safety check');
  return new Function('k', 'p', 't', 'm', '"use strict";' + code);
}
function applyScene(scene) {
  sceneMode = scene.mode; latestId = scene.latest; phase = scene.phase || 'gathering'; note = scene.note || '';
  if (scene.m) Object.assign(moodT, scene.m);
  if (scene.settings && !slidersTouched) for (const key of ['abstraction', 'magnitude']) { const inp = document.getElementById(key); if (inp) inp.value = scene.settings[key]; }
  document.getElementById('keys').textContent = (scene.mode.startsWith('recorded') ? 'DEMO SCENE: pre-written, not Claude reading answers' : 'Scene written by ' + scene.mode) + '  ·  S controls · C scene code · F feed · H hide all · R reset';
  const seen = new Set();
  for (const e of scene.els) {
    seen.add(e.id);
    let el = els.get(e.id);
    if (!el || el.code !== e.code) {
      let fn = null, err = null; try { fn = compile(e.code); } catch (x) { err = String(x.message); console.warn('element', e.id, err); }
      const cur = el ? el.cur : Object.fromEntries(Object.keys(e.params).map(key => [key, e.base ? e.params[key] : 0]));
      el = { layer: e.layer, code: e.code, desc: e.desc, fn, cur, tgt: {}, errors: err ? 99 : 0, born: el ? el.born : performance.now(), grow: el ? el.grow : (e.base ? 1 : 0) };
      els.set(e.id, el);
    }
    el.tgt = e.params; el.layer = e.layer; el.gone = false;
    for (const key in e.params) if (!(key in el.cur)) el.cur[key] = 0;
  }
  for (const [id, el] of els) if (!seen.has(id)) el.gone = true;       // removed elements shrink away
  order = [...els.entries()].sort((a, b) => a[1].layer - b[1].layer);
  renderCodePanel();
}

// ---------- paper grain ----------
const grain = document.createElement('canvas'); grain.width = grain.height = 256;
{ const x = grain.getContext('2d'), im = x.createImageData(256, 256); for (let i = 0; i < 256 * 256; i++) { const v = 128 + (Math.random() - 0.5) * 150 * (Math.random() < 0.04 ? 1.6 : 1); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } x.putImageData(im, 0, 0); }
let grainPat = null, tonePat = null;
// a faint dot screen laid over the whole panel, so new and old elements share one print texture
const tone = document.createElement('canvas'); tone.width = tone.height = 10;
{ const x = tone.getContext('2d'); x.fillStyle = '#231a3c'; for (const [px, py] of [[2.5, 2.5], [7.5, 7.5]]) { x.beginPath(); x.arc(px, py, 1.5, 0, TAU); x.fill(); } }

// ---------- frame ----------
let sc = 1, ox = 0, oy = 0, prev = performance.now(), fps = 60;
const pops = [];
function resize() { const d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; const m = 0.035 * Math.min(cv.width, cv.height); sc = Math.min((cv.width - 2 * m) / 1600, (cv.height - 2 * m) / 900); ox = (cv.width - 1600 * sc) / 2; oy = (cv.height - 900 * sc) / 2; grainPat = g.createPattern(grain, 'repeat'); tonePat = g.createPattern(tone, 'repeat'); }
addEventListener('resize', resize); resize();

function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000), t = now / 1000; prev = now; fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
  boil = Math.floor(t * (5 + 7 * mood.tension)); WOB = 1.7 + 3.4 * mood.tension;
  for (const key in mood) mood[key] += (moodT[key] - mood[key]) * (1 - Math.exp(-dt / (phase === 'final' ? 5 : 3)));
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = PAPER; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(sc, 0, 0, sc, ox, oy);
  g.save(); g.beginPath(); g.rect(0, 0, 1600, 900); g.clip();
  for (const [id, el] of order) {
    const kx = 1 - Math.exp(-dt / 2.4);
    for (const key in el.tgt) el.cur[key] += ((el.gone ? 0 : el.tgt[key]) - el.cur[key]) * kx;
    el.grow += ((el.gone ? 0 : 1) - el.grow) * (1 - Math.exp(-dt / 0.9));
    if (el.gone && el.grow < 0.01) { els.delete(id); continue; }
    if (!el.fn || el.errors > 3) continue;
    g.save(); g.globalAlpha = clamp(el.grow * 1.6);
    try { el.fn(k, el.cur, t, mood); } catch (x) { if (++el.errors > 3) console.warn('element disabled:', id, x.message); }
    g.restore();
  }
  atmosphere(t);
  // an inked "pop" the instant an answer is accepted, before it has been interpreted
  for (let i = pops.length - 1; i >= 0; i--) { const q = pops[i]; q.age += dt; const u = q.age / 0.7; if (u > 1) { pops.splice(i, 1); continue; } g.save(); g.globalAlpha = 1 - u; k.burst(q.x, q.y, 20 + u * 60, 8 + u * 22, 9, '#fbf6e9', { lw: 4 }); g.restore(); }
  // printed finish inside the panel: dot screen, then ink pooling toward the corners
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.2; g.fillStyle = tonePat; g.fillRect(0, 0, 1600, 900);
  const vg = g.createRadialGradient(800, 430, 380, 800, 450, 1050); vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(1, 'rgba(70,50,110,1)');
  g.globalAlpha = 0.75; g.fillStyle = vg; g.fillRect(0, 0, 1600, 900);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.restore();
  // hand-ruled panel frame
  k.shape([[0, 0], [1600, 0], [1600, 900], [0, 900]], null, { lw: 11 });
  // grain over everything, paper and ink alike, so the page reads as one print
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.5 + 0.3 * mood.decay; g.fillStyle = grainPat;
  const gx = hash(boil) * 256 | 0, gy = hash(boil + 9) * 256 | 0; g.translate(-gx, -gy); g.fillRect(gx, gy, cv.width, cv.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.16; g.fillStyle = '#e0c48c'; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  requestAnimationFrame(frame);
}

// ---------- atmosphere: weather and colour grade over the whole panel, from the feelings of the room ----------
function atmosphere(t) {
  const M = mood;
  if (M.mist > 0.03) { g.fillStyle = '#d9d2c4'; for (let i = 0; i < 6; i++) { g.globalAlpha = M.mist * 0.2; const x = ((hash(i + 3) * 2400 + t * (8 + i * 3)) % 2600) - 500, y = 420 + i * 70 + Math.sin(t * 0.2 + i) * 20; g.beginPath(); g.ellipse(x, y, 520, 46 + i * 6, 0, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  if (M.rain > 0.03) {
    const n = M.rain * 190, sl = 14 + M.wind * 60 + M.storm * 20; g.strokeStyle = '#e4ecff'; g.lineWidth = 2.2; g.globalAlpha = 0.35 + 0.35 * M.rain; g.beginPath();
    for (let i = 0; i < n; i++) { const x = ((hash(i) * 2000 + t * (120 + hash(i + 5) * 160) * (0.2 + M.wind)) % 2000) - 200, y = ((hash(i + 9) * 1100 + t * (950 + hash(i + 2) * 500)) % 1100) - 100; g.moveTo(x, y); g.lineTo(x + sl, y + 52); }
    g.stroke(); g.globalAlpha = 1;
  }
  if (M.wonder > 0.04) for (let i = 0; i < M.wonder * 46; i++) { const tw = Math.sin(t * (1.5 + hash(i) * 2) + i * 2.1); if (tw < 0.2) continue; g.globalAlpha = tw * 0.9; k.sparkle(hash(i + 11) * 1600, hash(i + 23) * 640 + Math.sin(t * 0.3 + i) * 10, 5 + tw * 9, i % 3 ? '#fbf6e9' : '#f6c544'); }
  g.globalAlpha = 1;
  // grade: wear drains the colour; light and warmth tint the whole print
  if (M.decay > 0.02) { g.globalCompositeOperation = 'saturation'; g.globalAlpha = Math.min(0.75, M.decay * 0.8); g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 1600, 900); }
  const dark = clamp((0.6 - M.light) / 0.6), bright = clamp((M.light - 0.6) / 0.4);
  if (dark > 0.01) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = dark * 0.72; g.fillStyle = '#1a1838'; g.fillRect(0, 0, 1600, 900); }
  if (bright > 0.01) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = bright * 0.55; g.fillStyle = '#fff4d0'; g.fillRect(0, 0, 1600, 900); }
  if (Math.abs(M.warmth) > 0.03) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = Math.abs(M.warmth) * 0.5; g.fillStyle = M.warmth > 0 ? '#ff9a3c' : '#2f58d8'; g.fillRect(0, 0, 1600, 900); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

// ---------- wiring ----------
const feedEl = document.getElementById('feed'), codeEl = document.getElementById('code');
function renderCodePanel() {
  if (!document.body.classList.contains('code')) return;
  codeEl.innerHTML = '';
  const add = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; d.textContent = text; codeEl.append(d); return d; };
  add('h3', '', `Scene: ${order.length} elements (${sceneMode})   ${fps.toFixed(0)} fps   phase: ${phase}`);
  if (note) add('div', 'new', 'The picture now says: ' + note);
  add('div', 'el', 'atmosphere  ' + Object.entries(moodT).filter(e => Math.abs(e[1]) > 0.02).map(([a, b]) => `${a} ${(+b).toFixed(2)}`).join('  '));
  for (const [id, el] of order) add('div', id === latestId ? 'new' : 'el', `${id === latestId ? '▶ ' : '  '}${id}  ${JSON.stringify(Object.fromEntries(Object.entries(el.tgt).map(([a, b]) => [a, +(+b).toFixed(2)])))}`);
  const el = els.get(latestId);
  if (el) { add('h3', '', '').style.marginTop = '2vh'; add('h3', '', `Latest element written: "${latestId}"`); add('div', 'el', el.desc || ''); add('div', '', '\n' + el.code.trim()); }
}
const es = new EventSource('/events');
es.addEventListener('state', msg => {
  const s = JSON.parse(msg.data);
  if (s.scene) applyScene(s.scene);
  moodT.val = s.t.val; moodT.tension = s.t.tension; moodT.wind = s.t.wind;
  const have = new Set([...feedEl.children].map(c => +c.dataset.id)), want = new Set(s.feed.map(f => f.id));
  for (const c of [...feedEl.children]) if (!want.has(+c.dataset.id)) c.remove();
  for (const f of s.feed.slice(0, 9).reverse()) if (!have.has(f.id)) { const d = document.createElement('div'); d.dataset.id = f.id; d.textContent = f.text; feedEl.prepend(d); }
});
es.addEventListener('accept', () => { if (pops.length < 30) pops.push({ x: 300 + Math.random() * 1000, y: 800 + Math.random() * 60, age: 0 }); });
fetch('/api/config').then(r => r.json()).then(c => {
  document.getElementById('q').textContent = c.question; document.getElementById('url').textContent = c.joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const qr = document.getElementById('qr'); qr.onerror = () => qr.remove(); qr.src = '/qr.svg';
});
// sliders: abstraction (how literal or dreamlike) and magnitude (how much each batch changes)
const setting = b => fetch('/api/settings', { method: 'POST', body: JSON.stringify(b) });
for (const key of ['abstraction', 'magnitude']) document.getElementById(key).addEventListener('input', e => { slidersTouched = true; setting({ [key]: +e.target.value }); });
document.getElementById('start').onclick = () => setting({ start: +document.getElementById('secs').value || 120 });
document.getElementById('settle').onclick = () => setting({ settle: true });
document.getElementById('final').onclick = () => setting({ final: true });
document.getElementById('newq').onclick = () => { const q = document.getElementById('question').value.trim(); if (q) setting({ question: q }).then(() => { feedEl.innerHTML = ''; document.getElementById('q').textContent = q; }); };
const EXAMPLES = ['Honestly I just have a bad feeling about where this ends up', 'I worry hackers will use it to break into everything, but I hope it helps people understand each other', 'Cybersecurity. Every lock we rely on is going to fail', 'Excited about curing diseases, though my kids may never find jobs'];
addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target.tagName === 'INPUT') return;
  if (key === 's') document.body.classList.toggle('controls');
  if (key === 'f') document.body.classList.toggle('nofeed');
  if (key === 'h') document.body.classList.toggle('bare');
  if (key === 'c') { document.body.classList.toggle('code'); renderCodePanel(); }
  if (key === 'r') fetch('/api/reset', { method: 'POST' }).then(() => { feedEl.innerHTML = ''; });
  if (EXAMPLES[+key - 1]) fetch('/api/submit', { method: 'POST', body: JSON.stringify({ text: EXAMPLES[+key - 1], cid: 'demo' + Math.random() }) });
});
const qs = new URLSearchParams(location.search);
for (const c of ['bare', 'nofeed', 'code']) if (qs.has(c)) document.body.classList.add(c);
window.comicDiag = () => ({ fps: Math.round(fps), els: order.map(([id, el]) => [id, el.errors]), mode: sceneMode });
requestAnimationFrame(frame);
