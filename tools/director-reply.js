// Test-session director, step 2: check a reply (JSON in the director's reply format) and load it.
//   node tools/director-reply.js <reply.json> [--opening | --final | --fast | --draw --job <n>] [port=3000]
import fs from 'node:fs';
const args = process.argv.slice(2), file = args[0], has = n => args.includes(n);
const ji = args.indexOf('--job'), job = ji >= 0 ? Number(args[ji + 1]) : undefined;
const port = Number(args.find((a, i) => i > 0 && /^\d+$/.test(a) && i !== ji + 1)) || 3000;
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const BANNED = /\b(window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|import|eval|Function|constructor|prototype|__proto__|localStorage|sessionStorage|location|navigator|cookie|postMessage|setTimeout|setInterval|while|require|process)\b/;
let bad = 0;
for (const e of patch.add || []) {
  let note = 'ok';
  try { new Function('k', 'p', 't', 'm', e.code); } catch (x) { note = 'SYNTAX: ' + x.message; bad++; }
  const m = String(e.code).match(BANNED); if (m) { note = 'BANNED WORD: ' + m[0]; bad++; }
  console.log(`add ${String(e.id).padEnd(12)} layer ${e.layer}  ${String(e.code).length} chars  ${note}`);
}
if (bad) { console.log('Not sent: fix the elements above.'); process.exit(1); }
const r = await fetch(`http://localhost:${port}/api/director/patch`, { method: 'POST', body: JSON.stringify({ opening: has('--opening'), final: has('--final'), fast: has('--fast'), draw: has('--draw'), job, patch }) });
console.log('applied:', JSON.stringify(await r.json()));
