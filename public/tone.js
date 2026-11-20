// Tiny tone lexicon shared by the phone (draft tone cues, computed on-device)
// and the server (per-clause hope/fear). Words never leave the phone for drafts:
// only the numbers returned by toneOf() do.

const FEAR_PREFIX = ['worr', 'afraid', 'scare', 'scary', 'fear', 'terrif', 'anxi', 'dread', 'danger', 'threat',
  'risk', 'losing', 'concern', 'nervous', 'doom', 'destroy', 'harm', 'creep', 'uneas', 'steal', 'stolen', 'misus',
  'weapon', 'kill', 'horr', 'depress', 'unsettl', 'frighten', 'alarm', 'troubl', 'bother', 'suspicio', 'distrust',
  'fret', 'panic', 'nightmare', 'dystop', 'catastroph', 'exploit', 'helpless', 'powerless', 'obsolet'];
const FEAR_EXACT = ['bad', 'sad', 'lose', 'loses', 'loss', 'lost', 'hate', 'awful', 'worse', 'worst', 'grim', 'bleak'];
const HOPE_PREFIX = ['excit', 'hope', 'optimis', 'help', 'cure', 'improv', 'amazing', 'opportunit', 'benefit',
  'solv', 'empower', 'curious', 'joy', 'wonder', 'thrill', 'inspir', 'promis', 'easier', 'heal', 'thriv',
  'flourish', 'fascinat', 'eager', 'delight', 'grateful', 'breakthrough', 'possibilit', 'liberat', 'enthus'];
const HOPE_EXACT = ['love', 'better', 'great', 'good', 'best', 'happy', 'glad', 'forward', 'bright', 'fun', 'cool'];
const NEGATORS = new Set(['not', 'no', 'never', 'dont', 'doesnt', 'isnt', 'wont', 'cant', 'hardly', 'without', 'less', 'stop', 'stops']);

const hit = (w, prefixes, exact) => exact.includes(w) || prefixes.some(p => w.startsWith(p));

export function toneOf(text) {
  const words = String(text).toLowerCase().replace(/[’']/g, '').match(/[a-z]+/g) || [];
  let hope = 0, fear = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let h = hit(w, HOPE_PREFIX, HOPE_EXACT), f = hit(w, FEAR_PREFIX, FEAR_EXACT);
    if (!h && !f) continue;
    // "can't wait" is hope, not a negation
    if (w === 'forward' && words[i - 1] !== 'look' && words[i - 1] !== 'looking') continue;
    const negated = [words[i - 1], words[i - 2], words[i - 3]].some(p => NEGATORS.has(p));
    if (negated) [h, f] = [f, h];
    if (h) hope++;
    if (f) fear++;
  }
  const bangs = (String(text).match(/!/g) || []).length;
  return {
    v: hope + fear ? (hope - fear) / (hope + fear) : null, // -1 fear .. +1 hope, null = no signal
    energy: Math.min(1, (hope + fear + bangs) / 3),
  };
}
