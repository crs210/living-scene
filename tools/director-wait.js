// Test-session director, step 1: wait for the next piece of work from the running app.
//   node tools/director-wait.js [waitSeconds=540] [--role all|read|draw] [--system <file>] [--save <file>] [port=3000]
// Prints the kind of request, the new answers and the request text.
//   --role read   only reading work: openings, the fast pass (feelings, themes, numbers, briefs), the final image
//   --role draw   only drawings, one element per request; run several of these workers at once
//   --system f    writes the system prompt (the same every time) to f, to be read once
//   --save f      writes system prompt + "=== REQUEST ===" + request to f
import fs from 'node:fs';
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const save = opt('--save'), sys = opt('--system'), role = opt('--role') || 'all';
const skip = new Set(['--save', '--system', '--role'].map(n => args.indexOf(n) + 1).filter(i => i > 0));
const nums = args.filter((a, i) => /^\d+$/.test(a) && !skip.has(i)).map(Number), wait = nums[0] ?? 540, port = nums[1] ?? 3000;
try {
  const r = await (await fetch(`http://localhost:${port}/api/director/next?wait=${wait}&role=${role}`)).json();
  if (r.kind === 'idle') console.log('IDLE: nothing to do yet.');
  else if (r.kind === 'none') console.log('NONE: ' + r.reason);
  else {
    if (save) fs.writeFileSync(save, r.system + '\n\n=== REQUEST ===\n' + r.user);
    if (sys) fs.writeFileSync(sys, r.system);
    console.log(`KIND: ${r.kind}` + (r.job ? `\nJOB: ${r.job}` : ''));
    if (r.answers) console.log('ANSWERS:\n' + r.answers.map(a => '- ' + a).join('\n'));
    console.log('\n=== REQUEST ===\n' + r.user);
  }
} catch (e) { console.log('ERROR: app not reachable: ' + e.message); }
