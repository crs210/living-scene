// Prints how each example answer is interpreted and what it does to the world,
// without a server or display. Usage: node tools/examples.js ["your own sentence" ...]
//   NO_EMBED=1 skips the embedding tier.
import { interpretBatch, initEmbeddings, embeddingStatus } from '../src/interpret.js';
import { createWorld, mergeIdeas, decay, snapshot } from '../src/world.js';
import { filterSubmission } from '../src/filter.js';
import { BY_ID } from '../src/concepts.js';

const answers = process.argv.length > 2 ? process.argv.slice(2) : [
  'Honestly I just have a bad feeling about where this ends up',
  'I worry hackers will use it to break into everything, but I hope it helps people understand each other',
  'Cybersecurity. Every lock we rely on is going to fail',
  'Excited about curing diseases, though my kids may never find jobs',
  // open phrasing the lexicon has never seen (needs the embedding tier)
  'My grandkids will grow up unable to tell a photograph from a forgery',
  'Somebody is always looking over my shoulder now',
];
if (!process.env.NO_EMBED) await initEmbeddings();
console.log(`interpreter: lexicon${embeddingStatus.state === 'ready' ? ' + local embeddings' : ` only (embeddings ${embeddingStatus.state})`}\n`);

const world = createWorld();
for (const raw of answers) {
  const f = filterSubmission(raw);
  console.log(`"${raw}"`);
  if (!f.ok) { console.log(`   filtered: ${f.reason}\n`); continue; }
  const t0 = performance.now();
  const ideas = (await interpretBatch([f.text]))[0];
  const ms = performance.now() - t0;
  mergeIdeas(world, ideas);
  const s = snapshot(world, { n: 0, val: 0, energy: 0 });
  for (const i of ideas) {
    const tr = i.concept === 'star' ? 'a new star (not understood, still leaves a mark)' : BY_ID[i.concept].treatment;
    console.log(`   ${i.valence > 0 ? 'hope' : i.valence < 0 ? 'fear' : '    '}  ${i.concept.padEnd(13)} via ${i.via.padEnd(9)} "${i.clause}"\n         -> ${tr}${i.concept !== 'star' ? `  (depth now ${s[i.concept].toFixed(2)})` : ''}`);
  }
  console.log(`   mood ${s.val.toFixed(2)}  tension ${s.tension.toFixed(2)}   [${ms.toFixed(1)} ms]\n`);
  decay(world, 8);
}
