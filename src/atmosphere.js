// Nine feelings in, the atmosphere out: the numbers the display uses for weather and colour, and that every
// element reads (as m) to show its own wear and flourishing. Change the look of a mood here.
//   recent = the feelings of the last few batches, total = the whole session so far (both { feeling: 0..1 })
//   answers = how many answers the session has had
import { F } from './prompt.js';
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

export function atmosphereFrom(recent, total, phase, magnitude, answers = 100) {
  const k = ({ final: 0.15, settling: 0.3 })[phase] ?? 0.65;       // settle toward the whole journey at the end
  const a = Object.fromEntries(F.map(f => [f, k * recent[f] + (1 - k) * total[f]]));
  const gain = 0.6 + magnitude, g = x => clamp(x * gain);
  const pos = (a.hope + a.wonder + a.belonging + a.agency) / 4, neg = (a.dread + a.anger + a.grief + a.unease) / 4;
  // Rain is the heaviest weather, so it waits to be earned: it reads mostly the whole session rather than the last
  // batch, ignores a mild or passing gloom (the 0.25 below), and builds in over the first twenty or so answers.
  const s = Object.fromEntries(F.map(f => [f, 0.3 * recent[f] + 0.7 * total[f]]));
  const gloom = s.grief + s.dread * 0.35 - s.hope * 0.4 - s.wonder * 0.2 - 0.25;
  return {
    decay: g((a.grief + a.dread + a.anger) * 0.62 + a.unease * 0.2 - (a.hope + a.agency) * 0.3),
    bloom: g((a.hope + a.wonder + a.belonging + a.agency) * 0.5 - neg * 0.5),
    light: clamp(0.6 + gain * ((a.hope + a.wonder) * 0.35 - (a.dread + a.grief) * 0.45 - a.unease * 0.15), 0.3, 1),   // never so dark it cannot be read
    warmth: clamp(gain * ((a.hope + a.belonging) * 0.9 - (a.dread + a.unease) * 0.8 - a.grief * 0.4), -1, 1),
    storm: g(a.anger * 0.8 + a.dread * 0.5 + a.urgency * 0.4 - a.hope * 0.2),
    rain: g(gloom * 1.3) * clamp((answers - 6) / 14),
    mist: g(a.unease + a.grief * 0.25), wind: g(a.urgency * 0.9 + a.anger * 0.4),
    tension: g(a.anger * 0.9 + a.urgency * 0.5 + a.dread * 0.3),
    wonder: g(a.wonder * 1.1 + a.hope * 0.2), bond: g(a.belonging * 1.2 + a.hope * 0.2),
    val: clamp((pos - neg) * 2 * gain, -1, 1),
  };
}
