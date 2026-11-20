// Test-session director, step 1: wait for the next piece of work from the running app.
//   node tools/director-wait.js [waitSeconds=540] [--save <file>] [port=3000]
// Prints what kind of request it is and the new answers. With --save, writes the full prompt
// (system prompt, then "=== REQUEST ===", then the request) to a file for a stand-in model to read.
import fs from 'node:fs';
const args = process.argv.slice(2), si = args.indexOf('--save'), save = si >= 0 ? args[si + 1] : null;
const nums = args.filter((a, i) => /^\d+$/.test(a) && i !== si + 1).map(Number), wait = nums[0] ?? 540, port = nums[1] ?? 3000;
try {
  const r = await (await fetch(`http://localhost:${port}/api/director/next?wait=${wait}`)).json();
  if (r.kind === 'idle') console.log('IDLE: no answers arrived.');
  else if (r.kind === 'none') console.log('NONE: ' + r.reason);
  else {
    if (save) fs.writeFileSync(save, r.system + '\n\n=== REQUEST ===\n' + r.user);
    console.log(`KIND: ${r.kind}`);
    if (r.answers) console.log('ANSWERS:\n' + r.answers.map(a => '- ' + a).join('\n'));
    if (!save) console.log('\n' + r.user);
  }
} catch (e) { console.log('ERROR: app not reachable: ' + e.message); }
