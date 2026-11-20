// Sentence -> ideas. An idea is { concept, valence (-1..1), strength, via }.
// Tier 1: clause splitting + lexicon (instant, always on).
// Tier 2: local sentence embeddings (all-MiniLM-L6-v2 on CPU) for phrasing the lexicon
//         has never seen. Optional: loads in the background, no API key, no network after
//         the one-time model download.
// A later tier 3 (an LLM) only has to return the same idea objects.

import { CONCEPTS, TONE_ANCHORS } from './concepts.js';
import { toneOf } from '../public/tone.js';

const CONTRAST = /\s*,?\s*\b(?:but|however|although|though|yet|whereas|while|except|on the other hand|at the same time|then again)\b,?\s*/i;
const JOIN = /\s*,\s*(?:and\s+)?|\s+\band\b\s+|\s+\bor\b\s+|\s+\bplus\b\s+/i;
const wc = s => (s.match(/\S+/g) || []).length;

export function splitClauses(text) {
  const out = [];
  for (const sentence of text.split(/[.!?;\n]+/)) {
    const groups = sentence.split(CONTRAST).filter(s => s.trim());
    groups.forEach((group, gi) => {
      const parts = [];
      for (const p of group.split(JOIN).filter(s => s && s.trim())) {
        if (parts.length && (wc(p) < 3 || wc(parts[parts.length - 1]) < 3)) parts[parts.length - 1] += ' and ' + p;
        else parts.push(p);
      }
      parts.forEach((p, pi) => out.push({ text: p.trim(), contrast: pi === 0 && gi > 0, first: pi === 0 }));
    });
  }
  return out;
}

// ---------- embedding tier ----------
let extractor = null, seedVecs = null, toneVecs = null;
export const embeddingStatus = { state: 'off' };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
async function embed(texts) {
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist();
}
export async function initEmbeddings() {
  embeddingStatus.state = 'loading';
  try {
    const { pipeline } = await import('@huggingface/transformers');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' });
    seedVecs = [];
    for (const c of CONCEPTS) seedVecs.push({ id: c.id, vecs: await embed(c.seeds) });
    toneVecs = { hope: await embed(TONE_ANCHORS.hope), fear: await embed(TONE_ANCHORS.fear) };
    embeddingStatus.state = 'ready';
  } catch (e) {
    extractor = null;
    embeddingStatus.state = 'unavailable';
    embeddingStatus.error = String(e.message || e).slice(0, 200);
  }
}
const SIM_MIN = 0.36;

// ---------- main ----------
export async function interpretBatch(texts) {
  const answers = texts.map(t => splitClauses(t).map(c => {
    const hits = CONCEPTS.filter(k => k.kw.test(c.text.replace(/[’']/g, ''))).map(k => k.id);
    return { ...c, hits, own: toneOf(c.text).v, via: 'lexicon', sim: 0, embV: null };
  }));

  if (extractor && embeddingStatus.state === 'ready') {
    const need = answers.flat().filter(c => (!c.hits.length || c.own === null) && wc(c.text) >= 2);
    if (need.length) {
      const vecs = await embed(need.map(c => c.text));
      need.forEach((c, i) => {
        const v = vecs[i];
        if (!c.hits.length) {
          let best = null, bs = 0;
          for (const s of seedVecs) for (const sv of s.vecs) { const d = dot(v, sv); if (d > bs) { bs = d; best = s.id; } }
          if (bs >= SIM_MIN) { c.hits = [best]; c.via = 'embedding'; c.sim = bs; }
        }
        if (c.own === null) {
          const h = Math.max(...toneVecs.hope.map(t => dot(v, t))), f = Math.max(...toneVecs.fear.map(t => dot(v, t)));
          if (Math.abs(h - f) > 0.06) c.embV = h > f ? 0.7 : -0.7;
        }
      });
    }
  }

  return answers.map(clauses => {
    const ideas = new Map();
    let prev = null;
    const add = (concept, valence, strength, via, clause) => {
      const key = concept + (valence >= 0 ? '+' : '-');
      const old = ideas.get(key);
      if (!old || old.strength < strength) ideas.set(key, { concept, valence, strength, via, clause });
    };
    for (const c of clauses) {
      const inherited = !c.contrast && prev !== null ? prev : null;
      if (c.hits.length) {
        for (const id of c.hits) {
          const native = CONCEPTS.find(k => k.id === id).pol;
          const v = c.own ?? inherited ?? native;
          const strength = c.via === 'embedding' ? Math.min(1, 0.5 + (c.sim - SIM_MIN) * 2.5) : (c.hits.length > 2 ? 0.8 : 1);
          add(id, v === 0 ? native : v, strength, c.via, c.text);
        }
        prev = c.own ?? inherited ?? prev;
      } else {
        const v = c.own ?? c.embV ?? inherited;
        if (v !== null && Math.abs(v) >= 0.3) add(v > 0 ? 'hope' : 'dread', v, 0.7, c.own !== null ? 'tone' : 'embedding', c.text);
        prev = c.own ?? inherited ?? prev;
      }
    }
    // Every accepted answer leaves a mark: if nothing was understood, it becomes a new star.
    if (!ideas.size) return [{ concept: 'star', valence: 0, strength: 1, via: 'fallback', clause: clauses[0]?.text || '' }];
    return [...ideas.values()];
  });
}
