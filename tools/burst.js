// Burst test: many answers at once must merge into few batches and leave nothing queued.
//   node tools/burst.js [count=150] [spreadMs=1500] [port=3000]
const [count = 150, spread = 1500, port = 3000] = process.argv.slice(2).map(Number);
const base = `http://localhost:${port}`;
const A = ['I worry', "I'm excited", 'Honestly I fear', 'I hope', 'It scares me', 'I love the idea', 'Not sure, but I dread', 'I am curious whether'];
const B = ['hackers will break every lock', 'it helps people understand each other', 'my job disappears', 'we cure cancer', 'nobody can tell what is real',
  'we are watched everywhere', 'a few companies control everything', 'kids get a tutor who never gives up', 'it all moves too fast', 'the energy it burns',
  'anyone can make music', 'things simply turn out fine', 'something I cannot name goes wrong'];
const pick = a => a[Math.floor(Math.random() * a.length)];
const post = (p, body) => fetch(base + p, { method: 'POST', body: JSON.stringify(body) }).then(r => r.json());
const sleep = ms => new Promise(r => setTimeout(r, ms));
const before = await (await fetch(base + '/api/metrics')).json();
console.log(`sending ${count} answers over ${spread} ms...`);
const t0 = Date.now();
const results = await Promise.all(Array.from({ length: count }, async (_, i) => { await sleep(Math.random() * spread); return post('/api/submit', { cid: `burst-${t0}-${i}`, text: `${pick(A)} ${pick(B)} ${i}` }); }));
console.log(`${results.filter(r => r.ok).length} accepted after ${Date.now() - t0} ms`);
await sleep(2500);
const m = await (await fetch(base + '/api/metrics')).json();
const batches = m.batchSizes.slice(before.batchSizes.length);
console.log(`batches ${JSON.stringify(batches)}   still pending ${m.stillPending}   accept -> scene sent: p50 ${m.acceptToBroadcastMs.p50} ms, p95 ${m.acceptToBroadcastMs.p95} ms`);
const pass = m.stillPending === 0 && batches.length <= Math.ceil(spread / 1000) + 2 && m.acceptToBroadcastMs.p95 < 2000;
console.log(pass ? 'PASS' : 'FAIL'); process.exit(pass ? 0 : 1);
