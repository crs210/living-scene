// The fast speed: what the app can tell about an answer by itself, with no model, the second it arrives.
// Deliberately crude and self-limiting. The director's own reading replaces all of it a few seconds later.
import { toneOf } from '../public/tone.js';

const STOP = new Set(('the and for with that this they them will would could should have has are was were not but you your our its from about more most very just really again think worried worry excited make makes made get gets going where what when all any can too much many lot lots some'
  + ' future people world thing things stuff everyone everything something like feel maybe also dont who how why than then there their still even').split(' '));
// the significant words of a text, lightly stemmed ("jobs" and "job" match; "data-centres" becomes data + centre)
export const words = s => String(s).toLowerCase().replace(/[^a-z0-9 -]/g, ' ').split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/ies$/, 'y').replace(/s$/, ''));

// Does this answer plainly repeat one of the themes already in play? Every word of the theme's key must be in it.
export function matchTheme(text, themeKeys) {
  const ws = new Set(words(text)); let best = null, n = 0;
  for (const key of themeKeys) { const kw = words(key); if (kw.length > n && kw.every(w => ws.has(w))) { best = key; n = kw.length; } }
  return best;
}

// Do two answers say the same thing? Either every significant word of a short one (one or two words) is in the
// other ("jobs" and "robots taking our jobs"), or they share at least half of all their words between them.
export function sameAnswer(a, b) {
  const A = new Set(words(a)), B = new Set(words(b)); if (!A.size || !B.size) return false;
  let both = 0; for (const w of A) if (B.has(w)) both++;
  return both > 0 && ((both === Math.min(A.size, B.size) && Math.min(A.size, B.size) <= 2) || both / (A.size + B.size - both) >= 0.5);
}

// A first guess at which feelings an answer leans toward, from its wording alone: { v: -1..1, lean: { feeling: 0..1 } }
export function leanOf(text) {
  const tone = toneOf(text) || {}, v = tone.v || 0, e = tone.energy || 0;
  return { v, lean: { hope: Math.max(0, v), dread: Math.max(0, -v) * 0.8, unease: Math.max(0, -v) * 0.5, urgency: e * 0.4 } };
}
