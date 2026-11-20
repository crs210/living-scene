// Self-check: starts a private copy of the app and exercises the whole pipeline with scripted
// director replies. No model, no network, about 20 seconds. Run after any change:
//   npm test        (or: node tools/selfcheck.js)
// It checks the plumbing (batching, themes, staggered reveal, receding, the reader/cartoonist split,
// abandoned waits, the final image). It cannot check whether the pictures are any good.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3000 + Math.floor(700 + Math.random() * 200), P = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'living-scene-check-'));
const STAGGER = 500;
const app = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore',
  env: { ...process.env, PORT: String(PORT), STAGGER_MS: String(STAGGER), CACHE_DIR: path.join(tmp, 'cache'), SESSIONS_DIR: path.join(tmp, 'sessions'), ANTHROPIC_API_KEY: '', DIRECTOR_MOCK: '' } });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (u, b) => fetch(P + u, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const get = u => fetch(P + u).then(r => r.json());
async function state() {          // one message from the display's event stream
  const ac = new AbortController(), r = await fetch(P + '/events', { signal: ac.signal }), rd = r.body.getReader(); let s = '';
  for (;;) { const { value } = await rd.read(); s += new TextDecoder().decode(value); const m = s.match(/event: state\ndata: (.*)\n\n/); if (m) { ac.abort(); return JSON.parse(m[1]); } }
}
const ids = async () => (await state()).scene.els.map(e => e.id);
const el = (id, extra = {}) => ({ id, layer: 3, desc: id, code: "var d = m.decay, b = m.bloom; k.rect(100, 100, 50, 50, '#fff', {});", params: [], ...extra });
const say = async list => { for (const t of list) await post('/api/submit', { text: t, cid: 'c' + Math.random() }); await sleep(2200); };   // wait for the one-second batcher
let failed = 0, n = 0;
const ok = (cond, what) => { n++; if (!cond) failed++; console.log((cond ? '  ok   ' : '  FAIL ') + what); };

try {
  for (let i = 0; i < 40; i++) { try { await get('/api/config'); break; } catch { await sleep(150); } }

  console.log('pages and filter');
  ok((await fetch(P + '/')).status === 200 && (await fetch(P + '/comic')).status === 200 && (await fetch(P + '/comic.js')).status === 200, 'answer page, display and its script are served');
  ok((await fetch(P + '/display')).status === 404, 'removed pages are gone');
  ok((await post('/api/submit', { text: 'x', cid: 'f1' })).ok === false, 'a one-letter answer is refused');
  ok((await post('/api/submit', { text: 'I am scared to walk home at night', cid: 'f2' })).ok === true, 'an ordinary sentence containing "night" is accepted');
  await sleep(2200); await post('/api/reset?fresh', {});

  console.log('opening');
  ok((await get('/api/director/next?wait=1')).kind === 'open', 'with no picture, the director is asked for an opening');
  await post('/api/director/patch', { opening: true, patch: { add: [el('sky'), el('hill'), el('walker', { at: [400, 700] })], note: 'open' } });
  ok((await ids()).join() === 'sky,hill,walker', 'the opening appears at once, whole');

  console.log('one batch, one director');
  await say(['data centres', 'bring back the dinosaurs']);
  const job = await get('/api/director/next?wait=3');
  ok(job.kind === 'patch' && job.answers.length === 2, 'two answers sent together arrive as one batch');
  ok(job.system.includes('EDITING WHAT IS ALREADY THERE') && job.user.includes('walker') && job.user.includes('at 400,700'), 'the request carries the rules and the current elements with their positions');
  ok((await state()).feed.every(f => !f.in), 'answers are not marked as in the picture before the reply');
  const out = await post('/api/director/patch', { patch: { feelings: { dread: 0.6 }, ideas: [{ theme: 'dc', n: 1, gist: 'dc', touches: ['sky'] }, { theme: 'dino', n: 1, gist: 'dino', touches: [] }],
    add: [el('dino', { theme: 'dino', at: [300, 600], enter: 'rise' }), el('dc', { theme: 'dc', at: [1200, 600], enter: 'grow' }), { ...el('sky', { theme: 'dc' }), code: "/*V2*/ k.rect(0, 0, 10, 10, '#000', {});" },
      el('x1'), el('x2'), el('x3'), el('x4')], remove: ['walker'], note: 'n1' } });
  ok(out.added.length >= 3 && out.rejected.some(r => r.includes('allowance')), 'elements beyond the allowance are refused and reported, not dropped silently');
  const s0 = await state();
  ok(s0.feed.every(f => f.in), 'answers are marked as in the picture once the reply is applied');
  ok(!s0.scene.els.some(e => e.id === 'dc') && s0.scene.els.some(e => e.id === 'walker'), 'new pieces are held back and removed ones linger: nothing pops in together');
  ok(s0.scene.m.decay > 0, 'feelings change the atmosphere straight away');
  await sleep(STAGGER * (out.added.length + 2) + 1500);
  const s1 = await state();
  ok(['dino', 'dc'].every(id => s1.scene.els.some(e => e.id === id)) && !s1.scene.els.some(e => e.id === 'walker'), 'after the stagger every piece has arrived and the removed one has gone');
  ok(s1.scene.els.find(e => e.id === 'sky').code.includes('V2') && s1.scene.els.find(e => e.id === 'dino').enter === 'rise', 'a rewrite replaces the old code; entrances are passed to the display');
  ok(s1.scene.dev.jobs.some(j => j.kind === 'patch' && j.doneAt && j.pieces.length >= 3), 'the developer log records the request and what it produced');

  console.log('repetition and receding');
  for (let b = 0; b < 4; b++) { await say([0, 1, 2, 3].map(i => `jobs ${b} ${i}`)); await get('/api/director/next?wait=3'); await post('/api/director/patch', { patch: { feelings: {}, ideas: [{ theme: 'jobs', n: 4, gist: 'jobs' }], add: b ? [] : [el('desk', { theme: 'jobs', at: [800, 700] })], note: 'jobs' } }); }
  await sleep(STAGGER * 2 + 1500);
  const s2 = await state(), th = Object.fromEntries(s2.scene.themes.map(t => [t.key, t]));
  ok(th.jobs.count === 16 && th.jobs.w === 1 && th.dino.w < 0.2, 'a theme voiced sixteen times dominates; one voiced once is small');
  ok(s2.scene.els.find(e => e.id === 'dino').recede === 1 && s2.scene.els.find(e => e.id === 'desk').recede === 0, 'the quiet theme recedes instead of being deleted');
  ok(!s2.scene.els.find(e => e.id === 'sky').recede, 'an opening landmark never recedes');
  ok(s2.scene.els.find(e => e.id === 'desk').params.w === 1, "an element is given its theme's weight as p.w");

  console.log('reader and cartoonists');
  const d1 = get('/api/director/next?wait=20&role=draw'), d2 = get('/api/director/next?wait=20&role=draw');
  await say(['funny hats', 'more trees']);
  const f = await get('/api/director/next?wait=3&role=read');
  ok(f.kind === 'fast' && f.user.includes('FAST PASS'), 'the reader gets a fast request with no drawing in it');
  const fo = await post('/api/director/patch', { fast: true, patch: { feelings: { hope: 0.5 }, ideas: [{ theme: 'hats', n: 1, gist: 'hats', touches: ['dino'] }], set: [], remove: [], note: 'fast',
    draw: [{ id: 'dino', theme: 'dino', layer: 4, brief: 'dino gets a hat' }, { id: 'trees', theme: 'trees', layer: 4, brief: 'trees' }] } });
  ok(fo.toDraw.join() === 'dino,trees', 'the reader\'s briefs are queued for drawing');
  const [a, b] = await Promise.all([d1, d2]);
  ok(a.kind === 'draw' && b.kind === 'draw' && a.job !== b.job, 'two waiting cartoonists each get one brief');
  ok([a, b].find(x => x.id === 'dino').user.includes('Its current code'), 'a rewrite brief includes the element\'s current code');
  for (const x of [a, b]) await post('/api/director/patch', { draw: true, job: x.job, patch: { add: [el(x.id, { theme: x.id === 'dino' ? 'dino' : 'trees', at: [500, 600] })] } });
  await sleep(STAGGER * 3 + 1500);
  ok((await ids()).includes('trees'), 'the cartoonists\' drawings arrive in the picture');

  console.log('an abandoned wait');
  const ac = new AbortController(); fetch(P + '/api/director/next?wait=30&role=read', { signal: ac.signal }).catch(() => {}); await sleep(400); ac.abort(); await sleep(300);
  await post('/api/settings', { propose: true });
  ok((await get('/api/director/next?wait=3&role=read')).kind === 'concepts', 'a request for opening options is not swallowed by a worker that hung up');
  await post('/api/director/patch', { patch: { concepts: [{ title: 'A', pitch: 'a', room: 'a' }] } });

  console.log('controls and the final image');
  ok((await post('/api/settings', { magnitude: 0.2, abstraction: 0.9 })).settings.magnitude === 0.2, 'the sliders are stored');
  ok((await post('/api/settings', { settle: true })).phase === 'settling', 'settle now moves the session to settling');
  await post('/api/settings', { final: true });
  ok((await get('/api/director/next?wait=3&role=read')).kind === 'final', 'final image asks the director for a final composition');
  await post('/api/director/patch', { final: true, patch: { feelings: {}, note: 'the end' } });
  const s3 = await state();
  ok(s3.scene.phase === 'final' && s3.scene.els.every(e => !e.recede), 'the picture is final and nothing is receding');
  ok(fs.readdirSync(path.join(tmp, 'sessions')).length === 1, 'the finished session is saved');
  await say(['too late']);
  ok((await get('/api/director/next?wait=1')).kind === 'idle', 'answers after the final image change nothing');
} catch (e) { failed++; console.log('  FAIL the check itself broke: ' + (e.stack || e)); }
finally { app.kill(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
console.log(failed ? `\n${failed} of ${n} checks FAILED` : `\nall ${n} checks passed`);
process.exit(failed ? 1 : 0);
