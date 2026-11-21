// Living Scene server. One Node process, no required dependencies.
//   phones   -> POST /api/submit (an answer), POST /api/draft (an anonymous "someone is typing" cue)
//   display  <- GET /events (Server-Sent Events: the full scene, at least once a second)
//   director <> GET /api/director/next, POST /api/director/patch   (test-session mode; see src/director.js)
// Host-only actions (settings, reset, hide, director queue) are accepted from localhost only.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { filterSubmission } from './src/filter.js';
import { createDirector } from './src/director.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const QUESTION0 = process.env.QUESTION || 'What worries or excites you about where AI is going?';
const nets = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const lanIp = nets.find(a => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) || nets[0] || 'localhost'; // prefer the Wi-Fi address over VPN ones
const JOIN_URL = process.env.PUBLIC_URL || `http://${lanIp}:${PORT}/`;

const director = createDirector({ question: QUESTION0 });
let version, pending, feed, drafts, clients, metrics, answers, nextId = 1, seq;
const sse = new Set();
function reset() {
  version = 0; seq = 0; answers = 0; pending = []; feed = []; drafts = new Map(); clients = new Map();
  metrics = { subs: new Map(), batches: [], rejected: 0 };
  director.reset();
}
reset();

// ---------- the one-second loop: batch what arrived, send the scene ----------
// People typing right now: two numbers per phone, worked out on the phone. Draft text is never sent.
function typing() {
  const now = Date.now();
  let n = 0, energy = 0;
  for (const [cid, d] of drafts) { if (now - d.t > 3000) { drafts.delete(cid); continue; } n++; energy += d.energy; }
  return { n, energy: n ? energy / n : 0 };
}
function broadcast(ids = []) {
  version++;
  const now = Date.now();
  for (const id of ids) { const s = metrics.subs.get(id); if (s) s.tSent = now; }
  const msg = `event: state\ndata: ${JSON.stringify({ v: version, scene: director.scene(), typing: typing(), answers,
    feed: feed.slice(0, 14).map(f => ({ id: f.id, text: f.text, in: f.n <= director.seen() })) })}\n\n`;   // "in": the director has worked it into the picture
  for (const res of sse) res.write(msg);
}
// Whatever has piled up goes to the director as ONE batch. Answers that arrive while it is busy
// wait and go together next time, so the picture never works through a backlog of stale requests.
function drain() {
  const batch = pending.splice(0);
  for (const b of batch) { b.n = ++seq; if (!b.quiet) feed.unshift({ id: b.id, text: b.text, n: b.n }); }
  feed.length = Math.min(feed.length, 60);
  answers += batch.length;
  metrics.batches.push(batch.length);
  director.onBatch(batch.map(b => b.text), () => broadcast());   // the instant layer acts now; in API mode the reply lands when it is ready
  broadcast(batch.map(b => b.id));
}
setInterval(() => {
  director.tick(() => broadcast());
  if (pending.length) drain(); else broadcast();
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
  const p = url.pathname, POST = req.method === 'POST';

  // ---- display ----
  if (p === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    sse.add(res); req.on('close', () => sse.delete(res));
    return broadcast();
  }
  if (p === '/api/config') return json(res, 200, { question: director.question(), joinUrl: JOIN_URL });
  if (p === '/qr.svg') {
    try {
      const QR = (await import('qrcode')).default;
      res.writeHead(200, { 'content-type': TYPES['.svg'] });
      return res.end(await QR.toString(JOIN_URL, { type: 'svg', margin: 1, color: { dark: '#0b0e1e', light: '#f4f1ea' } }));
    } catch { res.writeHead(404); return res.end(); }
  }

  // ---- phones ----
  if (p === '/api/submit' && POST) {
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
    pending.push({ id, text: f.text, quiet: !!b.quiet && isLocal(req) });   // quiet: counted and drawn, but kept out of the feed
    metrics.subs.set(id, { tAccept: now });
    for (const r of sse) r.write(`event: accept\ndata: ${id}\n\n`);         // instant acknowledgement on the projector
    return json(res, 200, { ok: true });
  }
  if (p === '/api/draft' && POST) {
    const b = await body(req);
    if (b.cid) drafts.set(String(b.cid).slice(0, 40), { energy: Math.max(0, Math.min(1, Number(b.energy) || 0)), t: Date.now() });
    return json(res, 200, { ok: true });
  }

  // ---- host (localhost only for anything that changes state) ----
  if (p === '/api/settings') {          // GET: full status. POST: sliders, session clock, question, opening choice
    if (!POST) return json(res, 200, director.status());
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req);
    const out = director.control(b, () => broadcast());
    if (b.question) reset();
    broadcast();
    return json(res, 200, out);
  }
  if (p === '/api/reset' && POST) {     // ?fresh also forgets the saved opening, so a new one is drawn
    if (!isLocal(req)) return json(res, 403, {});
    reset(); if (url.searchParams.has('fresh')) director.reset(true);
    broadcast(); director.open(() => broadcast());
    return json(res, 200, { ok: true });
  }
  if (p === '/api/hide' && POST) {      // take one answer out of the feed
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req); feed = feed.filter(f => f.id !== b.id); broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === '/api/metrics') {
    const sent = [...metrics.subs.values()].filter(s => s.tSent).map(s => s.tSent - s.tAccept);
    return json(res, 200, { accepted: metrics.subs.size, rejected: metrics.rejected, stillPending: pending.length, batchSizes: metrics.batches,
      acceptToBroadcastMs: { p50: pct(sent, 0.5), p95: pct(sent, 0.95), max: pct(sent, 1) }, director: director.status().calls });
  }

  // ---- recorded sessions: replay one with no model, or keep the current one as a demo ----
  if (p === '/api/demo') {
    const dir = path.join(ROOT, 'demos'), names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort((x, y) => fs.statSync(path.join(dir, y + '.json')).mtimeMs - fs.statSync(path.join(dir, x + '.json')).mtimeMs) : [];   // newest first: the default demo is the latest recording
    if (!POST) return json(res, 200, { demos: names });
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req), safe = String(b.save || b.name || names[0] || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (b.save) { if (!safe) return json(res, 400, { ok: false }); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, safe + '.json'), JSON.stringify(director.tape())); return json(res, 200, { ok: true, saved: safe }); }
    if (!names.includes(safe)) return json(res, 404, { ok: false, reason: 'no such demo', demos: names });
    const demo = JSON.parse(fs.readFileSync(path.join(dir, safe + '.json'), 'utf8'));
    reset();
    director.play(demo, { gap: Math.max(100, Number(b.gap) || 1200), done: () => broadcast(),
      onAnswers: texts => { for (const text of texts) { feed.unshift({ id: nextId++, text, n: ++seq }); answers++; for (const r of sse) r.write('event: accept\ndata: 0\n\n'); } broadcast(); } });
    return json(res, 200, { ok: true, demo: safe, steps: demo.tape.length });
  }

  // ---- the director's queue (test-session mode) ----
  if (p === '/api/director/prompt' && POST) {   // the exact text a request would carry, without consuming anything
    if (!isLocal(req)) return json(res, 403, {});
    const b = await body(req);
    return json(res, 200, director.prompt(['open', 'final', 'concepts', 'fast'].includes(b.kind) ? b.kind : 'patch', b.answers || []));
  }
  if (p === '/api/director/next') {
    if (!isLocal(req)) return json(res, 403, {});
    const wait = Math.min(250, Number(url.searchParams.get('wait')) || 30) * 1000;
    return json(res, 200, await director.next(wait, url.searchParams.get('role') || 'all', () => req.socket.destroyed));
  }
  if (p === '/api/director/patch' && POST) {
    if (!isLocal(req)) return json(res, 403, {});
    const out = director.reply(await body(req, 400000)); broadcast();
    return json(res, 200, out);
  }

  // ---- static ----
  const rel = p === '/' ? 'index.html' : p === '/comic' ? 'comic.html' : p.slice(1);
  const file = path.join(ROOT, 'public', path.normalize(rel));
  if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Display : http://localhost:${PORT}/comic   (director: ${director.status().mode})\n  Phones  : ${JOIN_URL}\n`);
  director.open(() => broadcast());
});
