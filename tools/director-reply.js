// Test-session director, step 2: check a reply (JSON in the director's reply format) and load it.
//   node tools/director-reply.js <reply.json> [--opening] [port=3000]
import fs from 'node:fs';
const file = process.argv[2], opening = process.argv.includes('--opening'), final = process.argv.includes('--final'), port = Number(process.argv.find(a => /^\d+$/.test(a))) || 3000;
const patch = JSON.parse(fs.readFileSync(file, 'utf8'));
const BANNED = /\b(window|document|globalThis|self|fetch|XMLHttpRequest|WebSocket|import|eval|Function|constructor|prototype|__proto__|localStorage|sessionStorage|location|navigator|cookie|postMessage|setTimeout|setInterval|while|require|process)\b/;
let bad = 0;
for (const e of patch.add || []) {
  let note = 'ok';
  try { new Function('k', 'p', 't', 'm', e.code); } catch (x) { note = 'SYNTAX: ' + x.message; bad++; }
  const m = e.code.match(BANNED); if (m) { note = 'BANNED WORD: ' + m[0]; bad++; }
  console.log(`add ${e.id.padEnd(12)} layer ${e.layer}  ${e.code.length} chars  ${note}`);
}
console.log('set', (patch.set || []).map(s => s.id).join(', ') || '(none)', '| remove', (patch.remove || []).join(', ') || '(none)');
if (patch.feelings) console.log('feelings', Object.entries(patch.feelings).filter(e => e[1] > 0).map(e => e.join(' ')).join(', '));
if (bad) { console.log('Not sent: fix the elements above.'); process.exit(1); }
const r = await fetch(`http://localhost:${port}/api/director/patch`, { method: 'POST', body: JSON.stringify({ opening, final, patch }) });
console.log('applied:', JSON.stringify(await r.json()));
