// Scene elements written as code, in exactly the shape the live director (Claude) returns:
//   { id, layer, desc, params, code }   where code is the body of  function (k, p, t, m) { ... }
// These were written by Claude in a coding session and recorded, so the comic display works
// with no API key. With a key, src/director.js asks Claude for new elements in this format.
//
// Layout facts every element relies on (canvas is 1600 x 900):
//   quay top y=602, water from y=646; houses i=0..6 at x=186+166*i, 150 wide, heights H[i];
//   doors at x=245+166*i (32 wide, y 546-602); lamps at x=270+332*j (head y=522);
//   lighthouse at x=1012 (lamp y~300); tree hill peaks near (1450,500); moon at (430,165).

import { el, BASE } from './comic-base.js';
export { BASE };

// ---------- elements the room can summon ----------
// Recorded stand-ins for what the live director writes. Each is added the first time its idea
// appears; after that only its numbers change (from(level 0..1, emphasis 0..1)).
export const REACT = {
  dread: { from: (L, e) => ({ size: L, glare: e }), ...el('presence', 8, 'General dread: a vast ink-black figure leaning in from the left edge, white eyes with red pupils, a halftone fringe creeping along the quay. size 0..1.', {}, function (k, p, t, m) {
    var s = p.size, br = 1 + Math.sin(t * 0.8) * 0.03, hx = 40 + 210 * s, hy = 560 - 380 * s, w = (90 + 150 * s) * br;
    k.shape([[-520, 960], [-520, hy + 200], [hx - w * 1.5, hy + 60], [hx - w * 0.7, hy - w * 0.55], [hx, hy - w * 0.75], [hx + w * 0.7, hy - w * 0.45], [hx + w * 0.95, hy + w * 0.5], [hx + w * 1.5, hy + 220 + 80 * s], [hx + w * 2.2 + 200 * s, 652], [hx + w * 3 + 420 * s, 664], [hx + w * 1.2, 720], [hx + w * 0.6, 960]], '#0c0a18', { lw: 6, curve: true });
    k.dots([[hx + w * 0.4, hy - w * 0.7], [hx + w * 2.4, hy + 200], [hx + w * 3.4 + 420 * s, 700], [hx + w, 740]], '#0c0a18', 5, 13, { fade: 'up' });
    var blink = (t % 5.7) < 0.15 ? 0.15 : 1, ey = hy - 4, rx = 9 + 10 * s, ry = (6 + 7 * s) * blink;
    k.blob(hx - w * 0.26, ey, rx, ry, '#fbf6e9', { lw: 3 }); k.blob(hx + w * 0.3, ey, rx, ry, '#fbf6e9', { lw: 3 });
    k.blob(hx - w * 0.26 + 3, ey, 3 + 2 * s, (3 + 2 * s) * blink, '#d8372f', { lw: 0 }); k.blob(hx + w * 0.3 + 3, ey, 3 + 2 * s, (3 + 2 * s) * blink, '#d8372f', { lw: 0 });
  }) },
  security: { from: (L, e) => ({ open: L * 7, light: e }), ...el('doors', 4.5, 'Failing locks: doors slide open one after another (open = how many, fractional), cold light spills across the quay and into the water, a red burst where each lock is breaking.', {}, function (k, p, t, m) {
    var RANK = [3, 1, 5, 2, 4, 0, 6];
    for (var r = 0; r < 7; r++) {
      var a = k.clamp(p.open - r, 0, 1); if (a <= 0) continue;
      var i = RANK[r], x = 245 + i * 166, spill = [[x, 602], [x + 32 * a, 602], [x + 32 * a + 46, 646], [x - 46, 646]];
      k.shape(spill, '#bfe9f2', { lw: 0, a: 0.8 }); k.dots(spill, '#fbf6e9', 3, 9);
      k.rect(x, 546, 32 * a, 56, '#eafcff', { lw: 4 });
      for (var j = 0; j < 5; j++) { var o = Math.sin(t * 3 + j + i) * 5; k.line([[x - 6 + j * 3 + o, 662 + j * 16], [x + 38 - j * 3 + o, 662 + j * 16]], 4, '#bfe9f2'); }
      if (a < 0.97) { k.burst(x + 32 * a + 6, 576, 18 + Math.sin(t * 20) * 4, 7, 8, '#d8372f', { lw: 3 }); k.burst(x + 32 * a + 6, 576, 8, 3, 8, '#f6c544', { lw: 0 }); }
      else k.rect(x + 40, 594, 9, 7, '#f6c544', { lw: 2 });
    }
  }) },
  understanding: { from: (L, e) => ({ reach: Math.min(1, L * 1.8), join: Math.max(0, Math.min(1, (L - 0.5) / 0.4)) }), ...el('streams', 6.5, 'People understanding each other: a gold ribbon from the left and an aqua ribbon from the right travel the water (reach 0..1) and fuse in a white starburst at the centre (join 0..1).', {}, function (k, p, t, m) {
    var Y = 770, mid = 800, j = p.join;
    function yAt(x, ph) { return Y + Math.sin(x * 0.012 - t * 1.4 + ph) * 16 * (1 - 0.6 * j * k.clamp(1 - Math.abs(x - mid) / 250, 0, 1)); }
    function band(from, to, col, ph) {
      var up = [], dn = [], st = (to - from) / 28;
      for (var n = 0; n <= 28; n++) { var x = from + st * n, y = yAt(x, ph); up.push([x, y - 9]); dn.unshift([x, y + 9]); }
      k.shape(up.concat(dn), col, { lw: 4 });
      k.line(up.map(function (q) { return [q[0], q[1] + 6]; }), 2, '#fbf6e9');
      k.burst(to, yAt(to, ph), 20, 8, 6, '#fbf6e9', { lw: 3 });
    }
    band(-500, 160 + (mid - 160) * p.reach + 220 * j, '#f6c544', 0);
    band(2100, 1440 - (1440 - mid) * p.reach - 220 * j, '#57c7c2', 3.14);
    if (j > 0.02) { k.glow(mid, Y, 90 + 150 * j, '#fbf6e9', 0.7 * j); k.burst(mid, Y, (40 + 70 * j) * (1 + Math.sin(t * 3) * 0.08), 16 + 20 * j, 12, '#fbf6e9', { lw: 4 }); }
  }) },
  jobs: { from: (L, e) => ({ count: L * 6 }), ...el('robots', 5.6, 'Work being automated: grey box-headed robots with red visors march the quay in step (count), and for each one a person in grey sits on the quay edge, legs over the water.', {}, function (k, p, t, m) {
    for (var j = 0; j < 6; j++) {
      var a = k.clamp(p.count - j, 0, 1); if (a <= 0) continue;
      var i = 5 - j, x = 200 + ((k.rand(i + 4) * 1200 + t * 22 * (i % 2 ? 1 : -1)) % 1200 + 1200) % 1200, y = 642, s = Math.floor(t * 4 + i) % 2 ? 6 : -6, sx = 230 + i * 200;
      k.alpha(a, function () {
        k.blob(x, y + 2, 16, 4, '#15111c', { lw: 0, a: 0.45 });
        k.line([[x - 6, y - 22], [x - 6 + s, y]], 5, '#15111c'); k.line([[x + 6, y - 22], [x + 6 - s, y]], 5, '#15111c');
        k.rect(x - 13, y - 58, 26, 37, '#9aa3b5', { lw: 3.5 }); k.rect(x - 7, y - 50, 14, 10, '#15111c', { lw: 0 });
        k.rect(x - 10, y - 79, 20, 19, '#c9d0dc', { lw: 3.5 }); k.rect(x - 6, y - 73, 12, 5, '#d8372f', { lw: 1.5 });
        k.line([[x, y - 79], [x, y - 90]], 2.5, '#15111c'); k.blob(x, y - 93, 3.5, 3.5, '#d8372f', { lw: 1.5 });
        k.shape([[sx - 10, 616], [sx + 10, 616], [sx + 11, 646], [sx - 11, 646]], '#6f6a80', { lw: 3.5 }); k.blob(sx + 5, 607, 9, 9, '#f3c9a5', { lw: 3 });
        k.line([[sx - 3, 646], [sx - 2, 668]], 5, '#15111c'); k.line([[sx + 5, 646], [sx + 8, 668]], 5, '#15111c');
      });
    }
  }) },
  growth: { from: (L, e) => ({ size: L }), ...el('tree', 2.5, 'Cures and health: a tree on the right-hand hill branches out (size 0..1), then blossoms pink and white, with flowers spreading over the hill.', {}, function (k, p, t, m) {
    var s = p.size, D = 1.5 + s * 5, tips = [];
    function br(x, y, a, len, d, id) {
      var q = k.clamp(D - d, 0, 1); if (q <= 0) return;
      var a2 = a + Math.sin(t * 0.9 + id) * 0.015 * (d + 1), x2 = x + Math.cos(a2) * len * q, y2 = y + Math.sin(a2) * len * q;
      k.line([[x, y], [x2, y2]], Math.max(2, (7 - d) * (0.8 + s)), '#15111c', { still: true });
      if (d >= 3) tips.push([x2, y2, q, id]);
      if (d < 6) { br(x2, y2, a2 - 0.32 - k.rand(id) * 0.3, len * 0.76, d + 1, id * 2); br(x2, y2, a2 + 0.28 + k.rand(id + 0.5) * 0.32, len * 0.74, d + 1, id * 2 + 1); }
    }
    br(1446, 504, -1.6, 30 + 70 * s, 0, 1);
    var b = k.clamp((s - 0.1) * 2.2, 0, 1);
    for (var i = 0; i < tips.length; i++) { var q = tips[i]; k.blob(q[0], q[1], (5 + 9 * b) * q[2], (5 + 8 * b) * q[2], k.rand(q[3]) > 0.4 ? '#ee6f9a' : '#fbf6e9', { lw: 2 }); }
    for (var f = 0; f < 30; f++) { if (f > s * 40) break; k.burst(1300 + k.rand(f) * 280, 556 + k.rand(f + 50) * 44, 6, 2.5, 5, f % 2 ? '#f6c544' : '#ee6f9a', { lw: 1.5 }); }
  }) },
  misinfo: { from: (L, e) => ({ count: L * 5 }), ...el('fakemoons', 1.5, 'Not knowing what is real: counterfeit moons appear (count), each printed off-register with red and cyan plates slipping apart.', {}, function (k, p, t, m) {
    var P = [[690, 100], [240, 260], [900, 300], [120, 90], [1200, 90]], C = ['#bfe7c0', '#f2b8c8', '#c9d6f5', '#f6e3a0', '#d8c8f0'];
    for (var i = 0; i < 5; i++) {
      var a = k.clamp(p.count - i, 0, 1); if (a <= 0) continue;
      var x = P[i][0], y = P[i][1], r = 44 * a, slip = Math.floor(t * 3 + i) % 5 == 0 ? 11 : 5;
      k.blob(x + slip, y + 3, r, r, '#d8372f', { lw: 0, a: 0.7 }); k.blob(x - slip, y - 2, r, r, '#57c7c2', { lw: 0, a: 0.7 });
      k.blob(x, y, r, r, C[i], { lw: 5 }); k.blob(x - r * 0.25, y - r * 0.2, r * 0.2, r * 0.18, '#15111c', { lw: 0, a: 0.25 });
    }
  }) },
  surveillance: { from: (L, e) => ({ count: L * 4 }), ...el('eyes', 5.2, 'Being watched: the street lamps open into eyes (count) and sweep red dotted cones along the quay.', {}, function (k, p, t, m) {
    for (var j = 0; j < 4; j++) {
      var a = k.clamp(p.count - j, 0, 1); if (a <= 0) continue;
      var lx = 270 + j * 332, tx = lx + Math.sin(t * 0.7 + j * 2) * 150, cone = [[lx - 5, 530], [lx + 5, 530], [tx + 34, 646], [tx - 34, 646]];
      k.shape(cone, '#d8372f', { lw: 0, a: 0.35 * a }); k.dots(cone, '#d8372f', 2.5, 8, { a: a });
      k.shape([[lx - 24 * a, 522], [lx, 522 - 14 * a], [lx + 24 * a, 522], [lx, 522 + 14 * a]], '#fbf6e9', { lw: 4, curve: true });
      var px = lx + (tx - lx) * 0.06; k.blob(px, 522, 7 * a, 7 * a, '#d8372f', { lw: 3 }); k.blob(px, 522, 3 * a, 3 * a, '#15111c', { lw: 0 });
    }
  }) },
  creativity: { from: (L, e) => ({ count: L * 14 }), ...el('lanterns', 7, 'Making art and music: paper lanterns in five colours lift off the rooftops and drift up (count).', {}, function (k, p, t, m) {
    var C = ['#ef7d2d', '#f6c544', '#ee6f9a', '#57c7c2', '#d8372f'];
    for (var i = 0; i < 14; i++) {
      var a = k.clamp(p.count - i, 0, 1); if (a <= 0) continue;
      var q = (t / (26 + k.rand(i) * 20) + k.rand(i + 9)) % 1, x = 220 + k.rand(i + 3) * 1100 + Math.sin(t * 0.6 + i) * 18 + q * (60 + 200 * m.wind), y = 470 - q * 520, f = a * k.clamp(q * 8, 0, 1) * k.clamp((1 - q) * 5, 0, 1), c = C[i % 5];
      k.alpha(f, function () { k.glow(x, y, 34, c, 0.5); k.shape([[x - 9, y - 12], [x + 9, y - 12], [x + 7, y + 11], [x - 7, y + 11]], c, { lw: 3 }); k.rect(x - 5, y + 11, 10, 4, '#15111c', { lw: 0 }); k.line([[x, y - 12], [x, y + 11]], 1.5, '#15111c'); });
    }
  }) },
  hope: { from: (L, e) => ({ rise: L }), ...el('dawn', 0.5, 'General hope: a comic sunburst rises behind the right-hand hill (rise 0..1), striped rays fanning across the sky, birds crossing.', {}, function (k, p, t, m) {
    var r = p.rise, cx = 1270, cy = 650 - 100 * r, R = 300 + 900 * r;
    for (var i = 0; i < 16; i++) { var a0 = 3.1416 + i * 3.1416 / 16 + Math.sin(t * 0.2) * 0.02, a1 = a0 + 3.1416 / 32; k.shape([[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], i % 2 ? '#f6c544' : '#ef7d2d', { lw: 0, a: 0.5 * r + 0.15 }); }
    k.glow(cx, cy, 200 + 200 * r, '#f6c544', 0.6 * r); k.blob(cx, cy, 60 + 40 * r, 60 + 40 * r, '#f6c544', { lw: 5 });
    for (var b = 0; b < 6; b++) { if (b > r * 8) break; var x = 1900 - ((t * (30 + b * 5) + b * 400) % 2300), y = 160 + b * 40 + Math.sin(t + b) * 12, w = Math.sin(t * 7 + b) * 6; k.line([[x - 12, y - w], [x, y], [x + 12, y - w]], 3, '#15111c'); }
  }) },
  control: { from: (L, e) => ({ reach: L * 7 }), ...el('cables', 4.8, 'Power concentrating: the lighthouse grows an aerial and strings red cables to the rooftops one by one (reach = how many), sparks running down them.', {}, function (k, p, t, m) {
    var x = 1012, top = 270, up = 40 * k.clamp(p.reach / 7, 0, 1), H = [150, 205, 130, 180, 150, 215, 160], ORD = [4, 5, 3, 6, 2, 1, 0];
    k.line([[x, top], [x, top - 50 - up]], 4, '#15111c'); k.burst(x, top - 54 - up, 14 + Math.sin(t * 6) * 3, 5, 8, '#d8372f', { lw: 3 });
    for (var r = 0; r < 7; r++) {
      var a = k.clamp(p.reach - r, 0, 1); if (a <= 0) continue;
      var i = ORD[r], hx = 261 + i * 166, hy = 568 - H[i] - (i % 3) * 10, pts = [];
      for (var n = 0; n <= 12 * a; n++) { var u = n / 12; pts.push([x + (hx - x) * u, top + (hy - top) * u + Math.sin(u * 3.1416) * 50]); }
      if (pts.length > 1) { k.line(pts, 5, '#15111c'); k.line(pts, 2.5, '#d8372f'); }
      var u2 = (t * 0.3 + r * 0.17) % 1; if (u2 < a) k.burst(x + (hx - x) * u2, top + (hy - top) * u2 + Math.sin(u2 * 3.1416) * 50, 9, 3, 6, '#f6c544', { lw: 2 });
      if (a > 0.97) k.burst(hx, hy, 12, 5, 8, '#d8372f', { lw: 3 });
    }
  }) },
  environment: { from: (L, e) => ({ amount: L }), ...el('smoke', 3.2, 'Energy and resources burned: a factory stack behind the houses pushes out inked smoke puffs that swell with amount (0..1) and lean with the wind.', {}, function (k, p, t, m) {
    k.rect(1108, 380, 22, 230, '#3a3350', { lw: 4 }); k.rect(1104, 372, 30, 10, '#231c3a', { lw: 3 });
    for (var i = 0; i < 12; i++) { if (i > p.amount * 14) break; var q = (t * 0.05 + i / 12) % 1; k.blob(1119 + q * (120 + 200 * m.wind) + Math.sin(q * 9 + i) * 14, 366 - q * (170 + 90 * p.amount), 18 + q * (46 + 40 * p.amount), 14 + q * (30 + 26 * p.amount), i % 2 ? '#6f6a80' : '#8d879c', { lw: 4, a: 1 - q * 0.5 }); }
  }) },
  pace: { from: (L, e) => ({ force: L }), ...el('gale', 7.5, 'Everything moving too fast: white speed lines tear across the sky (force 0..1).', {}, function (k, p, t, m) {
    for (var i = 0; i < 22; i++) { if (i > p.force * 26) break; var y = 60 + k.rand(i) * 440, l = 120 + k.rand(i + 3) * 260, x = ((k.rand(i + 8) * 2200 + t * (500 + k.rand(i) * 500)) % 2600) - 500; k.line([[x, y], [x + l, y]], 3, '#fbf6e9', { a: 0.7 }); }
  }) },
};
export const NEWSTARS = el('newstars', 0.8, 'An answer the director could not place still leaves a mark: one more large gold star (count).', {}, function (k, p, t, m) {
  for (var i = 0; i < 40; i++) { var a = k.clamp(p.count - i, 0, 1); if (a <= 0) break; k.burst(100 + k.rand(i + 200) * 1400, 40 + k.rand(i + 260) * 360, (14 + Math.sin(t * 3 + i) * 3) * a, 4 * a, 4, '#f6c544', { lw: 2.5 }); }
});
