// Projector renderer. One fixed place (a harbour street under a signal tower, the hour
// before dawn) drawn procedurally every frame. Nothing is ever swapped: every visible
// quantity is a number that eases toward the latest target the server sent.

const cv = document.getElementById('c'), g = cv.getContext('2d');
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const col = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const hash = n => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- state ----------
const IDS = ['dread', 'security', 'understanding', 'jobs', 'surveillance', 'misinfo', 'growth', 'discovery', 'control', 'creativity', 'hope', 'pace', 'environment'];
const T = { val: 0, tension: 0, wind: 0, typing: 0, dval: 0, stars: 0 }, C = { ...T };
for (const id of IDS) { T[id] = C[id] = 0; T[id + '_e'] = C[id + '_e'] = 0.45; }
const TAU_OF = k => k.endsWith('_e') ? 2.2 : k === 'typing' ? 0.5 : (k === 'val' || k === 'tension' || k === 'wind' || k === 'dval') ? 3.5 : k === 'stars' ? 1.5 : 3.0;
let cloudOff = 0, millAng = 0, flow = 0;
const flies = [], bursts = [], ripples = [], seenEv = new Set();
let lastV = 0, ackV = 0;

// ---------- fixed layout (seeded, so the place is always the same place) ----------
const R = rng(11);
const STARS = Array.from({ length: 170 }, () => ({ x: -250 + R() * 2100, y: -180 + R() * 720, r: 0.5 + R() * 1.3, p: R() * TAU }));
const EXTRA = Array.from({ length: 80 }, () => ({ x: 80 + R() * 1440, y: 30 + R() * 380, p: R() * TAU }));
const CON = { n: [[760, 96], [842, 142], [930, 118], [1006, 176], [1096, 132], [1178, 84], [1250, 150], [1330, 104], [1160, 222], [1066, 268], [960, 250], [1268, 258], [1372, 214]],
  e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [4, 8], [8, 9], [9, 10], [10, 3], [8, 11], [11, 12], [12, 7]] };
const MOON = [430, 150], FAKES = [[640, 92], [250, 236], [820, 304], [130, 96], [560, 300], [960, 60]];
const CLOUDS = Array.from({ length: 10 }, (_, i) => ({ x: R() * 2400, y: 70 + R() * 330, s: 0.7 + R() * 1.1, k: 0.5 + R() * 0.8, blobs: Array.from({ length: 5 }, () => [R() * 220 - 110, R() * 30 - 15, 70 + R() * 80, 18 + R() * 20]) }));
const HOUSES = []; { let x = 176; for (let i = 0; i < 9; i++) { const w = 116 + R() * 16, h = 118 + R() * 96; const wins = []; const cols = w > 124 ? 3 : 2; for (let y = 600 - h + 20; y < 600 - 74; y += 40) for (let c = 0; c < cols; c++) wins.push({ x: x + 18 + c * ((w - 36 - 16) / (cols - 1)), y, lit: R() < 0.6, p: R() * TAU }); HOUSES.push({ x, w, h, roof: 26 + R() * 30, tone: R(), wins, cx: x + w / 2 }); x += w + 2; } }
const DOOR_RANK = [7, 3, 1, 5, 0, 6, 2, 4, 8];      // order in which doors give way (centre first)
const TOWER_X = 1012, LAMPS = [300, 520, 742, 962, 1184], lampAim = LAMPS.slice();
const FIGS = Array.from({ length: 10 }, (_, i) => ({ x: 200 + R() * 1150, dir: R() < 0.5 ? -1 : 1, sp: 13 + R() * 11, ph: R() * TAU, seat: 230 + i * 118 + R() * 30 }));
const FIG_RANK = [4, 8, 1, 6, 0, 9, 3, 7, 2, 5];
const LANTERNS = Array.from({ length: 28 }, () => ({ x: 200 + R() * 1120, per: 26 + R() * 22, ph: R(), hue: R(), sw: R() * TAU }));
const BIRDS = Array.from({ length: 9 }, () => ({ y: 150 + R() * 230, sp: 26 + R() * 22, ph: R() * 2000, f: R() * TAU }));
const ANCHOR = { dread: [110, 520], security: [748, 572], understanding: [800, 765], jobs: [690, 618], surveillance: [742, 540], misinfo: [640, 110], growth: [1440, 450], discovery: [1060, 170], control: [TOWER_X, 250], creativity: [600, 360], hope: [1270, 560], pace: [HOUSES[1].cx, 600 - HOUSES[1].h - 60], environment: [1118, 330] };

// ---------- primitives ----------
function glow(x, y, r, c, a) {
  if (a <= 0.004 || r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col(c, Math.min(1, a))); gr.addColorStop(1, col(c, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function dark(x, y, rx, ry, a, c = [3, 3, 9]) {
  if (a <= 0.004) return;
  g.save(); g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, col(c, Math.min(1, a))); gr.addColorStop(0.55, col(c, Math.min(1, a) * 0.8)); gr.addColorStop(1, col(c, 0));
  g.fillStyle = gr; g.fillRect(-rx, -rx, 2 * rx, 2 * rx); g.restore();
}
const light = fn => { g.globalCompositeOperation = 'lighter'; fn(); g.globalCompositeOperation = 'source-over'; };

// ---------- layers ----------
function sky() {
  const v = C.val, av = Math.abs(v) * 0.85;
  const top = mix([10, 14, 40], v > 0 ? [26, 36, 92] : [5, 6, 16], av);
  const mid = mix([30, 34, 84], v > 0 ? [98, 72, 124] : [18, 24, 40], av);
  let hor = mix([62, 60, 116], v > 0 ? [236, 158, 100] : [34, 46, 60], av);
  hor = mix(hor, [255, 186, 116], C.hope * 0.45);
  const gr = g.createLinearGradient(0, 0, 0, 610);
  gr.addColorStop(0, col(top)); gr.addColorStop(0.55, col(mid)); gr.addColorStop(1, col(hor));
  g.fillStyle = gr; g.fillRect(-600, -700, 2800, 1320);
  return { top, mid, hor };
}
function stars(t) {
  const dim = (1 - 0.55 * clamp(C.val)) * (1 - 0.5 * C.tension) * (1 - 0.4 * C.hope);
  g.fillStyle = '#fff';
  for (const s of STARS) { g.globalAlpha = dim * (0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p))); g.fillRect(s.x, s.y, s.r, s.r); }
  g.globalAlpha = 1;
  // every answer the interpreter could not place still leaves a star behind
  light(() => { for (let i = 0; i < EXTRA.length; i++) { const a = clamp(C.stars - i); if (a <= 0) break; const s = EXTRA[i]; glow(s.x, s.y, 9, [220, 230, 255], a * (0.6 + 0.3 * Math.sin(t * 2 + s.p))); } });
  // discovery: constellations draw themselves edge by edge
  const d = C.discovery, e = C.discovery_e, n = d * CON.e.length * 1.25;
  if (d > 0.01) light(() => {
    g.lineWidth = 1.4; g.lineCap = 'round';
    CON.e.forEach(([a, b], i) => {
      const k = clamp(n - i * 0.95); if (k <= 0) return;
      const [x1, y1] = CON.n[a], [x2, y2] = CON.n[b];
      g.strokeStyle = col([170, 215, 255], (0.3 + 0.55 * e) * k);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x2, k), lerp(y1, y2, k)); g.stroke();
      glow(x1, y1, 10 + 10 * e, [190, 225, 255], 0.75 * k); if (k > 0.98) glow(x2, y2, 10 + 10 * e, [190, 225, 255], 0.75);
    });
  });
}
function moonDisc(x, y, r, c, a, glitch, t, seed) {
  light(() => glow(x, y, r * 3.2, c, 0.22 * a));
  g.globalAlpha = a;
  for (let i = 0; i < 6; i++) {            // drawn in slices so counterfeits can tear
    const y0 = y - r + (2 * r / 6) * i, off = glitch ? (hash(Math.floor(t * 5) + i * 7 + seed) - 0.5) * glitch * (hash(Math.floor(t * 2.5) + seed) > 0.55 ? 1 : 0.1) : 0;
    g.save(); g.beginPath(); g.rect(x - r - 20, y0, 2 * r + 40, 2 * r / 6 + 0.6); g.clip();
    g.fillStyle = col(c); g.beginPath(); g.arc(x + off, y, r, 0, TAU); g.fill();
    g.fillStyle = col(mix(c, [60, 60, 90], 0.5), 0.35); g.beginPath(); g.arc(x + off - r * 0.25, y - r * 0.2, r * 0.22, 0, TAU); g.arc(x + off + r * 0.3, y + r * 0.3, r * 0.15, 0, TAU); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
}
function moons(t) {
  moonDisc(MOON[0], MOON[1], 34, [238, 236, 220], 0.95, 0, t, 0);
  const n = C.misinfo * FAKES.length * 1.15, e = C.misinfo_e;
  FAKES.forEach(([x, y], i) => { const a = clamp(n - i * 0.9); if (a > 0) moonDisc(x, y, 34 - i * 1.5, i % 2 ? [226, 244, 214] : [246, 220, 232], a * (0.55 + 0.4 * e), 8 + 14 * e, t, i * 13 + 5); });
}
function dawn() {
  const h = C.hope; if (h < 0.01) return; const e = C.hope_e;
  light(() => { glow(1270, 600, 260 + 620 * h, [255, 176, 108], h * (0.3 + 0.4 * e)); glow(1270, 600, 120 + 200 * h, [255, 226, 170], h * 0.6); });
  g.fillStyle = col([255, 236, 190], clamp(h * 1.6)); g.beginPath(); g.arc(1270, 628 - 70 * h, 44, 0, TAU); g.fill();
}
function birds(t) {
  const n = C.hope * BIRDS.length * 1.2; g.strokeStyle = 'rgba(20,18,30,.85)'; g.lineWidth = 1.6; g.lineCap = 'round';
  BIRDS.forEach((b, i) => {
    const a = clamp(n - i); if (a <= 0) return;
    const x = 1800 - ((t * b.sp + b.ph) % 2300), y = b.y + Math.sin(t * 0.6 + b.f) * 14, w = Math.sin(t * 7 + b.f) * 4;
    g.globalAlpha = a; g.beginPath(); g.moveTo(x - 8, y - w); g.lineTo(x, y); g.lineTo(x + 8, y - w); g.stroke();
  });
  g.globalAlpha = 1;
}
function clouds(pal) {
  const base = mix(mix(pal.mid, [8, 9, 16], 0.35 + 0.5 * C.tension), [255, 190, 150], 0.25 * clamp(C.val) + 0.2 * C.hope);
  const a = 0.16 + 0.5 * C.tension;
  for (const c of CLOUDS) {
    const x = ((c.x + cloudOff * c.k) % 2600) - 500;
    for (const [dx, dy, rx, ry] of c.blobs) dark(x + dx * c.s, c.y + dy, rx * c.s, ry * c.s, a, base);
  }
}
function hills(pal, t) {
  const far = mix(mix(pal.hor, [14, 18, 38], 0.62), [10, 10, 16], C.tension * 0.4);
  g.fillStyle = col(far); g.beginPath(); g.moveTo(-600, 620);
  for (let x = -600; x <= 2200; x += 20) g.lineTo(x, 540 - 34 * Math.sin(x * 0.0041 + 1) - 20 * Math.sin(x * 0.011 + 2.3));
  g.lineTo(2200, 620); g.fill();
  // the near hill with the tree
  const near = mix([16, 22, 40], [34, 62, 52], C.growth * 0.7);
  g.fillStyle = col(near); g.beginPath(); g.moveTo(1180, 606); g.bezierCurveTo(1300, 590, 1360, 500, 1450, 498); g.bezierCurveTo(1560, 498, 1640, 560, 2200, 580); g.lineTo(2200, 620); g.lineTo(1180, 620); g.fill();
  const gr = C.growth, e = C.growth_e;
  // flowers spread over the hill
  light(() => { for (let i = 0; i < 46; i++) { const a = clamp(gr * 60 - i); if (a <= 0) break; const fx = 1290 + hash(i) * 290, fy = 520 + hash(i + 50) * 70 + Math.max(0, (1400 - fx)) * 0.28; glow(fx, fy, 5, i % 3 ? [255, 190, 210] : [255, 240, 170], a * (0.4 + 0.5 * e)); } });
  tree(1446, 502, gr, e, t);
}
function tree(x0, y0, gr, e, t) {
  const D = 1.6 + gr * 5.6, tips = [];
  g.lineCap = 'round'; g.strokeStyle = col(mix([12, 12, 22], [44, 30, 30], gr));
  const br = (x, y, a, len, d, id) => {
    const k = clamp(D - d); if (k <= 0) return;
    const a2 = a + Math.sin(t * 0.9 + id) * 0.012 * (1 + C.wind * 4) * (d + 1);
    const x2 = x + Math.cos(a2) * len * k, y2 = y + Math.sin(a2) * len * k;
    g.lineWidth = Math.max(0.8, (6.5 - d) * (0.45 + 0.75 * gr)); g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (d >= 3) tips.push([x2, y2, k, id]);
    if (d < 7) { br(x2, y2, a2 - 0.3 - hash(id) * 0.34, len * 0.76, d + 1, id * 2); br(x2, y2, a2 + 0.27 + hash(id + 0.5) * 0.36, len * 0.73, d + 1, id * 2 + 1); }
  };
  br(x0, y0, -PI / 2 - 0.04, 26 + 62 * gr, 0, 1);
  const bl = clamp((gr - 0.12) * 2.2);
  if (bl > 0) light(() => { for (const [x, y, k, id] of tips) glow(x, y, 5 + 6 * bl, hash(id) > 0.4 ? [255, 176, 204] : [255, 244, 224], k * bl * (0.3 + 0.5 * e)); });
}
function tower(t) {
  const c = C.control, e = C.control_e, top = 300 - 160 * c;
  // smoke stacks (environment) stand beside it
  const env = C.environment, ee = C.environment_e;
  for (const sx of [1104, 1134]) { g.fillStyle = '#0a0c18'; g.fillRect(sx - 7, 380, 14, 230); g.fillRect(sx - 9, 376, 18, 6); }
  for (let i = 0; i < 34; i++) {
    const a = clamp(env * 40 - i * 0.6); if (a <= 0) break;
    const life = (t * (0.05 + hash(i) * 0.03) + hash(i + 9)) % 1, sx = i % 2 ? 1104 : 1134;
    dark(sx + life * (60 + 420 * C.wind) + Math.sin(life * 9 + i) * 14, 372 - life * (150 + 110 * env), 16 + life * (50 + 60 * env), 12 + life * (30 + 30 * env), a * (0.5 + 0.35 * ee) * (1 - life) * (0.35 + 0.65 * env), [26, 24, 30]);
  }
  g.fillStyle = '#0b0d1b'; g.beginPath(); g.moveTo(TOWER_X - 24, 610); g.lineTo(TOWER_X - 13, top + 26); g.lineTo(TOWER_X + 13, top + 26); g.lineTo(TOWER_X + 24, 610); g.fill();
  g.fillRect(TOWER_X - 19, top + 18, 38, 8); g.fillRect(TOWER_X - 11, top, 22, 20);
  g.beginPath(); g.moveTo(TOWER_X - 15, top); g.lineTo(TOWER_X, top - 18); g.lineTo(TOWER_X + 15, top); g.fill();
  g.fillRect(TOWER_X - 1, top - 40 - 30 * c, 2, 24 + 30 * c);
  const bc = mix(mix([255, 234, 186], [255, 70, 150], clamp(c * 1.3)), [255, 90, 80], C.surveillance * 0.35);
  light(() => {
    const th = t * 0.45, w = Math.cos(th), len = 900;
    for (const s of [1, -1]) {
      const k = Math.abs(w), dx = s * Math.sign(w) * len * (0.25 + 0.75 * k);
      const gr = g.createLinearGradient(TOWER_X, 0, TOWER_X + dx, 0); gr.addColorStop(0, col(bc, 0.2 * k + 0.03)); gr.addColorStop(1, col(bc, 0));
      g.fillStyle = gr; g.beginPath(); g.moveTo(TOWER_X, top + 10); g.lineTo(TOWER_X + dx, top + 10 - 46 * k - 10); g.lineTo(TOWER_X + dx, top + 10 + 46 * k + 10); g.fill();
    }
    glow(TOWER_X, top + 10, 30 + 30 * c, bc, 0.9); glow(TOWER_X, top + 10, 120 + 160 * c, bc, 0.16 + 0.2 * c * e);
    glow(TOWER_X, top - 40 - 30 * c, 8, [255, 60, 60], 0.5 + 0.5 * Math.sin(t * 2.4));
  });
  return top;
}
function houses(t, pal) {
  for (let i = 0; i < HOUSES.length; i++) {
    const h = HOUSES[i], y = 600 - h.h;
    const wall = mix(mix([24, 28, 52], [40, 38, 68], h.tone), pal.hor, 0.05 + 0.1 * clamp(C.val));
    g.fillStyle = col(wall); g.fillRect(h.x, y, h.w, h.h + 2);
    g.fillStyle = col(mix(wall, [6, 7, 16], 0.5)); g.beginPath(); g.moveTo(h.x - 5, y); g.lineTo(h.cx, y - h.roof); g.lineTo(h.x + h.w + 5, y); g.fill();
    g.fillRect(h.x + h.w * 0.68, y - h.roof * 0.75, 11, h.roof * 0.6);
    if (C.hope > 0.02) { g.fillStyle = col([255, 190, 130], C.hope * 0.5); g.fillRect(h.x + h.w - 2, y, 2, h.h); }
    for (const w of h.wins) {
      const on = w.lit ? 0.62 + 0.14 * Math.sin(t * 0.7 + w.p) : 0.05;
      g.fillStyle = col(mix([12, 14, 28], [255, 204, 128], on)); g.fillRect(w.x, w.y, 16, 22);
      if (w.lit) light(() => glow(w.x + 8, w.y + 11, 26, [255, 190, 110], 0.1));
    }
    // the door, its lock, and how far it has slid
    const open = clamp(C.security * 9 - DOOR_RANK[i] * 0.9), e = C.security_e, dx = h.cx - 16, dy = 546;
    g.fillStyle = '#070812'; g.fillRect(dx - 3, dy - 3, 38, 57);
    if (open > 0) { g.fillStyle = col([196, 232, 255], 0.55 + 0.45 * e); g.fillRect(dx, dy, 32 * open, 54); }
    g.fillStyle = col(mix([70, 50, 44], [44, 36, 44], h.tone)); g.fillRect(dx + 32 * open, dy, 32 * (1 - open), 54);
    const lx = dx + 32 * open + 5, ly = dy + 28;
    light(() => {
      if (open <= 0) glow(lx, ly, 7, [255, 200, 110], 0.8);
      else if (open < 0.97) {
        glow(lx, ly, 9, [255, 70, 60], 0.5 + 0.5 * Math.sin(t * 16 + i));
        g.strokeStyle = 'rgba(255,220,160,.9)'; g.lineWidth = 1.2;
        for (let s = 0; s < 5; s++) { const a = hash(Math.floor(t * 14) + s * 3 + i) * TAU, l = 6 + hash(s + Math.floor(t * 14)) * 14; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + Math.cos(a) * l, ly + Math.sin(a) * l); g.stroke(); }
      }
      if (open > 0) {
        const a = open * (0.2 + 0.5 * e);
        glow(dx + 16, dy + 30, 70 + 40 * open, [170, 220, 255], a * 0.6);
        const gr = g.createLinearGradient(0, 600, 0, 644); gr.addColorStop(0, col([190, 230, 255], a)); gr.addColorStop(1, col([190, 230, 255], a * 0.25));
        g.fillStyle = gr; g.beginPath(); g.moveTo(dx, 600); g.lineTo(dx + 32 * open, 600); g.lineTo(dx + 32 * open + 34, 644); g.lineTo(dx - 34, 644); g.fill();
      }
    });
  }
  // rooftop mill: the room's pace
  const m = HOUSES[1], mx = m.cx, my = 600 - m.h - m.roof - 26;
  g.strokeStyle = '#0a0c18'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, my + 30); g.lineTo(mx, my); g.stroke();
  g.lineWidth = 2.4; g.strokeStyle = col(mix([14, 16, 30], [150, 190, 230], 0.25 + 0.6 * C.pace * C.pace_e));
  for (let b = 0; b < 4; b++) { const a = millAng + b * PI / 2; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(a) * 24, my + Math.sin(a) * 24); g.stroke(); }
}
function tethers(t, top) {
  const c = C.control, e = C.control_e; if (c < 0.01) return;
  const order = HOUSES.map((h, i) => i).sort((a, b) => Math.abs(HOUSES[a].cx - TOWER_X) - Math.abs(HOUSES[b].cx - TOWER_X));
  light(() => order.forEach((hi, r) => {
    const k = clamp(c * 9 * 1.1 - r * 0.9); if (k <= 0) return;
    const h = HOUSES[hi], x1 = TOWER_X, y1 = top + 4, x2 = h.cx, y2 = 600 - h.h - h.roof, cx = (x1 + x2) / 2, cy = Math.max(y1, y2) + 46;
    const P = u => [(1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * cx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * cy + u * u * y2];
    g.strokeStyle = col([255, 80, 160], 0.22 + 0.45 * e); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x1, y1);
    for (let u = 0.05; u <= k + 0.001; u += 0.05) g.lineTo(...P(u)); g.stroke();
    for (let p = 0; p < 2; p++) { const u = (t * 0.22 + p * 0.5 + r * 0.13) % 1; if (u < k) { const [px, py] = P(u); glow(px, py, 7, [255, 130, 190], 0.9 * e); } }
    if (k > 0.98) glow(x2, y2, 14, [255, 80, 160], 0.5 * e);
  }));
}
function human(x, y, dir, ph, a) {
  if (a <= 0.01) return; g.globalAlpha = a; g.fillStyle = g.strokeStyle = '#06070f'; g.lineWidth = 3; g.lineCap = 'round';
  const s = Math.sin(ph) * 5;
  g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + s, y); g.moveTo(x, y - 14); g.lineTo(x - s, y); g.stroke();
  g.beginPath(); g.roundRect(x - 5, y - 31, 10, 19, 4); g.fill(); g.beginPath(); g.arc(x, y - 36, 4.6, 0, TAU); g.fill();
  g.globalAlpha = 1; light(() => { glow(x + dir * 8, y - 15, 13, [255, 196, 110], 0.85 * a); glow(x + dir * 8, y - 15, 3, [255, 240, 200], a); });
}
function robot(x, y, dir, ph, a) {
  if (a <= 0.01) return; g.globalAlpha = a; g.fillStyle = g.strokeStyle = '#06070f'; g.lineWidth = 3; g.lineCap = 'butt';
  const s = (Math.floor(ph / PI) % 2 ? 1 : -1) * 4;
  g.beginPath(); g.moveTo(x - 3, y - 13); g.lineTo(x - 3 + s, y); g.moveTo(x + 3, y - 13); g.lineTo(x + 3 - s, y); g.stroke();
  g.fillRect(x - 7, y - 32, 14, 20); g.fillRect(x - 5.5, y - 43, 11, 10); g.fillRect(x - 0.7, y - 50, 1.4, 7);
  g.globalAlpha = 1; light(() => { glow(x + dir * 2.5, y - 38, 9, [90, 230, 255], a); glow(x + dir * 2.5, y - 38, 2.5, [220, 250, 255], a); glow(x, y - 51, 4, [90, 230, 255], 0.7 * a); });
}
function quay(t, dt, pal) {
  g.fillStyle = col(mix([40, 44, 68], pal.hor, 0.12)); g.fillRect(-600, 600, 2800, 44);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(-600, 600, 2800, 1.5);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-600, 640, 2800, 5);
  const j = C.jobs, s = C.surveillance, se = C.surveillance_e;
  const pos = FIGS.map((f, i) => { const a = clamp(j * 10 - FIG_RANK[i] * 0.9); const sp = lerp(f.sp * (1 + C.wind * 0.8), 27, a); f.x += f.dir * sp * dt; f.ph += sp * dt * 0.33; if (f.x > 1420) f.dir = -1; if (f.x < 190) f.dir = 1; return a; });
  // lamps, and the eyes they can become
  LAMPS.forEach((lx, i) => {
    const k = clamp(s * 5 * 1.15 - i * 0.85);
    let best = lx, bd = 1e9; FIGS.forEach((f, fi) => { const d = Math.abs(f.x - lx) + pos[fi] * 400; if (d < bd) { bd = d; best = f.x; } });
    lampAim[i] += (clamp(best, lx - 190, lx + 190) - lampAim[i]) * Math.min(1, dt * 3);
    g.strokeStyle = '#080a14'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx, 604); g.lineTo(lx, 540); g.stroke(); g.fillStyle = '#080a14'; g.fillRect(lx - 8, 532, 16, 9);
    light(() => {
      glow(lx, 542, 46, [255, 200, 120], 0.42 * (1 - k)); glow(lx, 606, 60, [255, 200, 120], 0.1 * (1 - k));
      if (k > 0) {
        const tx = lampAim[i], gr = g.createLinearGradient(0, 540, 0, 644); gr.addColorStop(0, col([255, 90, 80], k * (0.3 + 0.4 * se))); gr.addColorStop(1, col([255, 120, 100], k * 0.1));
        g.fillStyle = gr; g.beginPath(); g.moveTo(lx - 3, 541); g.lineTo(lx + 3, 541); g.lineTo(tx + 26, 644); g.lineTo(tx - 26, 644); g.fill();
        glow(lx, 538, 22, [255, 80, 70], 0.6 * k);
      }
    });
    if (k > 0.05) { const look = clamp((lampAim[i] - lx) / 190, -1, 1) * 4; g.globalAlpha = k; g.fillStyle = '#f6efe6'; g.beginPath(); g.ellipse(lx, 537, 10, 6.5, 0, 0, TAU); g.fill(); g.fillStyle = '#b01818'; g.beginPath(); g.arc(lx + look, 538, 3.8, 0, TAU); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(lx + look, 538, 1.7, 0, TAU); g.fill(); g.globalAlpha = 1; }
  });
  FIGS.forEach((f, i) => {
    const a = pos[i];
    // the displaced person sits at the water's edge, lantern set down
    if (a > 0.01) { const x = f.seat; g.globalAlpha = a; g.fillStyle = g.strokeStyle = '#06070f'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.roundRect(x - 5, 622, 10, 17, 4); g.fill(); g.beginPath(); g.arc(x + 3, 618, 4.6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x - 2, 638); g.lineTo(x - 1, 652); g.moveTo(x + 3, 638); g.lineTo(x + 5, 652); g.stroke(); g.globalAlpha = 1; light(() => glow(x - 13, 637, 8, [255, 196, 110], 0.4 * a)); }
    human(f.x, 637, f.dir, f.ph, 1 - a); robot(f.x, 637, f.dir, f.ph, a);
  });
}
function river(t, pal) {
  const gr = g.createLinearGradient(0, 644, 0, 900);
  gr.addColorStop(0, col(mix(pal.hor, [10, 14, 34], 0.55))); gr.addColorStop(0.5, col(mix(pal.mid, [6, 9, 24], 0.6))); gr.addColorStop(1, col([4, 6, 16]));
  g.fillStyle = gr; g.fillRect(-600, 644, 2800, 900);
  const streak = (x, c, a, w = 16, len = 150) => { for (let i = 0; i < 12; i++) { const y = 652 + i * (len / 12), k = 1 - i / 12; glow(x + Math.sin(t * 1.6 + i * 1.3 + x) * (3 + i), y, w * (0.6 + i * 0.12), c, a * k); } };
  light(() => {
    streak(MOON[0], [238, 236, 220], 0.16, 20, 200);
    const n = C.misinfo * FAKES.length * 1.15; FAKES.forEach(([x], i) => { const a = clamp(n - i * 0.9); if (a > 0) streak(x, [230, 236, 226], 0.12 * a, 18, 170); });
    HOUSES.forEach((h, i) => { const o = clamp(C.security * 9 - DOOR_RANK[i] * 0.9); if (o > 0) streak(h.cx, [180, 226, 255], o * (0.14 + 0.3 * C.security_e), 16 + 10 * o, 150); });
    LAMPS.forEach((lx, i) => { const k = clamp(C.surveillance * 5.75 - i * 0.85); streak(lx, mix([255, 200, 120], [255, 80, 70], k), 0.1 + 0.12 * k * C.surveillance_e, 10, 90); });
    if (C.hope > 0.01) streak(1270, [255, 190, 120], C.hope * 0.4, 46, 240);
    // shimmer; drafts tint and quicken it
    const tint = mix([200, 215, 255], C.dval > 0 ? [255, 210, 150] : [150, 170, 255], clamp(Math.abs(C.dval) * Math.min(1, C.typing)));
    g.lineWidth = 1.2;
    for (let i = 0; i < 70; i++) { const y = 656 + hash(i) * 240, x = ((hash(i + 40) * 2200 + flow * (10 + hash(i + 80) * 20)) % 2200) - 300, len = 20 + hash(i + 7) * 50; g.strokeStyle = col(tint, (0.05 + 0.05 * Math.min(4, C.typing)) * (0.5 + 0.5 * Math.sin(t * 1.4 + i))); g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); }
    for (const r of ripples) { const k = r.age / r.life; g.strokeStyle = col(r.c, (1 - k) * r.a); g.lineWidth = 1.6; g.beginPath(); g.ellipse(r.x, r.y, 8 + k * r.r, (8 + k * r.r) * 0.28, 0, 0, TAU); g.stroke(); }
    streams(t);
  });
}
function streams(t) {
  const u = C.understanding, e = C.understanding_e; if (u < 0.01) return;
  const reach = clamp(u * 1.8), m = clamp((u - 0.5) / 0.4), Y = 765, mid = 800;
  const braid = x => 1 - 0.7 * clamp(1 - Math.abs(x - mid) / 260) * m;
  const yL = x => Y + Math.sin(x * 0.012 - t * 1.3) * 16 * braid(x), yR = x => Y - Math.sin(x * 0.012 - t * 1.3) * 16 * braid(x);
  const ribbon = (from, to, fy, c) => {
    for (const [w, a] of [[16, 0.07], [7, 0.2], [2.2, 0.75]]) { g.strokeStyle = col(c, a * (0.5 + 0.5 * e)); g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); const st = from < to ? 12 : -12; for (let x = from; from < to ? x <= to : x >= to; x += st) x === from ? g.moveTo(x, fy(x)) : g.lineTo(x, fy(x)); g.stroke(); }
    glow(to, fy(to), 26, c, 0.8 * (0.5 + 0.5 * e));
    for (let i = 0; i < 9; i++) { const k = (t * 0.16 + i / 9) % 1, x = lerp(from, to, k); glow(x, fy(x), 6, [255, 255, 255], 0.6 * e); }
  };
  // past the meeting point each stream continues into the other's water
  const over = m * 260;
  ribbon(-320, lerp(-60, mid, reach) + over, yL, [255, 200, 110]);
  ribbon(1920, lerp(1660, mid, reach) - over, yR, [110, 220, 255]);
  if (m > 0) { glow(mid, Y, 70 + 170 * m, [255, 255, 240], m * (0.3 + 0.4 * e)); for (let i = 1; i < 8; i++) glow(mid, Y - i * 62, 90 + 30 * m - i * 6, [255, 250, 230], m * 0.13 * e * (1 - i / 8)); }
}
function lanterns(t) {
  const c = C.creativity, e = C.creativity_e, n = c * LANTERNS.length * 1.15;
  const HUES = [[255, 150, 70], [255, 196, 90], [255, 110, 130], [130, 220, 210], [200, 150, 255]];
  LANTERNS.forEach((l, i) => {
    const a0 = clamp(n - i * 0.9); if (a0 <= 0) return;
    const k = (t / l.per + l.ph) % 1, y = 470 - k * 560, x = l.x + Math.sin(t * 0.5 + l.sw) * 16 + k * (40 + 320 * C.wind), a = a0 * clamp(k * 8) * clamp((1 - k) * 4), hc = HUES[Math.floor(l.hue * HUES.length)];
    light(() => glow(x, y, 26, hc, 0.4 * a * (0.5 + 0.5 * e)));
    g.globalAlpha = a; g.fillStyle = col(mix(hc, [255, 255, 230], 0.35)); g.beginPath(); g.roundRect(x - 5, y - 7, 10, 14, 3); g.fill(); g.fillStyle = 'rgba(40,20,20,.7)'; g.fillRect(x - 4, y + 7, 8, 2); g.globalAlpha = 1;
  });
}
function presence(t) {
  const d = C.dread; if (d < 0.01) return;
  const e = C.dread_e, a = (0.5 + 0.45 * e) * clamp(d * 3.2), br = 1 + Math.sin(t * 0.7) * 0.035;
  const hx = 44 + 190 * d + Math.sin(t * 0.23) * 8, hy = 560 - 360 * d;
  dark(-120, 780, 330 + 280 * d, 440, a);
  dark(hx - 40, hy + 170 + 50 * d, (140 + 120 * d) * br, 200 + 110 * d, a);
  dark(hx, hy, (58 + 60 * d) * br, (72 + 74 * d) * br, a);
  for (let i = 0; i < 6; i++) dark(40 + i * (70 + 130 * d) + Math.sin(t * 0.3 + i * 1.7) * 24, 630 + (i % 2) * 10, 130 + 90 * d, 24 + 8 * d, a * 0.55 * (1 - i / 6));
  const blink = (t % 6.3) < 0.14 ? 0 : 1, ea = 0.75 * clamp((d - 0.1) * 5) * blink * (0.6 + 0.4 * e), sp = 13 + 13 * d;
  light(() => { for (const s of [-1, 1]) { glow(hx + s * sp + 6, hy - 6, 9, [190, 205, 255], ea * 0.6); glow(hx + s * sp + 6, hy - 6, 3, [235, 240, 255], ea); } });
}
function messengers(dt) {
  light(() => {
    for (const f of flies) {
      f.age += dt; const k = clamp(f.age / f.dur), s = k * k * (3 - 2 * k), iu = 1 - s;
      const x = iu * iu * f.x0 + 2 * iu * s * f.cx + s * s * f.x1, y = iu * iu * f.y0 + 2 * iu * s * f.cy + s * s * f.y1;
      f.trail.push([x, y]); if (f.trail.length > 16) f.trail.shift();
      f.trail.forEach(([tx, ty], i) => glow(tx, ty, (3 + f.size * 2) * (i / 16 + 0.3), f.c, 0.35 * i / 16));
      glow(x, y, 16 + 6 * f.size, f.c, 0.9); glow(x, y, 4, [255, 255, 255], 1);
      if (k >= 1 && !f.done) { f.done = true; bursts.push({ x: f.x1, y: f.y1, c: f.c, age: 0, size: f.size }); }
    }
    for (const b of bursts) { b.age += dt; const k = b.age / 1.6; g.strokeStyle = col(b.c, (1 - k) * 0.8); g.lineWidth = 2; g.beginPath(); g.arc(b.x, b.y, 10 + k * (70 + 30 * b.size), 0, TAU); g.stroke(); glow(b.x, b.y, 90 + 40 * b.size, b.c, 0.45 * (1 - k)); }
  });
  for (let i = flies.length - 1; i >= 0; i--) if (flies[i].done) flies.splice(i, 1);
  for (let i = bursts.length - 1; i >= 0; i--) if (bursts[i].age > 1.6) bursts.splice(i, 1);
}

// ---------- frame ----------
let sc = 1, ox = 0, oy = 0, prevT = performance.now(), fps = 60;
function resize() { const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; sc = Math.min(cv.width / 1600, cv.height / 900); ox = (cv.width - 1600 * sc) / 2; oy = (cv.height - 900 * sc) / 2; }
addEventListener('resize', resize); resize();

function frame(now) {
  const dt = Math.min(0.1, (now - prevT) / 1000), t = now / 1000; prevT = now; fps = lerp(fps, 1 / Math.max(dt, 0.001), 0.05);
  for (const k in T) C[k] += (T[k] - C[k]) * (1 - Math.exp(-dt / TAU_OF(k)));
  cloudOff += dt * (7 + C.wind * 120); millAng += dt * (0.35 + C.wind * 7 + C.pace * 3); flow += dt * (1 + C.wind * 3 + Math.min(4, C.typing) * 0.8);
  if (C.typing > 0.05 && Math.random() < dt * Math.min(6, C.typing) * 1.4) ripples.push({ x: 150 + Math.random() * 1300, y: 690 + Math.random() * 180, r: 46, life: 1.8, age: 0, a: 0.45, c: C.dval > 0.15 ? [255, 214, 160] : C.dval < -0.15 ? [160, 180, 255] : [220, 228, 255] });
  for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].age += dt; if (ripples[i].age > ripples[i].life) ripples.splice(i, 1); }

  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05060f'; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(sc, 0, 0, sc, ox, oy);
  const pal = sky(); stars(t); moons(t); dawn(); clouds(pal); birds(t); hills(pal, t);
  const top = tower(t); houses(t, pal); tethers(t, top); quay(t, dt, pal); river(t, pal); lanterns(t); presence(t);
  // the whole frame leans darker with tension, then a vignette
  g.fillStyle = `rgba(4,5,12,${0.22 * C.tension})`; g.fillRect(-600, -700, 2800, 2400);
  const vg = g.createRadialGradient(800, 470, 420, 800, 470, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.5 + 0.25 * C.tension})`); g.fillStyle = vg; g.fillRect(-600, -700, 2800, 2400);
  messengers(dt);

  continuity(now);
  if (lastV !== ackV) { ackV = lastV; fetch('/api/ack', { method: 'POST', body: JSON.stringify({ v: ackV, display: { fps: Math.round(fps), maxStep: +maxStep.toFixed(4), meanStep: +(sumStep / Math.max(1, nStep)).toFixed(4) } }) }).catch(() => {}); }
  requestAnimationFrame(frame);
}

// ---------- continuity meter ----------
// Every 250 ms, shrink the frame to 64x36 and measure mean absolute luminance change
// (0..1) since the previous sample. A hard cut between unrelated stills scores > 0.15;
// this scene should stay an order of magnitude under that even during a burst.
const small = document.createElement('canvas'); small.width = 64; small.height = 36; const sg = small.getContext('2d', { willReadFrequently: true });
let prevLum = null, lastSample = 0, maxStep = 0, sumStep = 0, nStep = 0, stepNow = 0, stalls = 0;
function continuity(now) {
  if (now - lastSample < 250) return;
  if (now - lastSample > 450) { prevLum = null; stalls++; }   // tab was throttled or hidden: not a fair sample
  lastSample = now;
  sg.drawImage(cv, 0, 0, 64, 36); const d = sg.getImageData(0, 0, 64, 36).data, lum = new Float32Array(64 * 36);
  let diff = 0; for (let i = 0; i < lum.length; i++) { lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255; if (prevLum) diff += Math.abs(lum[i] - prevLum[i]); }
  if (prevLum) { stepNow = diff / lum.length; maxStep = Math.max(maxStep, stepNow); sumStep += stepNow; nStep++; }
  prevLum = lum;
  if (document.body.classList.contains('debug')) dbg.textContent = `fps ${fps.toFixed(0)}   state v${lastV}\nframe change /250ms  now ${stepNow.toFixed(4)}  mean ${(sumStep / Math.max(1, nStep)).toFixed(4)}  max ${maxStep.toFixed(4)}\n(a hard cut would read > 0.15)\n` + IDS.filter(i => C[i] > 0.01).map(i => `${i.padEnd(13)} depth ${C[i].toFixed(2)}  light ${C[i + '_e'].toFixed(2)}`).join('\n') + `\nmood ${C.val.toFixed(2)}  tension ${C.tension.toFixed(2)}  wind ${C.wind.toFixed(2)}  typing ${C.typing.toFixed(1)}`;
}
window.sceneDiag = () => ({ fps: Math.round(fps), maxStep, meanStep: sumStep / Math.max(1, nStep), samples: nStep, stalls, C: { ...C }, v: lastV });
window.resetDiag = () => { maxStep = 0; sumStep = 0; nStep = 0; stalls = 0; };

// ---------- wiring ----------
const dbg = document.getElementById('dbg'), feedEl = document.getElementById('feed');
const WARM = [255, 200, 110], COLD = [140, 160, 255], PALE = [225, 232, 255];
function launch(ev) {
  let to = ANCHOR[ev.c];
  if (ev.c === 'star') { const s = EXTRA[Math.min(EXTRA.length - 1, Math.round(T.stars) - 1)] || EXTRA[0]; to = [s.x, s.y]; }
  if (!to) return;
  const x0 = 350 + Math.random() * 900;
  flies.push({ x0, y0: 915, x1: to[0], y1: to[1], cx: lerp(x0, to[0], 0.3) + (Math.random() - 0.5) * 300, cy: Math.min(to[1], 600) - 60 - Math.random() * 120, age: -Math.random() * 0.25, dur: 1.7, c: ev.v > 0 ? WARM : ev.v < 0 ? COLD : PALE, size: Math.min(3, Math.log2(1 + ev.n)), trail: [] });
}
const es = new EventSource('/events');
es.addEventListener('state', m => {
  const s = JSON.parse(m.data); Object.assign(T, s.t); lastV = s.v;      // latest target simply replaces the previous one
  for (const ev of s.ev) launch(ev);
  const have = new Set([...feedEl.children].map(c => +c.dataset.id)), want = new Set(s.feed.map(f => f.id));
  for (const c of [...feedEl.children]) if (!want.has(+c.dataset.id)) c.remove();
  for (const f of s.feed.slice().reverse()) if (!have.has(f.id)) { const d = document.createElement('div'); d.dataset.id = f.id; d.textContent = f.text; d.title = 'Click to remove from feed'; d.onclick = () => fetch('/api/hide', { method: 'POST', body: JSON.stringify({ id: f.id }) }); feedEl.prepend(d); }
});
es.addEventListener('accept', () => { if (ripples.length < 40) ripples.push({ x: 560 + Math.random() * 480, y: 840 + Math.random() * 40, r: 120, life: 1.6, age: 0, a: 0.9, c: [235, 240, 255] }); });

fetch('/api/config').then(r => r.json()).then(c => {
  document.getElementById('q').textContent = c.question; document.getElementById('url').textContent = c.joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const qr = document.getElementById('qr'); qr.onerror = () => qr.remove(); qr.src = '/qr.svg';
});
const EXAMPLES = [
  'Honestly I just have a bad feeling about where this ends up',
  'I worry hackers will use it to break into everything, but I hope it helps people understand each other',
  'Cybersecurity. Every lock we rely on is going to fail',
  'Excited about curing diseases, though my kids may never find jobs',
];
const submit = text => fetch('/api/submit', { method: 'POST', body: JSON.stringify({ text, cid: 'demo' + Math.random() }) });

// ---------- guess mode: does a viewer understand a change with no caption? ----------
// G starts a round: the feed is hidden, one unseen answer goes into the scene, and after
// the transition the viewer picks which of four sentences just arrived (A-D or click).
// Chance is 25%. Results accumulate per treatment so weak imagery shows up by name.
const GUESS = [['dread', 'I just have a sinking feeling about all of it'], ['security', 'Hackers will get into everything'],
  ['understanding', 'It could help people finally understand each other'], ['jobs', 'Machines will take our jobs'],
  ['surveillance', 'We will be watched everywhere we go'], ['misinfo', 'Nobody will know what is real anymore'],
  ['growth', 'It might cure diseases'], ['discovery', 'Science will leap forward'], ['control', 'A few companies will control everything'],
  ['creativity', 'Anyone will be able to make art and music'], ['hope', 'Life will simply get better for everyone'],
  ['pace', 'It is all moving too fast'], ['environment', 'It burns too much energy and water']];
const guessEl = document.getElementById('guess'), WATCH_MS = 8000;
const gs = { phase: 'idle', truth: null, opts: [], log: [], hadFeed: true };
try { gs.log = JSON.parse(localStorage.getItem('guessLog') || '[]'); } catch {}
const shuffle = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
const tally = () => `${gs.log.filter(r => r.ok).length} of ${gs.log.length} correct`;
function guessRound() {
  if (gs.phase === 'watch' || gs.phase === 'choose') return;
  if (gs.phase === 'idle') { gs.hadFeed = !document.body.classList.contains('bare'); document.body.classList.add('bare'); }
  const seen = id => gs.log.filter(r => r.c === id).length;                 // least-tested treatments first
  const least = Math.min(...GUESS.map(([id]) => seen(id)));
  gs.truth = shuffle(GUESS.filter(([id]) => seen(id) === least && id !== gs.truth?.[0]))[0] || shuffle(GUESS)[0];
  gs.opts = shuffle([gs.truth, ...shuffle(GUESS.filter(x => x !== gs.truth)).slice(0, 3)]);
  gs.phase = 'watch'; guessEl.innerHTML = '<span style="opacity:.6">Watch the scene…</span>';
  fetch('/api/submit', { method: 'POST', body: JSON.stringify({ text: gs.truth[1], cid: 'guess' + Math.random(), quiet: true }) });
  setTimeout(() => {
    gs.phase = 'choose'; guessEl.innerHTML = 'Which answer just arrived?<div class="opts"></div>';
    gs.opts.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = `<b>${'ABCD'[i]}</b>`; b.append(o[1]); b.onclick = () => guessPick(i); guessEl.lastChild.append(b); });
  }, WATCH_MS);
}
function guessPick(i) {
  if (gs.phase !== 'choose' || !gs.opts[i]) return;
  const ok = gs.opts[i] === gs.truth; gs.log.push({ c: gs.truth[0], picked: gs.opts[i][0], ok });
  try { localStorage.setItem('guessLog', JSON.stringify(gs.log)); } catch {}
  gs.phase = 'result'; guessEl.innerHTML = '<div class="panel"></div>';
  guessEl.firstChild.textContent = `${ok ? 'Correct.' : 'It was: “' + gs.truth[1] + '”'}   ${tally()}.   G next · Esc finish`;
}
function guessEnd() {
  if (gs.phase === 'idle') return;
  gs.phase = 'idle'; if (gs.hadFeed) document.body.classList.remove('bare');
  if (!gs.log.length) { guessEl.innerHTML = ''; return; }
  const rows = GUESS.map(([id]) => { const r = gs.log.filter(x => x.c === id); if (!r.length) return ''; const wrong = r.filter(x => !x.ok).map(x => x.picked); return `<tr><td>${id}</td><td>${r.filter(x => x.ok).length} / ${r.length}</td><td style="opacity:.6">${wrong.length ? 'mistaken for ' + [...new Set(wrong)].join(', ') : ''}</td></tr>`; }).join('');
  guessEl.innerHTML = `<div class="panel">${tally()} (chance is 25%)<table>${rows}</table><div style="opacity:.6;margin-top:1vh">Esc close · X clear results</div></div>`;
}
window.guessLog = () => gs.log;

addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (gs.phase === 'choose') { guessPick('abcd'.indexOf(k)); return; }
  if (gs.phase === 'watch') return;
  if (k === 'g') return guessRound();
  if (k === 'escape') { if (gs.phase === 'idle') guessEl.innerHTML = ''; else guessEnd(); return; }
  if (k === 'x' && gs.phase === 'idle' && guessEl.innerHTML) { gs.log = []; try { localStorage.removeItem('guessLog'); } catch {} guessEl.innerHTML = ''; return; }
  if (k === 'f') document.body.classList.toggle('nofeed');
  if (k === 'h') document.body.classList.toggle('bare');
  if (k === 'd') document.body.classList.toggle('debug');
  if (k === 'r') fetch('/api/reset', { method: 'POST' }).then(() => { feedEl.innerHTML = ''; });
  if (EXAMPLES[+k - 1]) submit(EXAMPLES[+k - 1]);
});
const qs = new URLSearchParams(location.search);
if (qs.has('bare')) document.body.classList.add('bare');
if (qs.has('nofeed')) document.body.classList.add('nofeed');
if (qs.has('debug')) document.body.classList.add('debug');
requestAnimationFrame(frame);
