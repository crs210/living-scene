// The opening shot, as elements. Same format as everything else in the scene:
//   { id, layer, desc, params, code }  where code is the body of  function (k, p, t, m) { ... }
const body = fn => { const s = fn.toString(); return s.slice(s.indexOf('{') + 1, s.lastIndexOf('}')).replace(/\n {4}/g, '\n').trim(); };
export const el = (id, layer, desc, params, fn) => ({ id, layer, desc, params, code: body(fn) });

export const BASE = [
  el('sky', 0, 'Night sky: flat colour, a glowing band at the horizon, halftone gradient, inked cloud bands that drift with the wind, four-point stars. Warms or cools with mood.', {}, function (k, p, t, m) {
    var warm = k.clamp(m.val, 0, 1), cold = k.clamp(-m.val, 0, 1);
    k.rect(-500, -400, 2600, 1050, k.mix(k.mix('#1b2150', '#3b2f7a', warm), '#0d0f24', cold), { lw: 0 });
    k.shape([[-500, 430], [2100, 430], [2100, 650], [-500, 650]], k.mix(k.mix('#3f3aa0', '#f0805a', warm), '#1c2548', cold), { lw: 0, a: 0.7 });
    k.dots([[-500, 150], [2100, 150], [2100, 640], [-500, 640]], k.mix(k.mix('#6a55c0', '#f6b06a', warm), '#2b3566', cold), 6.5, 17, { fade: 'down' });
    for (var i = 0; i < 34; i++) { var s = 2.5 + k.rand(i + 7) * 4 + Math.sin(t * 2 + i) * 1; k.burst(k.rand(i) * 1700 - 50, k.rand(i + 90) * 380 - 10, s * 2.4, s * 0.55, 4, '#fbf6e9', { lw: 0 }); }
    for (var c = 0; c < 5; c++) {
      var w = 240 + k.rand(c + 2) * 220, x = ((k.rand(c + 30) * 2400 + t * (5 + c * 2) * (1 + m.wind * 8)) % 2700) - 550, y = 70 + c * 66 + k.rand(c) * 30;
      k.shape([[x, y], [x + w * 0.16, y - 22], [x + w * 0.34, y - 14], [x + w * 0.5, y - 34], [x + w * 0.7, y - 16], [x + w * 0.86, y - 22], [x + w, y], [x + w * 0.8, y + 13], [x + w * 0.2, y + 15]], k.mix(k.mix('#3a3f95', '#8a5aa0', warm), '#171a3c', cold), { lw: 4, curve: true });
      k.line([[x + w * 0.2, y + 2], [x + w * 0.5, y - 4], [x + w * 0.78, y + 2]], 2, '#15111c', { curve: true, a: 0.6 });
    }
  }),
  el('moon', 1, 'The one true moon at (430,165): big, with a printed halo, a shaded limb and craters.', {}, function (k, p, t, m) {
    k.glow(430, 165, 210, '#fbf6e9', 0.5);
    k.blob(430, 165, 68, 68, '#fbf6e9', { lw: 6 });
    k.shape([[452, 100], [484, 128], [497, 165], [486, 202], [456, 230], [476, 196], [482, 165], [474, 132]], '#d8cfb8', { lw: 0, curve: true });
    k.blob(408, 146, 14, 12, '#d8cfb8', { lw: 2.5 }); k.blob(440, 196, 10, 8, '#d8cfb8', { lw: 2.5 }); k.blob(442, 132, 6, 6, '#d8cfb8', { lw: 2 }); k.blob(396, 186, 5, 4, '#d8cfb8', { lw: 2 });
  }),
  el('hills', 2, 'Far ridge and the near hill on the right (peak about 1450,500), cross-hatched on the shadow side.', {}, function (k, p, t, m) {
    var pts = [[-500, 660]]; for (var x = -500; x <= 2100; x += 60) pts.push([x, 540 - 40 * Math.sin(x * 0.004 + 1) - 22 * Math.sin(x * 0.011 + 2)]); pts.push([2100, 660]);
    k.shape(pts, '#141838', { lw: 4 });
    k.shape([[1150, 660], [1250, 590], [1340, 525], [1450, 498], [1560, 515], [1700, 570], [2100, 600], [2100, 660]], '#22386a', { lw: 5, curve: true });
    k.hatch([[1470, 505], [1700, 572], [2100, 602], [2100, 660], [1540, 660]], '#15111c', 9);
    k.line([[1290, 572], [1360, 528], [1430, 508]], 2.5, '#57c7c2', { curve: true, a: 0.7 });
  }),
  el('tower', 3, 'Red and white lighthouse at x=1012, lamp at y~300, gallery rail, and a hard-edged sweeping beam.', {}, function (k, p, t, m) {
    var x = 1012, top = 290, a = Math.sin(t * 0.5), dir = a > 0 ? 1 : -1, w = Math.abs(a);
    var beam = [[x, top + 12], [x + dir * 950, top - 50 - 70 * w], [x + dir * 950, top + 80 + 70 * w]];
    k.shape(beam, '#f6c544', { lw: 0, a: 0.16 + 0.22 * w }); k.dots(beam, '#fbf6e9', 3, 12, { a: 0.6 * w });
    k.shape([[x - 28, 612], [x - 15, top + 30], [x + 15, top + 30], [x + 28, 612]], '#fbf6e9', { lw: 6 });
    for (var i = 0; i < 3; i++) { var y0 = top + 60 + i * 92, e = i * 3.4; k.shape([[x - 17 - e, y0], [x + 17 + e, y0], [x + 19 + e, y0 + 42], [x - 19 - e, y0 + 42]], '#d8372f', { lw: 3 }); }
    k.hatch([[x + 6, top + 30], [x + 15, top + 30], [x + 28, 612], [x + 12, 612]], '#15111c', 7);
    k.rect(x - 26, top + 20, 52, 10, '#15111c', { lw: 0 }); k.line([[x - 28, top + 12], [x + 28, top + 12]], 3, '#15111c');
    k.rect(x - 13, top - 2, 26, 24, '#f6c544', { lw: 4 });
    k.shape([[x - 19, top - 2], [x, top - 26], [x + 19, top - 2]], '#d8372f', { lw: 4 });
    k.glow(x, top + 10, 74, '#f6c544', 0.85);
  }),
  el('houses', 4, 'Seven terraced houses, i=0..6 at x=186+166*i (150 wide): shaded side wall, hatched roof, chimney, lit windows with sills, and a closed brown door at x=245+166*i with a fanlight and step.', {}, function (k, p, t, m) {
    var H = [150, 205, 130, 180, 150, 215, 160], C = ['#3f52a0', '#8a4f9c', '#2c7f92', '#a54a5c', '#4f62b0', '#6a4fa0', '#2f6d9c'];
    for (var i = 0; i < 7; i++) {
      var x = 186 + i * 166, h = H[i], y = 602 - h, py = y - 40 - (i % 3) * 12;
      k.rect(x + 100, py + 4, 18, 44, '#7a3f4c', { lw: 3 });
      k.rect(x, y, 150, h, C[i], { lw: 5 });
      k.rect(x + 112, y, 38, h, k.mix(C[i], '#15111c', 0.5), { lw: 0 }); k.hatch([[x + 112, y], [x + 150, y], [x + 150, 602], [x + 112, 602]], '#15111c', 9);
      k.shape([[x - 12, y], [x + 75, py], [x + 162, y]], '#2c2348', { lw: 5 }); k.hatch([[x + 75, py], [x + 162, y], [x + 75, y]], '#15111c', 7);
      for (var r = 0; r < Math.floor((h - 80) / 44); r++) for (var c = 0; c < 2; c++) {
        var wx = x + 20 + c * 56, wy = y + 18 + r * 44, lit = k.rand(i * 9 + r * 3 + c) > 0.4;
        if (lit) k.glow(wx + 12, wy + 14, 34, '#f6c544', 0.4);
        k.rect(wx, wy, 24, 28, lit ? '#f6c544' : '#191636', { lw: 3 }); k.line([[wx + 12, wy], [wx + 12, wy + 28]], 2, '#15111c', { still: true }); k.line([[wx - 4, wy + 31], [wx + 28, wy + 31]], 4, '#15111c');
      }
      k.rect(x + 53, 597, 44, 6, '#3a3350', { lw: 2.5 });
      k.rect(x + 59, 532, 32, 10, '#f6c544', { lw: 3 });
      k.rect(x + 59, 546, 32, 52, '#6b4630', { lw: 4 }); k.line([[x + 75, 550], [x + 75, 594]], 1.5, '#15111c', { still: true }); k.blob(x + 67, 576, 3, 3, '#f6c544', { lw: 1.5 });
    }
  }),
  el('quay', 5, 'Stone quay (y 602-646) with cobbles, mooring bollards along the edge, and four street lamps at x=270+332*j, lamp head at y=522.', {}, function (k, p, t, m) {
    k.rect(-500, 602, 2600, 44, '#655a7c', { lw: 0 }); k.rect(-500, 636, 2600, 12, '#3a3350', { lw: 0 });
    k.line([[-500, 602], [2100, 602]], 4, '#15111c'); k.line([[-500, 647], [2100, 647]], 7, '#15111c');
    for (var i = 0; i < 44; i++) { var x = -100 + i * 44 + (i % 2) * 14; k.line([[x, 613 + (i % 3) * 7], [x + 16, 613 + (i % 3) * 7]], 2, '#3a3350', { still: true }); }
    for (var b = 0; b < 9; b++) { var bx = 110 + b * 190; k.rect(bx - 6, 630, 12, 18, '#15111c', { lw: 0 }); k.blob(bx, 629, 9, 5, '#15111c', { lw: 0 }); k.line([[bx - 3, 634], [bx - 3, 644]], 2, '#8d879c', { still: true }); }
    for (var j = 0; j < 4; j++) { var lx = 270 + j * 332; k.line([[lx, 604], [lx, 532]], 6, '#15111c'); k.line([[lx - 8, 604], [lx + 8, 604]], 6, '#15111c'); k.glow(lx, 522, 58, '#f6c544', 0.6); k.shape([[lx - 10, 532], [lx - 7, 512], [lx + 7, 512], [lx + 10, 532]], '#f6c544', { lw: 3.5 }); k.shape([[lx - 12, 512], [lx, 502], [lx + 12, 512]], '#15111c', { lw: 0 }); }
  }),
  el('walkers', 5.5, 'Six people in bright coats strolling the quay, each with a ground shadow. params.humans = how many are still walking.', { humans: 6 }, function (k, p, t, m) {
    var COAT = ['#d8372f', '#f6c544', '#57c7c2', '#ee6f9a', '#ef7d2d', '#7fb4e6'], HAIR = ['#15111c', '#6b4630', '#15111c', '#d8372f', '#15111c', '#f6c544'];
    for (var i = 0; i < 6; i++) {
      var a = k.clamp(p.humans - i, 0, 1); if (a <= 0) continue;
      var sp = 14 + k.rand(i) * 10, d = i % 2 ? 1 : -1, x = 200 + ((k.rand(i + 4) * 1200 + t * sp * d) % 1200 + 1200) % 1200, y = 642, s = Math.sin(t * 5 + i) * 8;
      k.alpha(a, function () {
        k.blob(x, y + 2, 15, 4, '#15111c', { lw: 0, a: 0.45 });
        k.line([[x, y - 24], [x + s, y]], 5, '#15111c'); k.line([[x, y - 24], [x - s, y]], 5, '#15111c');
        k.shape([[x - 10, y - 54], [x + 10, y - 54], [x + 12, y - 20], [x - 12, y - 20]], COAT[i], { lw: 3.5 });
        k.line([[x + d * 9, y - 48], [x + d * 13 - s * 0.6, y - 30]], 4, '#15111c');
        k.blob(x, y - 64, 9, 9, '#f3c9a5', { lw: 3 }); k.shape([[x - 9, y - 66], [x - 5, y - 75], [x + 5, y - 75], [x + 9, y - 66]], HAIR[i], { lw: 2, curve: true });
      });
    }
  }),
  el('water', 6, 'Harbour water from y=646 down: halftone depth, the houses and lamps reflected as broken bars of their own colour, the moon reflected at x=430, drifting wave strokes.', {}, function (k, p, t, m) {
    var H = [150, 205, 130, 180, 150, 215, 160], C = ['#3f52a0', '#8a4f9c', '#2c7f92', '#a54a5c', '#4f62b0', '#6a4fa0', '#2f6d9c'];
    k.rect(-500, 648, 2600, 700, '#122456', { lw: 0 });
    for (var i = 0; i < 7; i++) for (var r = 0; r < 4; r++) { var o = Math.sin(t * 1.6 + r * 1.3 + i) * 7, y = 660 + r * 15, w = 58 - r * 11; k.line([[261 + i * 166 - w + o, y], [261 + i * 166 + w + o, y]], 7 - r, C[i], { a: 0.6 - r * 0.12 }); }
    k.dots([[-500, 648], [2100, 648], [2100, 900], [-500, 900]], '#0a1232', 5.5, 15, { fade: 'down' });
    for (var j = 0; j < 4; j++) for (var q = 0; q < 4; q++) { var lx = 270 + j * 332 + Math.sin(t * 2.2 + q + j) * 5; k.line([[lx - 8 + q, 664 + q * 15], [lx + 8 - q, 664 + q * 15]], 4, '#f6c544', { a: 0.8 - q * 0.15 }); }
    for (var n = 0; n < 9; n++) { var mw = 44 - n * 4, mo = Math.sin(t * 2 + n) * 7; k.line([[430 - mw + mo, 668 + n * 16], [430 + mw + mo, 668 + n * 16]], 5, '#fbf6e9'); }
    for (var v = 0; v < 22; v++) { var wy = 672 + v * 10, l = 50 + k.rand(v + 5) * 100, x = ((k.rand(v) * 2000 + t * (14 + k.rand(v + 3) * 20) * (1 + m.wind * 2)) % 2200) - 300; k.line([[x, wy], [x + l * 0.3, wy - 6], [x + l * 0.6, wy], [x + l, wy - 3]], 3.5, v % 3 ? '#2f6fd0' : '#57c7c2', { curve: true }); }
  }),
  el('boat', 7.2, 'A small moored sailing boat in the lower right foreground (about x 1120-1350, y 740-880), bobbing: gives the shot a near plane.', {}, function (k, p, t, m) {
    var bx = 1236, by = 850 + Math.sin(t * 1.1) * 4, tilt = Math.sin(t * 1.1 + 1) * 5;
    k.line([[bx + 8, by - 14], [bx + 8 + tilt, by - 120]], 6, '#15111c');
    k.shape([[bx + 16 + tilt, by - 114], [bx + 14, by - 30], [bx + 92, by - 30]], '#fbf6e9', { lw: 4 });
    k.hatch([[bx + 14, by - 60], [bx + 60, by - 30], [bx + 14, by - 30]], '#15111c', 7);
    k.shape([[bx - 116, by - 16], [bx + 126, by - 16], [bx + 96, by + 24], [bx - 86, by + 24]], '#a54a5c', { lw: 6 });
    k.shape([[bx - 116, by - 16], [bx + 126, by - 16], [bx + 118, by - 4], [bx - 108, by - 4]], '#fbf6e9', { lw: 3 });
    k.hatch([[bx + 30, by - 4], [bx + 118, by - 4], [bx + 96, by + 24], [bx + 40, by + 24]], '#15111c', 8);
    k.line([[bx - 130, by + 30], [bx - 60, by + 34], [bx + 40, by + 30], [bx + 140, by + 34]], 4, '#57c7c2', { curve: true });
  }),
];
