// Living Scene server. Zero required dependencies.
//   phones  -> POST /api/submit, POST /api/draft
//   display <- GET /events (Server-Sent Events: full world state, at least once a second)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { filterSubmission } from './src/filter.js';
import { interpretBatch, initEmbeddings, embeddingStatus } from './src/interpret.js';
import { createWorld, mergeIdeas, decay, snapshot } from './src/world.js';
import { CONCEPTS } from './src/concepts.js';
import { createDirector } from './src/director.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const QUESTION0 = process.env.QUESTION || 'What worries or excites you about where AI is going?';
const nets = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const lanIp = nets.find(a => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) || nets[0] || 'localhost'; // prefer the Wi-Fi address over VPN ones
const JOIN_URL = process.env.PUBLIC_URL || `http://${lanIp}:${PORT}/`;

const director = createDirector({ question: QUESTION0 });
let world, version, pending, busy, feed, drafts, clients, metrics, nextId = 1, seq = 0;
const sse = new Set();
function reset() {
  world = createWorld({ K: Number(process.env.DEPTH || 4) });
  version = 0; seq = 0; pending = []; busy = false; feed = []; drafts = new Map(); clients = new Map();
  resetMetrics(); director.reset();
}
function resetMetrics() { metrics = { subs: new Map(), batches: [], rejected: 0, display: {} }; }
reset();

// ---------- the one-second snapshot loop ----------
function draftSummary() {
  const now = Date.now();
  let n = 0, val = 0, energy = 0;
  for (const [cid, d] of drafts) {
    if (now - d.t > 3000) { drafts.delete(cid); continue; }
    n++; val += d.val; energy += d.energy;
  }
  return { n, val: n ? val / n : 0, energy: n ? energy / n : 0 };
}
function broadcast(events = [], ids = []) {
  version++;
  const now = Date.now();
  for (const id of ids) { const s = metrics.subs.get(id); if (s) { s.tSent = now; s.v = version; } }
  const snap = snapshot(world, draftSummary());
  const msg = `event: state\ndata: ${JSON.stringify({ v: version, t: snap, scene: director.scene(world, snap), ev: events, feed: feed.slice(0, 14).map(f => ({ id: f.id, text: f.text, in: f.n <= director.seen() })), answers: world.answers })}\n\n`;
  for (const res of sse) res.write(msg);
}
async function drain() {
  // Latest-wins: whatever has piled up is interpreted as ONE batch and merged into the
  // current world. However long interpretation takes, we never queue stale scene targets.
  if (busy) return;
  busy = true;
  try {
    while (pending.length) {
      const batch = pending.splice(0); for (const b of batch) b.n = ++seq;   // the order answers reach the director, to mark which are in the picture
      const t0 = performance.now();
      const perAnswer = await interpretBatch(batch.map(b => b.text));
      const events = mergeIdeas(world, perAnswer.flat());
      world.answers += batch.length;
      for (const b of batch) if (!b.quiet) feed.unshift({ id: b.id, text: b.text, n: b.n });
      feed.length = Math.min(feed.length, 60);
      metrics.batches.push({ size: batch.length, ms: +(performance.now() - t0).toFixed(1) });
      broadcast(events, batch.map(b => b.id));
      director.onBatch(batch.map(b => b.text), () => broadcast());   // live mode: Claude's patch lands when it is ready
    }
  } finally { busy = false; }
}
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  decay(world, (now - last) / 1000); last = now;
  director.tick(() => broadcast());
  if (pending.length) drain(); else if (!busy) broadcast();
}, 1000);

// ---------- http ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml' };
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
const isLocal = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
function body(req, max = 4000) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > max) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
  });
}
const pct = (arr, p) => arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    sse.add(res); req.on('close', () => sse.delete(res));
    broadcast();
    return;
  }
  if (p === '/api/director') return json(res, 200, director.status());
  // The exact prompt the director sends, and a way to apply a reply by hand (local only).
  if (p === '/api/director/prompt' && req.method === 'POST') { const b = await body(req); return json(res, 200, director.prompt(['open', 'final'].includes(b.kind) ? b.kind : 'patch', b.answers || [], b.question || undefined)); }
  // sliders, session clock, question
  if (p === '/api/settings') {
    if (req.method === 'POST') { if (!isLocal(req)) return json(res, 403, {}); const b = await body(req); const out = director.control(b, () => broadcast()); if (b.question) { reset(); } broadcast(); return json(res, 200, out); }
    return json(res, 200, director.status());
  }
  if (p === '/api/director/next') {
    if (!isLocal(req)) return json(res, 403, {});
    return json(res, 200, await director.next(Math.min(590, Number(url.searchParams.get('wait')) || 30) * 1000));
  }
  if (p === '/api/director/patch' && req.method === 'POST') {
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req, 400000); const out = director.apply(b.patch || b, { opening: !!b.opening, final: !!b.final }); broadcast();
    return json(res, 200, out);
  }
  if (p === '/api/config') return json(res, 200, { question: director.question(), joinUrl: JOIN_URL, embeddings: embeddingStatus.state, treatments: Object.fromEntries(CONCEPTS.map(c => [c.id, c.treatment])) });

  if (p === '/api/submit' && req.method === 'POST') {
    const b = await body(req);
    const cid = String(b.cid || req.socket.remoteAddress).slice(0, 40), now = Date.now();
    const c = clients.get(cid) || { t: 0, last: '' };
    if (now - c.t < 2000) return json(res, 429, { ok: false, reason: 'One moment, then send again.' });
    const f = filterSubmission(b.text);
    if (!f.ok) { metrics.rejected++; return json(res, 200, f); }
    if (f.text.toLowerCase() === c.last) return json(res, 200, { ok: false, reason: 'You already sent that one.' });
    clients.set(cid, { t: now, last: f.text.toLowerCase() });
    drafts.delete(cid);
    const id = nextId++;
    pending.push({ id, text: f.text, quiet: !!b.quiet && isLocal(req) }); // quiet: guess-mode answers stay out of the feed
    metrics.subs.set(id, { tAccept: now });
    // Instant acknowledgement on the projector (a ripple), ahead of interpretation.
    for (const r of sse) r.write(`event: accept\ndata: ${id}\n\n`);
    return json(res, 200, { ok: true });
  }
  if (p === '/api/draft' && req.method === 'POST') {
    // Anonymous tone cue: two numbers computed on the phone. Draft text is never sent.
    const b = await body(req);
    const val = Math.max(-1, Math.min(1, Number(b.val) || 0)), energy = Math.max(0, Math.min(1, Number(b.energy) || 0));
    if (b.cid) drafts.set(String(b.cid).slice(0, 40), { val, energy, t: Date.now() });
    return json(res, 200, { ok: true });
  }
  if (p === '/api/ack' && req.method === 'POST') {
    // The display reports the first frame drawn for each state version.
    const b = await body(req), now = Date.now();
    for (const s of metrics.subs.values()) if (s.v && s.v <= b.v && !s.tFrame) s.tFrame = now;
    if (b.display) metrics.display = b.display;
    return json(res, 200, {});
  }
  if (p === '/api/metrics') {
    const subs = [...metrics.subs.values()];
    const sent = subs.filter(s => s.tSent).map(s => s.tSent - s.tAccept), frame = subs.filter(s => s.tFrame).map(s => s.tFrame - s.tAccept);
    const out = {
      accepted: subs.length, rejected: metrics.rejected, stillPending: pending.length,
      sceneTargets: metrics.batches.length, batchSizes: metrics.batches.map(b => b.size), interpretMs: metrics.batches.map(b => b.ms),
      acceptToBroadcastMs: { p50: pct(sent, 0.5), p95: pct(sent, 0.95), max: pct(sent, 1) },
      acceptToFirstFrameMs: { n: frame.length, p50: pct(frame, 0.5), p95: pct(frame, 0.95), max: pct(frame, 1) },
      display: metrics.display, embeddings: embeddingStatus.state,
    };
    if (url.searchParams.has('reset')) resetMetrics();
    return json(res, 200, out);
  }
  if (p === '/api/interpret' && req.method === 'POST') {
    const b = await body(req);
    const f = filterSubmission(b.text);
    return json(res, 200, f.ok ? { ok: true, ideas: (await interpretBatch([f.text]))[0] } : f);
  }
  if (p === '/api/reset' && req.method === 'POST') { if (!isLocal(req)) return json(res, 403, {}); const fresh = url.searchParams.has('fresh'); reset(); if (fresh) director.reset(true); broadcast(); director.open(() => broadcast()); return json(res, 200, { ok: true }); }
  if (p === '/api/hide' && req.method === 'POST') {
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req); feed = feed.filter(f => f.id !== b.id); broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === '/qr.svg') {
    try {
      const QR = (await import('qrcode')).default;
      res.writeHead(200, { 'content-type': TYPES['.svg'] });
      return res.end(await QR.toString(JOIN_URL, { type: 'svg', margin: 1, color: { dark: '#0b0e1e', light: '#f4f1ea' } }));
    } catch { res.writeHead(404); return res.end(); }
  }

  // static
  const rel = p === '/' ? 'index.html' : p === '/display' ? 'display.html' : p === '/comic' ? 'comic.html' : p.slice(1);
  const file = path.join(ROOT, 'public', path.normalize(rel));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Comic     : http://localhost:${PORT}/comic   (director: ${director.status().mode})\n  Projector :http://localhost:${PORT}/display\n  Phones    : ${JOIN_URL}\n`);
  director.open(() => broadcast());
  if (process.env.NO_EMBED) console.log('  Interpreter: lexicon only (NO_EMBED set)');
  else initEmbeddings().then(() => console.log(`  Interpreter: lexicon + local embeddings (${embeddingStatus.state}${embeddingStatus.error ? ': ' + embeddingStatus.error : ''})`));
});
