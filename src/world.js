// The persistent world. Two timescales per motif:
//   mass   - cumulative, never decays on its own: the scene's memory (doors stay open).
//   recent - decays with a ~20 s half-life: where the room's attention is now (the lighting).
// The display only ever receives the full latest state, never deltas, so any number of
// intermediate states can be skipped without the picture getting lost.

import { CONCEPTS, BY_ID } from './concepts.js';

export function createWorld({ K = 4, halfLife = 20 } = {}) {
  const motifs = {};
  for (const c of CONCEPTS) motifs[c.id] = { mass: 0, recent: 0, n: 0 };
  return { K, halfLife, motifs, stars: 0, hopeRecent: 0, fearRecent: 0, rate: 0, answers: 0 };
}

export function mergeIdeas(world, ideas) {
  const agg = new Map(); // one visual event per concept+polarity per snapshot
  for (const idea of ideas) {
    const { concept, valence: v, strength: s } = idea;
    if (concept === 'star') { world.stars++; bump(agg, 'star', 0); continue; }
    const m = world.motifs[concept], native = BY_ID[concept].pol;
    if (v * native >= 0) {
      m.mass += s; m.recent += s; m.n++;
    } else {
      // An opposing view of the same subject: ease that motif back a little and
      // feed the general mood on the other side instead of erasing history.
      m.mass = Math.max(0, m.mass - 0.5 * s);
      const g = world.motifs[v > 0 ? 'hope' : 'dread'];
      g.mass += 0.5 * s; g.recent += 0.5 * s;
    }
    world.hopeRecent += Math.max(0, v) * s;
    world.fearRecent += Math.max(0, -v) * s;
    bump(agg, concept, v);
  }
  world.rate += ideas.length;
  return [...agg.values()];
}
function bump(agg, c, v) {
  const key = c + (v > 0 ? '+' : v < 0 ? '-' : '0');
  const e = agg.get(key) || { c, v: Math.sign(v), n: 0 };
  e.n++; agg.set(key, e);
}

export function decay(world, dt) {
  const k = Math.pow(0.5, dt / world.halfLife);
  for (const id in world.motifs) world.motifs[id].recent *= k;
  world.hopeRecent *= k; world.fearRecent *= k;
  world.rate *= Math.pow(0.5, dt / 3);
}

// Flat numeric targets for the renderer.
export function snapshot(world, drafts) {
  const t = {};
  let maxRecent = 0.75;
  for (const id in world.motifs) maxRecent = Math.max(maxRecent, world.motifs[id].recent);
  for (const id in world.motifs) {
    const m = world.motifs[id];
    t[id] = 1 - Math.exp(-m.mass / world.K);          // structure: deepens with repeats, saturates
    t[id + '_e'] = 0.45 + 0.55 * (m.recent / maxRecent); // emphasis: follows current attention
  }
  const h = world.hopeRecent, f = world.fearRecent;
  t.val = (h - f) / (h + f + 1.5);
  t.tension = f / (h + f + 2);
  t.wind = Math.min(1, world.rate / 12 + t.pace * 0.7 + drafts.n * 0.04 + drafts.energy * 0.15);
  t.typing = drafts.n;
  t.dval = drafts.val;
  t.stars = world.stars;
  return t;
}
