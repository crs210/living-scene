// Burst latency test. Open http://localhost:3000/display first (so frame times are
// measured), then:  node tools/burst.js [count=150] [spreadMs=1500] [port=3000]
const [count = 150, spread = 1500, port = 3000] = process.argv.slice(2).map(Number);
const base = `http://localhost:${port}`;
const A = ['I worry', "I'm excited", 'Honestly I fear', 'I hope', 'It scares me', 'I love the idea', 'Not sure, but I dread', 'I am curious whether'];
const B = ['hackers will break every lock', 'it helps people understand each other', 'my job disappears', 'we cure cancer', 'nobody can tell what is real',
  'we are watched everywhere', 'a few companies control everything', 'kids get a tutor who never gives up', 'it all moves too fast', 'the energy it burns',
  'anyone can make music', 'things simply turn out fine', 'something I cannot name goes wrong'];
const C = ['', ', but it could also cure diseases', ' and that the locks keep failing', ', though it might bring us together', ' while jobs vanish'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const post = (p, body) => fetch(base + p, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));

await fetch(base + '/api/metrics?reset=1');
console.log(`sending ${count} answers over ${spread} ms...`);
const t0 = Date.now();
const results = await Promise.all(Array.from({ length: count }, async (_, i) => {
  await sleep(Math.random() * spread);
  return post('/api/submit', { cid: `burst-${t0}-${i}`, text: `${pick(A)} ${pick(B)}${pick(C)}` });
}));
console.log(`all accepted by server after ${Date.now() - t0} ms (${results.filter(r => r.ok).length} ok)`);
await sleep(4000);
const m = await (await fetch(base + '/api/metrics')).json();
console.log(`
accepted                 ${m.accepted}   (still pending ${m.stillPending})
scene targets produced   ${m.sceneTargets}   batch sizes ${JSON.stringify(m.batchSizes)}
interpretation per batch ${JSON.stringify(m.interpretMs)} ms   (${m.embeddings})
accept -> state sent     p50 ${m.acceptToBroadcastMs.p50} ms   p95 ${m.acceptToBroadcastMs.p95} ms   max ${m.acceptToBroadcastMs.max} ms
accept -> first frame    ${m.acceptToFirstFrameMs.n ? `p50 ${m.acceptToFirstFrameMs.p50} ms   p95 ${m.acceptToFirstFrameMs.p95} ms   max ${m.acceptToFirstFrameMs.max} ms  (n=${m.acceptToFirstFrameMs.n})` : 'no display connected'}
display                  ${m.display.fps ? `${m.display.fps} fps, frame change per 250 ms: mean ${m.display.meanStep}, max ${m.display.maxStep}  (hard cut > 0.15)` : 'n/a'}
`);
const pass = m.stillPending === 0 && (m.acceptToFirstFrameMs.p95 ?? m.acceptToBroadcastMs.p95) < 2000;
console.log(pass ? 'PASS: p95 under 2 s and nothing left queued' : 'FAIL: over 2 s at p95, or the queue did not drain');
