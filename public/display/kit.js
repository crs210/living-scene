// The drawing kit: the ONLY thing scene code may call. It inks and prints everything in one comic style,
// which is why drawings written at different times by different models still look like one picture.
// If you add a piece here, document it in src/prompt.js (KIT_DOC) or the director will never use it.
export const cv = document.getElementById('c'), g = cv.getContext('2d');
export const TAU = Math.PI * 2, INK = '#15111c', PAPER = '#e9dcc0';
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
// Settings the frame loop changes while the kit reads them:
//   boil     re-seeds the line wobble a few times a second ("line boil")
//   WOB      wobble size; grows with tension, so an agitated room gets a shakier line
//   Q        quality scaler: rises when frames are slow (coarser dots, single ink pass)
//   pass     the second ink pass uses a different wobble, so lines look gone-over by hand
export const pen = { boil: 0, WOB: 1.7, Q: 1, pass: 0 };
// The room's atmosphere as currently shown (mood) and where it is heading (moodT). Scene code reads it as m.
export const mood = { val: 0, tension: 0, wind: 0, decay: 0, bloom: 0, light: 0.6, warmth: 0, storm: 0, rain: 0, mist: 0, wonder: 0, bond: 0 }, moodT = { ...mood };
const REG = [2.4, 1.7];           // colour plate printed slightly off the ink plate
const jit = (q, i) => [q[0] + (hash(i * 12.9898 + (pen.boil + pen.pass * 31) * 78.233 + (q[0] | 0) * 0.37) - 0.5) * 2 * pen.WOB, q[1] + (hash(i * 39.346 + (pen.boil + pen.pass * 31) * 11.135 + (q[1] | 0) * 0.41) - 0.5) * 2 * pen.WOB];
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
export const k = {
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
      if (lw >= 3 && !o.still && pen.Q < 1.3) { pen.pass = 1; trace(pts, true, o.curve, false); pen.pass = 0; g.lineWidth = lw * 0.4; g.globalAlpha *= 0.75; g.stroke(); }
    }
    g.restore();
  },
  rect(x, y, w, h, fill, o) { if (w > 0.5 && h > 0.5) k.shape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, o); },
  blob(x, y, rx, ry, fill, o = {}) { if (rx > 0.4 && ry > 0.4) k.shape(ell(x, y, rx, ry), fill, { curve: true, ...o }); },
  line(pts, lw = 4, color = INK, o = {}) {
    if (pts.length < 2) return;
    g.save(); g.globalAlpha *= o.a ?? 1; trace(pts, false, o.curve, o.still);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = g.lineJoin = 'round'; g.stroke();
    if (lw >= 4 && !o.still && pen.Q < 1.3) { pen.pass = 1; trace(pts, false, o.curve, false); pen.pass = 0; g.lineWidth = lw * 0.4; g.globalAlpha *= 0.7; g.stroke(); }
    g.restore();
  },
  // halftone: a dot screen clipped to a polygon; fade 'up' / 'down' shrinks the dots across it
  dots(pts, color, size = 3, gap = 10, o = {}) {
    gap = Math.max(5, gap) * pen.Q; size *= pen.Q;
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
    g.beginPath(); const gap = 9 * pen.Q;
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
    if (o.hat) {
      const hx = x + (o.bowed ? 4 * s : 0), hy = y - (o.bowed ? 64 : 68) * s, tilt = Math.sin((o.walk || 0) * 0.5) * 2 * s;
      if (o.hat === 'top') { k.rect(hx - 7 * s + tilt, hy - 16 * s, 14 * s, 16 * s, '#15111c', { lw: 2 }); k.line([[hx - 12 * s, hy], [hx + 12 * s, hy]], 3.5 * s, INK); }
      else if (o.hat === 'crown') k.shape([[hx - 9 * s, hy], [hx - 9 * s, hy - 12 * s], [hx - 4 * s, hy - 6 * s], [hx, hy - 14 * s], [hx + 4 * s, hy - 6 * s], [hx + 9 * s, hy - 12 * s], [hx + 9 * s, hy]], '#f6c544', { lw: 2.5 });
      else { k.shape([[hx - 9 * s, hy], [hx + tilt * 2, hy - (o.hat === 'party' ? 30 : 22) * s], [hx + 9 * s, hy]], o.hat === 'party' ? '#57c7c2' : '#f6c544', { lw: 2.5 }); if (o.hat === 'party') k.blob(hx + tilt * 2, hy - 31 * s, 3.5 * s, 3.5 * s, '#d8372f', { lw: 1.5 }); }
    }
  },
  // people going about on their own: they hurry in wind, gather when the room is close, bow when things decay
  stroll(x1, x2, y, count, t, o = {}) {
    const size = o.size || 46, coats = o.coats || ['#d8372f', '#2f6f8f', '#f6c544', '#57c7c2', '#7a5c8e'], speed = (o.speed || 1) * (1 + 0.8 * mood.wind), span = Math.max(40, x2 - x1), mid = (x1 + x2) / 2;
    for (let i = 0; i < Math.min(24, count); i++) {
      const v = (18 + 22 * hash(i * 7 + 3)) * speed, u = (t * v + hash(i * 13 + 5) * span * 2) % (span * 2);
      const x = k.lerp(x1 + (u < span ? u : span * 2 - u), mid + (hash(i + 31) - 0.5) * span * 0.25, clamp(mood.bond) * 0.7);
      const hat = typeof o.hat === 'string' ? o.hat : o.hat ? ['cone', 'top', 'party', 'crown'][i % 4] : undefined;
      k.figure(x, y + (hash(i * 3 + 1) - 0.5) * (o.depth ?? 16), size * (0.85 + 0.3 * hash(i + 11)), coats[i % coats.length], { walk: t * v * 0.16 + i, bowed: mood.decay > 0.55, arms: o.arms || (mood.bloom > 0.7 && i % 3 === 0), hat });
    }
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
  // ---- larger ready-made pieces: one call each, so new ideas arrive fast and in one hand ----
  // a building standing on (x, y) = bottom centre
  building(x, y, w, h, colour = '#8a4f9c', o = {}) {
    const x0 = x - w / 2, y0 = y - h, seed = o.seed || 1, lit = clamp(o.lit ?? 0.5), brd = clamp(o.boarded ?? 0), crk = clamp(o.cracks ?? 0);
    k.rect(x0, y0, w, h, colour, { lw: 5 });
    k.rect(x0 + w * 0.76, y0, w * 0.24, h, k.mix(colour, INK, 0.45), { lw: 0 }); k.hatch([[x0 + w * 0.76, y0], [x0 + w, y0], [x0 + w, y], [x0 + w * 0.76, y]], INK, 9);
    if (o.roof !== 'flat') k.shape([[x0 - w * 0.07, y0], [x, y0 - Math.min(h * 0.35, w * 0.42)], [x0 + w * 1.07, y0]], o.roofColour || k.mix(colour, INK, 0.6), { lw: 5 });
    const cols = Math.max(1, Math.floor(w / 52)), rows = Math.max(1, Math.floor((h - (o.door === false ? 10 : 70)) / 58)), gw = (w * 0.72) / cols;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = x0 + w * 0.06 + c * gw + gw * 0.18, wy = y0 + 16 + r * 58, ww = gw * 0.62, wh = 34, id = seed * 31 + r * 7 + c;
      if (hash(id + 0.3) < brd) { k.boards(wx, wy, ww, wh); continue; }
      const on = hash(id) < lit; if (on) k.glow(wx + ww / 2, wy + wh / 2, 34, '#f6c544', 0.35);
      k.rect(wx, wy, ww, wh, on ? '#f6c544' : '#191636', { lw: 3 });
    }
    if (o.door !== false) { k.rect(x - 15, y - 56, 30, 56, o.doorColour || '#6b4630', { lw: 4 }); k.blob(x - 7, y - 26, 3, 3, '#f6c544', { lw: 1.5 }); }
    for (let i = 0; i < Math.round(crk * 4); i++) k.crack(x0 + w * (0.15 + hash(seed + i * 3) * 0.6), y0 + 6 + hash(seed + i) * h * 0.3, h * 0.45, seed + i);
  },
  // railings from (x1, y) to (x2, y), y = ground; broken 0..1 knocks bars out
  fence(x1, y, x2, h = 120, colour = INK, o = {}) {
    const gap = o.gap || 30, brk = clamp(o.broken ?? 0), n = Math.max(1, Math.floor((x2 - x1) / gap));
    k.line([[x1, y - h * 0.25], [x2, y - h * 0.25]], 5, colour, { still: true }); k.line([[x1, y - h * 0.8], [x2, y - h * 0.8]], 5, colour, { still: true });
    for (let i = 0; i <= n; i++) { const bx = x1 + i * gap, gone = hash(i * 3.3 + 1) < brk; if (gone && hash(i) < 0.5) continue; const tilt = gone ? (hash(i + 5) - 0.5) * h * 0.6 : 0; k.line([[bx, y], [bx + tilt, y - h * (gone ? 0.6 : 1)]], 5, colour); if (!gone) k.shape([[bx - 6, y - h], [bx, y - h - 14], [bx + 6, y - h]], colour, { lw: 0 }); }
  },
  // a sagging rope, cable or chain between two points
  rope(x1, y1, x2, y2, sag = 40, lw = 4, colour = INK, o = {}) {
    const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([x1 + (x2 - x1) * u, y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * sag]); }
    k.line(pts, lw, colour, { curve: true });
    if (o.links) for (let i = 1; i < 14; i++) k.blob(pts[i][0], pts[i][1], lw * 1.3, lw * 0.9, null, { lw: Math.max(2, lw * 0.6) });
    return pts;
  },
  flame(x, y, size, t, o = {}) {
    const f = Math.sin(t * 9 + x) * 0.12 + 1, s = size * f;
    k.shape([[x - s * 0.5, y], [x - s * 0.55, y - s * 0.5], [x - s * 0.15, y - s * 0.9], [x + Math.sin(t * 7) * s * 0.15, y - s * 1.6], [x + s * 0.3, y - s * 0.8], [x + s * 0.55, y - s * 0.4], [x + s * 0.45, y]], o.outer || '#ef7d2d', { lw: 4, curve: true });
    k.shape([[x - s * 0.25, y], [x - s * 0.2, y - s * 0.45], [x + Math.sin(t * 11) * s * 0.1, y - s * 0.95], [x + s * 0.25, y - s * 0.4], [x + s * 0.2, y]], o.inner || '#f6c544', { lw: 0, curve: true });
  },
  gear(x, y, r, teeth = 10, fill = '#8d879c', angle = 0) {
    const pts = []; for (let i = 0; i < teeth * 4; i++) { const a = angle + i / (teeth * 4) * TAU, rr = (i % 4 < 2) ? r : r * 0.78; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    k.shape(pts, fill, { lw: 4, still: true }); k.blob(x, y, r * 0.28, r * 0.28, INK, { lw: 0 });
  },
  // an eye: look = [-1..1, -1..1], lid 0 open .. 1 shut
  eye(x, y, w, o = {}) {
    const lid = clamp(o.lid ?? 0), h = w * 0.5 * (1 - lid * 0.9), lk = o.look || [0, 0];
    k.shape([[x - w, y], [x - w * 0.4, y - h], [x + w * 0.4, y - h], [x + w, y], [x + w * 0.4, y + h], [x - w * 0.4, y + h]], '#fbf6e9', { lw: 5, curve: true });
    if (lid < 0.85) { const ix = x + lk[0] * w * 0.35, iy = y + lk[1] * h * 0.3, r = Math.min(h * 0.85, w * 0.36); k.blob(ix, iy, r, r, o.iris || '#2f6fd0', { lw: 3 }); k.blob(ix, iy, r * 0.45, r * 0.45, INK, { lw: 0 }); }
  },
  // an open hand reaching from (x, y) along angle (radians)
  hand(x, y, size, angle = -Math.PI / 2, colour = '#f3c9a5', o = {}) {
    const c = Math.cos(angle), sn = Math.sin(angle), P = (f, sd) => [x + c * f * size - sn * sd * size, y + sn * f * size + c * sd * size], curl = clamp(o.closed ?? 0);
    k.line([P(-1.6, 0), P(-0.2, 0)], size * 0.62, INK); k.line([P(-1.6, 0), P(-0.2, 0)], size * 0.5, o.sleeve || colour);
    for (let i = 0; i < 4; i++) { const sd = -0.36 + i * 0.24, len = (0.95 - Math.abs(i - 1.5) * 0.12) * (1 - curl * 0.6); k.line([P(0.3, sd), P(0.3 + len, sd * 1.25)], size * 0.24, INK); k.line([P(0.3, sd), P(0.3 + len, sd * 1.25)], size * 0.16, colour); }
    k.line([P(0, -0.42), P(0.35, -0.82)], size * 0.24, INK); k.line([P(0, -0.42), P(0.35, -0.82)], size * 0.16, colour);
    k.blob(P(0.05, 0)[0], P(0.05, 0)[1], size * 0.48, size * 0.48, colour, { lw: 4 });
  },
  stairs(x, y, w, h, steps = 6, colour = '#8d879c') { const pts = [[x, y]]; for (let i = 0; i < steps; i++) { pts.push([x + (i * w) / steps, y - ((i + 1) * h) / steps]); pts.push([x + ((i + 1) * w) / steps, y - ((i + 1) * h) / steps]); } pts.push([x + w, y]); k.shape(pts, colour, { lw: 4 }); },
  flock(x, y, spread, count, t) { for (let i = 0; i < count; i++) { const bx = x + (hash(i + 2) - 0.5) * spread * 2 + Math.sin(t * 0.3 + i) * 30, by = y + (hash(i + 9) - 0.5) * spread + Math.sin(t * 0.5 + i * 2) * 14, wv = Math.sin(t * 7 + i) * 6; k.line([[bx - 12, by - wv], [bx, by], [bx + 12, by - wv]], 3, INK); } },
  // a band of water or hills across the whole frame: crest at y, filled down to the bottom
  wave(y, amp, len, t, fill, o = {}) { const pts = [[-40, 940]]; for (let wx = -40; wx <= 1640; wx += 40) pts.push([wx, y + Math.sin(wx / len + t * (o.speed ?? 1)) * amp + Math.sin(wx / (len * 0.37) + t * 0.7) * amp * 0.3]); pts.push([1640, 940]); k.shape(pts, fill, { lw: o.lw ?? 4, curve: false, a: o.a }); },
  scribble(x, y, w, h, colour = '#ee6f9a', seed = 1) {
    const pts = []; for (let i = 0; i < 9; i++) pts.push([x + (i / 8) * w + (hash(seed + i) - 0.5) * w * 0.2, y + h / 2 + (i % 2 ? -1 : 1) * h * 0.45 * (0.5 + hash(seed + i * 2) * 0.5)]);
    k.line(pts, 4, colour, { curve: true, still: true }); k.line([[x + w * 0.1, y + h * 1.05], [x + w * 0.8, y + h]], 3, colour, { still: true });
  },
};

