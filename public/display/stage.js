// The stage: holds the elements, eases their numbers, moves the camera, and draws every frame.
// It knows nothing about any particular scene: each element arrives as { id, layer, code, params, ... } where
// `code` is the body of a draw function (k, p, t, m) written by the director model.
//   k = the drawing kit   p = the element's own numbers, eased toward their targets (this is the morph)
//   t = seconds           m = the shared atmosphere
import { cv, g, TAU, PAPER, clamp, hash, k, pen, mood, moodT } from './kit.js';

const els = new Map();       // id -> { layer, code, fn, cur, tgt, errors }
let phase = 'gathering', note = '';
let order = [], latestId = null, sceneMode = '';
const BANNED = /\b(window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|import|eval|Function|constructor|prototype|__proto__|localStorage|sessionStorage|location|navigator|cookie|postMessage|setTimeout|setInterval|while|require|process)\b/;
function compile(code) {
  // NOTE: a word blocklist is a seatbelt, not a sandbox. Before a public room, run scene code
  // in a sandboxed iframe or worker. Audience text can steer what the model writes.
  if (BANNED.test(code) || code.length > 6000) throw new Error('scene code rejected by safety check');
  return new Function('k', 'p', 't', 'm', '"use strict";' + code);
}
const cam = { zoom: 1, fx: 800, fy: 560 }, camT = { ...cam };   // the view, eased toward what the director (or the host) asked for
export function applyScene(scene) {
  if (scene.camera) { camT.zoom = scene.camera.zoom; camT.fx = scene.camera.focus[0]; camT.fy = scene.camera.focus[1]; }
  sceneMode = scene.mode; latestId = scene.latest; phase = scene.phase || 'gathering'; note = scene.note || '';
  if (scene.m) Object.assign(moodT, scene.m);
  const seen = new Set();
  for (const e of scene.els) {
    seen.add(e.id);
    let el = els.get(e.id);
    if (!el || el.code !== e.code) {
      let fn = null, err = null; try { fn = compile(e.code); } catch (x) { err = String(x.message); console.warn('element', e.id, err); }
      const cur = el ? el.cur : Object.fromEntries(Object.keys(e.params).map(key => [key, 0]));
      // a rewritten element keeps drawing its old self underneath while the new one inks in over it
      const old = el && el.fn && el.errors <= 3 && el.grow > 0.5 && fn ? el.fn : null;
      el = { layer: e.layer, code: e.code, desc: e.desc, theme: e.theme, fn, cur, tgt: {}, errors: err ? 99 : 0, born: el ? el.born : performance.now(), grow: el ? el.grow : 0, rec: el ? el.rec : 0, hits: el ? el.hits : undefined, bump: el ? el.bump : 0, old, mix: old ? 0 : 1 };
      els.set(e.id, el);
    }
    if (el.hits !== undefined && e.hits > el.hits) el.bump = 1;      // its idea was just voiced again: flash it
    el.hits = e.hits; el.stage = !!e.stage;
    el.tgt = e.params; el.layer = e.layer; el.gone = false; el.at = e.at || null; el.enter = e.enter || 'fade'; el.recT = e.recede || 0;
    for (const key in e.params) if (!(key in el.cur)) el.cur[key] = 0;
  }
  for (const [id, el] of els) if (!seen.has(id)) el.gone = true;       // removed elements shrink away
  order = [...els.entries()].sort((a, b) => a[1].layer - b[1].layer);
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
let slow = 0.016;
function resize() { const d = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, cv.clientWidth * d); cv.height = Math.max(1, cv.clientHeight * d); const m = 0.035 * Math.min(cv.width, cv.height); sc = Math.min((cv.width - 2 * m) / 1600, (cv.height - 2 * m) / 900); ox = (cv.width - 1600 * sc) / 2; oy = (cv.height - 900 * sc) / 2; grainPat = g.createPattern(grain, 'repeat'); tonePat = g.createPattern(tone, 'repeat'); }
addEventListener('resize', resize); resize();
new ResizeObserver(resize).observe(cv);    // the picture also changes size when the answers list is shown or hidden

function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000), t = now / 1000; prev = now; fps += (1 / Math.max(dt, 0.001) - fps) * 0.05;
  slow += (dt - slow) * 0.05; if (slow > 0.05) pen.Q = Math.min(1.8, pen.Q + 0.01); else if (slow < 0.034) pen.Q = Math.max(1, pen.Q - 0.01);
  pen.boil = Math.floor(t * (5 + 7 * mood.tension)); pen.WOB = 1.7 + 3.4 * mood.tension;
  for (const key in mood) mood[key] += (moodT[key] - mood[key]) * (1 - Math.exp(-dt / (key === 'rain' ? 12 : phase === 'final' ? 5 : 3)));   // rain comes in slowly
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = PAPER; g.fillRect(0, 0, cv.width, cv.height);
  g.setTransform(sc, 0, 0, sc, ox, oy);
  g.save(); g.beginPath(); g.rect(0, 0, 1600, 900); g.clip();
  for (const key in cam) cam[key] += (camT[key] - cam[key]) * (1 - Math.exp(-dt / 2.2));
  for (const [id, el] of order) {
    const kx = 1 - Math.exp(-dt / 2.4);
    for (const key in el.tgt) el.cur[key] += ((el.gone ? 0 : el.tgt[key]) - el.cur[key]) * kx;
    el.grow += ((el.gone ? 0 : 1) - el.grow) * (1 - Math.exp(-dt / 1.7));
    el.rec += ((el.recT || 0) - el.rec) * (1 - Math.exp(-dt / 4));
    if (el.gone && el.grow < 0.01) { els.delete(id); continue; }
    if (!el.fn || el.errors > 3) continue;
    g.save();
    // the camera: things in front of the backdrop scale about the focus point and re-centre; the backdrop (layers 0-1)
    // stays full when pulling back and only swells a little when closing in, so the frame is never left bare
    if (Math.abs(cam.zoom - 1) > 0.003) {
      const back = el.layer <= 1, f = back ? (cam.zoom > 1 ? 0.3 : 0) : el.layer === 2 ? 0.7 : 1, s = 1 + (cam.zoom - 1) * f;
      const cx = back ? cam.fx : cam.fx + (800 - cam.fx) * f, cy = back ? cam.fy : cam.fy + (500 - cam.fy) * f;
      g.translate(cx, cy); g.scale(s, s); g.translate(-cam.fx, -cam.fy);
    }
    // entrance (and exit, in reverse): each thing arrives in its own way from where it stands
    const u = 1 - el.grow * el.grow * (3 - 2 * el.grow), ax = el.at ? el.at[0] : 800, ay = el.at ? el.at[1] : 650;
    let alpha = clamp(el.grow * 1.6);
    if (u > 0.002) {
      if (el.enter === 'rise') g.translate(0, u * 340);
      else if (el.enter === 'drop') g.translate(0, -u * 520);
      else if (el.enter === 'slide') g.translate((ax < 800 ? -1 : 1) * u * 720, 0);
      else if (el.enter === 'grow') { const s = Math.max(0.04, 1 - u); g.translate(ax, ay); g.scale(s, s); g.translate(-ax, -ay); }
    }
    // a theme the room has stopped voicing recedes: smaller, fainter, moved toward the nearer edge
    if (el.rec > 0.01) { const s = 1 - 0.42 * el.rec, dx = (ax < 800 ? -ax : 1600 - ax) * 0.5 * el.rec; g.translate(ax + dx, ay); g.scale(s, s); g.translate(-ax, -ay); alpha *= 1 - 0.4 * el.rec; }
    // repeats are made visible by the display itself: an arrival is scaled by its theme's share of the room,
    // and pops with a burst the moment the idea is voiced again (from about 0.8x for a passing remark to 1.24x)
    if (el.theme && !el.stage) { const s = (0.76 + 0.48 * (el.cur.w ?? 0.5)) * (1 + 0.18 * Math.sin(Math.PI * (el.bump || 0))); g.translate(ax, ay); g.scale(s, s); g.translate(-ax, -ay); }
    if (el.bump > 0) { g.save(); g.globalAlpha = alpha * el.bump; k.burst(ax, ay - 150, 70 + 90 * (1 - el.bump), 34 + 50 * (1 - el.bump), 11, '#f6c544', { lw: 4 }); g.restore(); el.bump = Math.max(0, el.bump - dt / 1.1); }
    if (el.old) {
      el.mix = Math.min(1, el.mix + dt / 1.8);
      g.globalAlpha = alpha; try { el.old(k, el.cur, t, mood); } catch (x) { el.old = null; }
      if (el.mix >= 1) el.old = null;
    }
    g.globalAlpha = alpha * (el.mix * el.mix * (3 - 2 * el.mix));
    const c0 = performance.now();
    try { el.fn(k, el.cur, t, mood); } catch (x) { if (++el.errors > 3) console.warn('element disabled:', id, x.message); }
    // Guard: a drawing that keeps taking too long would stall the whole picture, so it is switched off.
    // Three very slow frames (over 150 ms), or about two seconds averaging over 8 ms, is enough.
    const cost = performance.now() - c0; el.cost = (el.cost || 0) * 0.9 + cost * 0.1;
    if (cost > 150) el.spikes = (el.spikes || 0) + 1;
    el.slow = el.cost > 8 ? (el.slow || 0) + 1 : Math.max(0, (el.slow || 0) - 1);
    if (el.spikes >= 3 || el.slow > 120) { el.errors = 99; el.tooSlow = true; console.warn('element switched off for being too slow:', id, Math.round(el.cost) + ' ms a frame'); }
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
  const gx = hash(pen.boil) * 256 | 0, gy = hash(pen.boil + 9) * 256 | 0; g.translate(-gx, -gy); g.fillRect(gx, gy, cv.width, cv.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.16; g.fillStyle = '#e0c48c'; g.fillRect(0, 0, cv.width, cv.height);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  requestAnimationFrame(frame);
}

// ---------- atmosphere: weather and colour grade over the whole panel, from the feelings of the room ----------
function atmosphere(t) {
  const M = mood;
  if (M.mist > 0.03) { g.fillStyle = '#d9d2c4'; for (let i = 0; i < 6; i++) { g.globalAlpha = M.mist * 0.2; const x = ((hash(i + 3) * 2400 + t * (8 + i * 3)) % 2600) - 500, y = 420 + i * 70 + Math.sin(t * 0.2 + i) * 20; g.beginPath(); g.ellipse(x, y, 520, 46 + i * 6, 0, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  if (M.rain > 0.06) {
    const n = M.rain * 190, sl = 14 + M.wind * 60 + M.storm * 20; g.strokeStyle = '#e4ecff'; g.lineWidth = 2.2; g.globalAlpha = 0.35 + 0.35 * M.rain; g.beginPath();
    for (let i = 0; i < n; i++) { const x = ((hash(i) * 2000 + t * (120 + hash(i + 5) * 160) * (0.2 + M.wind)) % 2000) - 200, y = ((hash(i + 9) * 1100 + t * (950 + hash(i + 2) * 500)) % 1100) - 100; g.moveTo(x, y); g.lineTo(x + sl, y + 52); }
    g.stroke(); g.globalAlpha = 1;
  }
  if (M.wonder > 0.04) for (let i = 0; i < M.wonder * 46; i++) { const tw = Math.sin(t * (1.5 + hash(i) * 2) + i * 2.1); if (tw < 0.2) continue; g.globalAlpha = tw * 0.9; k.sparkle(hash(i + 11) * 1600, hash(i + 23) * 640 + Math.sin(t * 0.3 + i) * 10, 5 + tw * 9, i % 3 ? '#fbf6e9' : '#f6c544'); }
  g.globalAlpha = 1;
  // grade: wear drains the colour; light and warmth tint the whole print
  if (M.decay > 0.02) { g.globalCompositeOperation = 'saturation'; g.globalAlpha = Math.min(0.5, M.decay * 0.55); g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 1600, 900); }
  const dark = clamp((0.6 - M.light) / 0.6), bright = clamp((M.light - 0.6) / 0.4);
  if (dark > 0.01) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = dark * 0.58; g.fillStyle = '#1a1838'; g.fillRect(0, 0, 1600, 900); }
  if (bright > 0.01) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = bright * 0.55; g.fillStyle = '#fff4d0'; g.fillRect(0, 0, 1600, 900); }
  if (Math.abs(M.warmth) > 0.03) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = Math.abs(M.warmth) * 0.5; g.fillStyle = M.warmth > 0 ? '#ff9a3c' : '#2f58d8'; g.fillRect(0, 0, 1600, 900); }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

// ---------- what the rest of the page may use ----------
export const pop = () => { if (pops.length < 30) pops.push({ x: 300 + Math.random() * 1000, y: 800 + Math.random() * 60, age: 0 }); };   // an inked burst the instant an answer is accepted
export const info = () => ({ fps, quality: pen.Q, phase, note, order, latestId, mode: sceneMode, els });
export const start = () => requestAnimationFrame(frame);
