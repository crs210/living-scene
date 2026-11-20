// The director: turns batches of audience answers into a changing comic panel, as code.
//
// What Claude decides                          What the app does with it
//   feelings in this batch (nine of them)   ->  blended into the room's atmosphere: light, colour,
//                                               weather, wear and bloom across the whole panel
//   ideas: which THEME each answer belongs to -> a running tally. An element's weight (p.w) follows
//                                               its theme's share of the room, so repeated ideas grow
//                                               by themselves and passing remarks shrink and are pruned
//   set / add / remove                       ->  eased, grown in, faded out
//   note: one line on what the picture says  ->  kept as the journey and fed back next time
//
// The session moves through phases: upheaval (answers overturn the opening), building,
// settling (weights sharpen toward what dominates), final (one composed image, held).
//
// Modes: API (ANTHROPIC_API_KEY), session (no key: requests queue for a Claude Code session via
// tools/director-wait.js and director-reply.js), recorded (DIRECTOR_RECORDED=1).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BASE, REACT, NEWSTARS } from './comic-library.js';

export const FEELINGS = {
  hope: 'things could turn out well', dread: 'fear of what is coming', wonder: 'awe, excitement, curiosity',
  anger: 'outrage, unfairness, resentment', grief: 'loss, sadness, missing what is going',
  belonging: 'connection, togetherness, care', agency: 'feeling capable, empowered, free to act',
  unease: 'doubt, mistrust, mixed feelings, not knowing', urgency: 'speed, pressure, overwhelm',
};
const F = Object.keys(FEELINGS);
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const MAX_ARRIVALS = 14;               // elements beyond the opening; the weakest theme gives way after that

const KIT_DOC = `HOW THE PICTURE IS MADE
The picture is a list of elements: { id, theme, layer, desc, code, params }.
"code" is the BODY of a JavaScript function (k, p, t, m), run every frame on a 1600 x 900 canvas (x right, y down).
  p = this element's own numbers, eased toward their latest values; they start at 0 when an element is new, so it grows in.
  p.w = SUPPLIED BY THE APP for every element that has a theme: 0..1, how much of the room is behind that theme right now.
        It rises by itself each time the theme is repeated and falls as the room moves on. Your code MUST use it for scale
        and prominence: at p.w 0.2 the thing is a modest presence, at p.w 1 it dominates the frame.
  t = seconds, for motion.
  m = the room's atmosphere, the same for every element (0..1 unless noted): m.decay run-down, m.bloom flourishing,
      m.light brightness (0.6 neutral), m.warmth -1 cold..+1 warm, m.storm, m.wind, m.bond people gathering, m.tension.
  k = the ONLY drawing API. It inks and prints everything in one comic style. Rain, mist, colour grading and grain are added
      over the whole panel automatically from the atmosphere: never draw those yourself.
    k.shape(points, fill, {lw, curve, a})  closed polygon; points [[x,y],...]; lw ink width (default 4, 0 none); curve:true smooths
    k.rect(x, y, w, h, fill, opts)   k.blob(x, y, rx, ry, fill, opts)   k.line(points, lw, colour, {a, curve})
    k.dots(points, colour, size, gap, {fade:'up'|'down', a})  halftone screen clipped to a polygon
    k.hatch(points, colour, gap)   k.glow(x, y, r, colour, a)   k.burst(x, y, rOuter, rInner, spikes, fill, opts)
    k.alpha(a, function () { ... })  group opacity
    Ready-made: k.figure(x, y, heightPx, coat, {walk: phase, sit, arms, bowed, hair})   k.tree(x, y, heightPx, {bare, bloom, leaf, flower, sway, seed})
      k.cloud(x, y, width, fill, {dark})   k.smoke(x, y, amount, colour, t, wind)   k.sparkle(x, y, r, colour)
      k.crack(x, y, length, seed)   k.boards(x, y, w, h)   k.scribble(x, y, w, h, colour, seed)
      k.building(xCentre, yGround, w, h, colour, {lit: 0..1, boarded: 0..1, cracks: 0..1, roof: 'flat', door: false, seed})  windows, door, roof, shaded side
      k.fence(x1, yGround, x2, height, colour, {gap, broken: 0..1})   k.rope(x1, y1, x2, y2, sag, lw, colour, {links: true})  cable or chain
      k.wave(yCrest, amplitude, wavelength, t, fill, {speed})  a band of water or hills across the frame
      k.eye(x, y, halfWidth, {look: [dx, dy], lid: 0..1, iris})   k.hand(x, y, size, angleRadians, colour, {closed: 0..1, sleeve})
      k.flame(x, y, size, t)   k.gear(x, y, r, teeth, fill, angle)   k.stairs(x, yBottom, w, h, steps, colour)   k.flock(x, y, spread, count, t)
    Prefer these to hand-building the same thing; spend your lines on what makes the idea specific.
    Maths: k.clamp(x, 0, 1)   k.lerp(a, b, u)   k.mix('#hex', '#hex', u)   k.rand(n) stable 0..1
Code rules: plain ES5 (var, function, for loops with fixed bounds); only k, p, t, m and Math; no "while", no globals; colours '#rrggbb';
single quotes for strings. Aim for 15 to 35 lines per element. Layers: 0 backdrop .. 9 nearest foreground. Ink #15111c, paper #fbf6e9.
Keep one bold palette of 5 to 7 flat colours for the whole scene.`;

const SYSTEM = `You are the art director and cartoonist of ONE continuous comic-book panel, projected to a live audience. The audience answers an open question on their phones and the panel changes while they watch. The aim is "a picture paints a thousand words": the picture travels with how the room feels, is visibly overturned by what people say, and by the end settles into a single image that holds their collective answer. You never restart: you maintain one living shot.

${KIT_DOC}

THE STATE-OF-REPAIR RULE
Every element carries its own response to the atmosphere, in a way native to the thing and the setting. As m.decay rises it wears (broken, boarded, cracked, bare, toppled, overgrown, scrawled-on, dimmed); as m.bloom rises it thrives (mended, lit, painted, leafed, flowering, busy). m.storm and m.wind bend what can bend; m.bond gathers figures.
This applies to elements you add later as much as to the opening. Start every element with "var d = m.decay, b = m.bloom;" and make BOTH change what is drawn, not just its colour: one thing that appears or breaks as d rises, one that appears or mends as b rises.

THE NINE FEELINGS
${F.map(f => `  ${f}: ${FEELINGS[f]}`).join('\n')}
Report how strongly each is present in the batch, 0..1. They are not opposites; a room can hold several at once.

THEMES (how repetition works)
Sort every answer into a theme: a short lowercase key for the underlying idea ("jobs", "being-watched", "family-time"). REUSE an existing key whenever an answer is about the same thing in different words; only coin a new key for a new idea. Keep themes broad: "wherever my kids are", "loud and full of cousins" and "people, not a place" are ONE theme. A whole session should end with five to eight themes, not twenty. Report each theme touched and how many answers in the batch voiced it. The app tallies them and feeds each theme's share back to its elements as p.w, so the tenth person to say a thing makes it loom without you redrawing it. Give every element you add the theme it serves. When a batch holds more ideas than you may draw, draw the ones most people voiced, whether they are hopeful or not; do not spend the allowance on the pleasant ones.

TURNING THOUGHTS INTO PICTURES
The setting is a stage, not a cage. Ask of each idea: what would have to HAPPEN to this place for a stranger to feel that? Then draw the event, big.
  a named thing (data centres, a hospital, a fence): it arrives as itself, at a scale that matters, and does something to its surroundings.
  a bare feeling ("scary", "exciting"): no new object. Change weather, light, the state of repair, what crowds do; deepen themes already present.
  an opinion or judgement ("nobody asked us"): show the act it implies. People shut outside a gate; a decision made in a lit room they cannot enter.
  a question or doubt ("who is in charge?"): show the absence. An empty seat at the controls; a signpost pointing every way; a door with no handle.
  a memory or loss ("my grandad would have loved it"): show the trace. An empty chair kept at the table; the outline where something stood.
  a contradiction ("lovely and sad"): show both at once in one object. A window warm inside, raining outside.
  a prediction ("we will adapt"): show the place mid-change. New growth through old cracks; scaffolding turning into something lived in.
  a process ("always rushing to catch up"): show the mechanism. A road that lengthens ahead of the walker; a tide outpacing people on the sand.
Reach for these, not for a small person performing the idea: scale shifts, architecture that changes, ground that splits or rises, light sources, things tethered or cut loose, shadows and reflections that disagree with their owners, things out of place, things half-built or half-buried, paths, thresholds, horizons.
At most one new element per batch may be mainly a figure. Never solve two ideas the same way. No lettering, captions, icons or floating symbols.

SIZE
This is a projector. A new element at p.w 1 should span a third of the frame or more; even at p.w 0.2 it must be at least 120 pixels across. Put it where it reads, in front of anything that would hide it.

OPENING SHOT (when asked)
The opening is only where the picture starts; within a few batches the audience should have overturned it. So make a stage: a specific place seen from a specific spot, with a clear horizon, three or four LARGE simple landmarks, open ground where things can arrive, and quiet life. Do not pre-load it with imagery that already answers the question. Return 6 to 8 elements with no theme. Give each landmark one or two numbers that could later transform it (not just dim it). In each "desc" (under 240 characters) say what it is, where it sits in canvas coordinates, and what its numbers mean.

EACH BATCH
You are told the PHASE and the two controls, ABSTRACTION and MAGNITUDE; follow them. Look first at what exists: deepen a present theme through its elements' numbers; connect new ideas to old ones (the pipe that drains the sea runs from the building someone else asked for). You may rewrite any element, including opening landmarks, by returning its id with new code, and remove elements the room has left behind. New element "desc" under 200 characters: what, where, what its numbers mean. End with a "note": one plain sentence on what the whole picture now says.

FINAL IMAGE (when asked)
No new ideas. Compose one balanced picture: what the room felt most is largest and clearest, passing remarks are removed, unfinished things resolve, and the numbers come to rest.

REPLY FORMAT: only JSON.
{ "feelings": { ${F.map(f => `"${f}": 0`).join(', ')} },
  "ideas": [ { "theme": "key", "n": 1, "gist": "five words" } ],
  "set": [ { "id", "params": [ { "name", "value" } ] } ],
  "add": [ { "id", "theme", "layer", "desc", "code", "params": [ { "name", "value" } ] } ],
  "remove": [ "id" ],
  "note": "..." }
Lists may be empty. For an opening shot only "add" and "note" matter.`;

const abstractionText = a => a < 0.25 ? 'LITERAL. Show what people name as itself, at believable scale; feelings appear through weather, light, repair and what crowds do.'
  : a < 0.6 ? 'GROUNDED METAPHOR. Ideas become things that could almost happen in this place.'
  : a < 0.85 ? 'POETIC. Let scale, gravity and logic bend: things far too large, floating, growing where they should not, merging; the place stays recognisable.'
  : 'DREAMLIKE. The place is a dream of itself. Impossible and symbolic transformations are welcome; keep just enough landmarks to know it is the same shot.';
const PHASE_TEXT = {
  upheaval: 'EARLY. The calm opening is only a starting point: let these answers hit hard. Transform or replace opening landmarks, change the lay of the land, let large things arrive. The audience should see their words overturn the picture. In this reply at least one of your elements must be an OPENING landmark rewritten (same id, new code, give it the theme that changed it) so that the place itself is altered, not just added to.',
  building: 'MIDDLE. The picture has a direction. Reinforce what the room keeps returning to: move it centre, connect themes to each other. New themes enter at modest size until repeated.',
  settling: 'LATE. Converge. No new themes unless several answers demand one. Clarify what dominates, let minor things recede, resolve unfinished business.',
};

export function createDirector({ question: q0 }) {
  let question = q0;
  const order = [];                              // recorded mode only
  const live = new Map();                        // id -> element
  const themes = new Map();                      // key -> { count, born, last, gist }
  const settings = { abstraction: 0.5, magnitude: 0.5 };
  let settleNow = false, isFinal = false, endsAt = 0, startedAt = 0, batchNo = 0;
  let journal = [], answersSeen = 0, concepts = [], chosen = null, issuedCap = 0;
  const zero = () => Object.fromEntries(F.map(f => [f, 0]));
  let recent = zero(), total = zero(), weight = 0;
  let latest = null, busy = false, queue = [], wantFinal = false, wantConcepts = false, client = null, formats = null, lastError = null, calls = [], opening = false, waiter = null, inFlight = 0;

  const model = process.env.DIRECTOR_MODEL || 'claude-sonnet-5-5';
  const MOCK = !!process.env.DIRECTOR_MOCK;      // exercise the API-mode plumbing with canned replies and delays, no network
  const hasKey = () => !!process.env.ANTHROPIC_API_KEY || MOCK;
  const recorded = () => !hasKey() && !!process.env.DIRECTOR_RECORDED;
  const sessionMode = () => !hasKey() && !recorded();
  const mode = () => recorded() ? 'recorded demo' : (hasKey() ? 'Claude (' + model + ')' : 'Claude (test session)') + (live.size ? '' : ', waiting for an opening shot');
  const wake = () => { if (waiter) { const w = waiter; waiter = null; w(); } };
  const cacheFile = () => path.join(process.cwd(), '.cache', 'opening-v2-' + crypto.createHash('sha1').update(question + (chosen ? '|' + chosen.title : '')).digest('hex').slice(0, 10) + '.json');
  const loadOpening = () => { try { for (const e of JSON.parse(fs.readFileSync(cacheFile(), 'utf8'))) live.set(e.id, { ...structuredClone(e), theme: null, opening: true }); } catch {} };
  loadOpening();

  function phase() {
    if (isFinal) return 'final';
    if (endsAt) { const f = (Date.now() - startedAt) / (endsAt - startedAt); return f < 0.35 ? 'upheaval' : f < 0.8 ? 'building' : 'settling'; }
    return settleNow ? 'settling' : answersSeen < 10 ? 'upheaval' : 'building';
  }
  const effMag = () => clamp(settings.magnitude * ({ upheaval: 1.35, building: 1, settling: 0.5, final: 0.3 })[phase()]);
  const maxAdd = (n = 0) => phase() === 'settling' ? 1 : Math.min(5, Math.round(1 + effMag() * 3) + (n >= 8 ? 1 : 0));   // a big batch earns one more

  // ---- themes: repetition is what makes something big ----
  function weights() {
    let max = 1; for (const t of themes.values()) max = Math.max(max, t.count);
    const g = ({ final: 1.5, settling: 1.5 })[phase()] || 1, out = {};
    for (const [k, t] of themes) { let w = Math.pow(t.count / max, g); if (batchNo - t.born <= 1 && phase() !== 'final') w = Math.max(w, 0.4); out[k] = clamp(w, phase() === 'final' ? 0.28 : 0.1, 1); }
    return out;
  }
  function prune() {
    const w = weights(), arrivals = [...live.values()].filter(e => e.theme && e.born < batchNo);
    const floor = ({ settling: 0.16 })[phase()] || 0, removed = [];   // in the final image the director's own choices stand
    arrivals.sort((a, b) => (w[a.theme] ?? 0) - (w[b.theme] ?? 0));
    let extra = [...live.values()].filter(e => e.theme).length - MAX_ARRIVALS;
    for (const e of arrivals) if (extra > 0 || (w[e.theme] ?? 0) < floor) { live.delete(e.id); removed.push(e.id); extra--; }
    return removed;
  }

  // ---- atmosphere: nine feelings -> the drivers the renderer and every element read ----
  function atmosphere() {
    const k = ({ final: 0.15, settling: 0.3 })[phase()] ?? 0.65;       // settle toward the whole journey at the end
    const a = Object.fromEntries(F.map(f => [f, k * recent[f] + (1 - k) * total[f]]));
    const gain = 0.6 + settings.magnitude, g = x => clamp(x * gain);
    const pos = (a.hope + a.wonder + a.belonging + a.agency) / 4, neg = (a.dread + a.anger + a.grief + a.unease) / 4;
    return {
      decay: g((a.grief + a.dread + a.anger) * 0.62 + a.unease * 0.2 - (a.hope + a.agency) * 0.3),
      bloom: g((a.hope + a.wonder + a.belonging + a.agency) * 0.5 - neg * 0.5),
      light: clamp(0.6 + gain * ((a.hope + a.wonder) * 0.35 - (a.dread + a.grief) * 0.45 - a.unease * 0.15), 0.3, 1),   // never so dark it cannot be read
      warmth: clamp(gain * ((a.hope + a.belonging) * 0.9 - (a.dread + a.unease) * 0.8 - a.grief * 0.4), -1, 1),
      storm: g(a.anger * 0.8 + a.dread * 0.5 + a.urgency * 0.4 - a.hope * 0.2),
      rain: g(a.grief + a.dread * 0.35 - a.hope * 0.3 - a.wonder * 0.2),
      mist: g(a.unease + a.grief * 0.25), wind: g(a.urgency * 0.9 + a.anger * 0.4),
      tension: g(a.anger * 0.9 + a.urgency * 0.5 + a.dread * 0.3),
      wonder: g(a.wonder * 1.1 + a.hope * 0.2), bond: g(a.belonging * 1.2 + a.hope * 0.2),
      val: clamp((pos - neg) * 2 * gain, -1, 1),
    };
  }
  function feel(f, n) {
    if (!f) return;
    const step = (0.35 + 0.45 * settings.magnitude) * (0.5 + 0.5 * (1 - Math.exp(-Math.max(1, n) / 3)));
    for (const x of F) { const b = clamp(Number(f[x]) || 0); recent[x] += (b - recent[x]) * step; total[x] = (total[x] * weight + b * n) / (weight + n); }
    weight += n;
  }

  function scene(world, snap) {
    if (!recorded()) {
      const w = weights();
      const els = [...live.values()].map(e => e.theme && w[e.theme] !== undefined ? { ...e, params: { ...e.params, w: w[e.theme] } } : e);
      return { mode: mode(), latest, els, m: atmosphere(), phase: phase(), settings, waiting: queue.length + inFlight, note: journal.at(-1)?.note || '', concepts, chosen: chosen?.title || null,
        themes: [...themes].map(([k, t]) => ({ key: k, count: t.count, w: +w[k].toFixed(2), gist: t.gist })).sort((a, b) => b.count - a.count) };
    }
    const els = BASE.map(e => ({ ...e, base: true, params: { ...e.params } }));
    for (const id of Object.keys(REACT)) if (world.motifs[id].mass > 0 && !order.includes(id)) { order.push(id); latest = REACT[id].id; }
    for (const id of order) { const { from, ...e } = REACT[id]; els.push({ ...e, params: from(snap[id], snap[id + '_e']) }); }
    if (world.stars > 0) els.push({ ...NEWSTARS, params: { count: world.stars } });
    if (order.includes('jobs')) els.find(e => e.id === 'walkers').params.humans = 6 - snap.jobs * 6;
    return { mode: mode(), latest, els, m: { val: snap.val, tension: snap.tension, wind: snap.wind }, phase: 'gathering', settings };
  }

  // ---- the exact text sent to the model ----
  const top = a => Object.entries(a).filter(e => e[1] > 0.08).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([f, v]) => `${f} ${v.toFixed(2)}`).join(', ') || 'none yet';
  function prompt(kind, answers = [], extra = null) {
    const abs = `ABSTRACTION ${settings.abstraction.toFixed(2)}: ${abstractionText(settings.abstraction)}`;
    if (kind === 'concepts') return { system: SYSTEM, user: `The question on screen will be:\n"${question}"\n\nBefore any drawing, propose FOUR different opening stages for the host to choose between. Make them really different in kind: one everyday and literal, one a metaphorical place, one unexpected or surreal, and one nearly empty stage that the audience will fill. Each needs a title (2 to 4 words), a pitch (one sentence: the place and the viewpoint) and "room" (one sentence: what kinds of answers could arrive, break, grow or gather there).\nReturn only JSON: { "concepts": [ { "title", "pitch", "room" } ] }` };
    if (kind === 'open') return { system: SYSTEM, user: `The question on screen is:\n"${question}"\n\n${chosen ? `The host chose this opening stage:\n${chosen.title}: ${chosen.pitch}\n\n` : ''}${abs}\n\nWrite the opening shot.` };
    const w = weights();
    const els = [...live.values()].map(e => `- ${e.id}${e.theme ? ` [theme ${e.theme}, w ${(w[e.theme] ?? 0).toFixed(2)}]` : ' [opening]'} (layer ${e.layer}) ${JSON.stringify(e.params)}: ${e.desc}`).join('\n');
    const th = [...themes].sort((a, b) => b[1].count - a[1].count).map(([k, t]) => `- ${k}: ${t.count} answer${t.count === 1 ? '' : 's'}, weight ${w[k].toFixed(2)} (${t.gist})`).join('\n') || '(none yet)';
    const story = journal.slice(-6).map((j, i) => `${i + 1}. ${j.note}`).join('\n') || '(nothing yet)';
    const head = `The question on screen is:\n"${question}"\n\nThe journey so far (${answersSeen} answers):\n${story}\nFeelings across the session: ${top(total)}\nFeelings lately: ${top(recent)}\n\nThemes so far:\n${th}\n\nElements in the scene now:\n${els}\n\n`;
    if (kind === 'final') return { system: SYSTEM, user: head + `${abs}\n\nThe session has ended. Compose the FINAL IMAGE.` };
    const n = maxAdd(answers.length), ph = phase();
    const pictured = new Set([...live.values()].map(e => e.theme).filter(Boolean));
    const owed = [...themes].filter(([k2, t]) => !pictured.has(k2) && t.count >= 2).sort((a, b) => b[1].count - a[1].count).map(([k2, t]) => `${k2} (${t.count})`).join(', ');
    const controls = `PHASE: ${PHASE_TEXT[ph] || PHASE_TEXT.building}\n${abs}\nMAGNITUDE ${effMag().toFixed(2)}: at most ${n} new or rewritten element${n === 1 ? '' : 's'} in this reply; move numbers ${effMag() < 0.3 ? 'by small steps' : effMag() < 0.7 ? 'by about a third of their range' : 'most of the way'}.${owed ? `\nOWED A PICTURE: these themes have been voiced more than once and still have no element: ${owed}. Draw them before anything voiced only once.` : ''}`;
    const list = `New answers in this batch (${answers.length}):\n${answers.map(a => `- ${a}`).join('\n')}`;
    if (kind === 'fast') return { system: SYSTEM, user: head + controls + '\n\n' + list + '\n\nFAST PASS: write no code and leave "add" empty. For each new or rewritten element you want, add a brief to a "draw" list: { "id", "theme", "layer", "brief" } where brief says what it is, where, how big, and what its numbers mean.' };
    if (kind === 'draw') return { system: SYSTEM, user: head + controls + '\n\n' + list + `\n\nDRAW PASS: write exactly ONE element, returned alone in "add", for this brief:\n${JSON.stringify(extra)}\nLeave every other list empty and all feelings 0.` };
    return { system: SYSTEM, user: head + controls + '\n\n' + list };
  }

  function apply(patch, { opening: isOpening = false, final = false, answers = 0, partial = false } = {}) {
    if (Array.isArray(patch.concepts)) { concepts = patch.concepts.slice(0, 5).map(c => ({ title: String(c.title || '').slice(0, 60), pitch: String(c.pitch || '').slice(0, 300), room: String(c.room || '').slice(0, 300) })); return { concepts: concepts.length }; }
    const obj = list => Array.isArray(list) ? Object.fromEntries(list.map(({ name, value }) => [String(name), Number(value) || 0])) : { ...(list || {}) };
    const out = { added: [], set: [], removed: [], pruned: [], rejected: [] };
    const n = answers || inFlight || 1;
    if (!isOpening && !partial) {
      batchNo++;
      for (const i of patch.ideas || []) {
        const key = String(i.theme || '').toLowerCase().trim().replace(/\s+/g, '-').slice(0, 40); if (!key) continue;
        const t = themes.get(key) || { count: 0, born: batchNo, gist: String(i.gist || key).slice(0, 60) };
        t.count += Math.max(1, Math.min(n, Number(i.n) || 1)); t.last = batchNo; themes.set(key, t);
      }
    }
    // Honour the allowance the director was told when the request went out, even if the phase has moved on since.
    const cap = isOpening ? 12 : final ? 3 : partial ? 1 : Math.max(maxAdd(n), issuedCap); issuedCap = 0;
    for (const a of (patch.add || []).slice(cap)) out.rejected.push((a?.id || '?') + ' (over the allowance of ' + cap + ')');
    for (const a of (patch.add || []).slice(0, cap)) {
      if (!a || typeof a.code !== 'string' || !a.id || a.code.length > 6000) { out.rejected.push(a?.id || '?'); continue; }
      const prev = live.get(a.id), key = a.theme ? String(a.theme).toLowerCase().trim().replace(/\s+/g, '-') : (prev?.theme ?? null);
      if (key && !themes.has(key)) themes.set(key, { count: 1, born: batchNo, last: batchNo, gist: key });
      const { w, ...params } = { ...(prev?.params || {}), ...obj(a.params) };
      live.set(a.id, { id: String(a.id), layer: Number(a.layer) || 0, desc: String(a.desc || '').slice(0, 400), code: a.code, params, theme: isOpening ? null : key, opening: isOpening || (prev?.opening && !key), born: prev?.born ?? batchNo });
      latest = a.id; out.added.push(a.id);
    }
    for (const s of patch.set || []) { const e = live.get(s.id); if (e) { const { w, ...ps } = obj(s.params); Object.assign(e.params, ps); out.set.push(s.id); } else out.rejected.push(s.id); }
    for (const id of patch.remove || []) if (live.delete(id)) out.removed.push(id);
    if (isOpening) { if (live.size) { try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify([...live.values()])); } catch {} } }
    else if (!partial) {
      feel(patch.feelings, n); if (!final) answersSeen += n;
      if (patch.note) journal.push({ note: String(patch.note).slice(0, 300), n });
      if (final) {
        isFinal = true;
        // Keep the finished session: the picture (as its elements), the journey, and the tally.
        try {
          const dir = path.join(process.cwd(), 'sessions'); fs.mkdirSync(dir, { recursive: true });
          const w = weights();
          fs.writeFileSync(path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify({ question, opening: chosen, answers: answersSeen, settings, journey: journal.map(j => j.note), themes: [...themes].map(([k, t]) => ({ theme: k, answers: t.count, weight: +w[k].toFixed(2), gist: t.gist })).sort((a, b) => b.answers - a.answers), feelings: total, atmosphere: atmosphere(), elements: [...live.values()] }, null, 1));
        } catch (e) { console.error('could not save session:', e.message); }
      }
      out.pruned = prune();
    }
    if (!partial) inFlight = 0;
    return out;
  }

  // ---- API mode: a fast pass (feelings, themes, numbers) lands first; drawings follow in parallel ----
  // Canned replies with realistic delays, to test batching and the fast-then-draw pipeline without a key.
  async function mock(kind, answers = [], extra) {
    const t0 = performance.now(), wait = ms => new Promise(r => setTimeout(r, ms)), n = calls.length;
    const blob = (id, theme, x) => ({ id, theme, layer: 5, desc: 'mock ' + id, code: "var d = m.decay, b = m.bloom; k.blob(" + x + ", 520, 40 + 160 * (p.w || 1), 40 + 120 * (p.w || 1), k.mix('#57c7c2', '#6f6a80', d), { lw: 5 }); if (b > 0.3) k.sparkle(" + x + ", 380, 20);", params: [] });
    let out;
    if (kind === 'concepts') { await wait(400); out = { concepts: [{ title: 'Mock stage', pitch: 'A flat field.', room: 'Anything.' }] }; }
    else if (kind === 'open') { await wait(1500); out = { add: [{ id: 'sky', layer: 0, desc: 'mock sky', code: "k.rect(0, 0, 1600, 900, k.mix('#27364f', '#7fb7c9', m.light), { lw: 0 });", params: [] }, { id: 'ground', layer: 1, desc: 'mock ground', code: "k.rect(0, 600, 1600, 300, '#6fa35a', { lw: 4 });", params: [] }], note: 'mock opening' }; }
    else if (kind === 'draw') { await wait(1800 + Math.random() * 800); out = { add: [blob(extra.id, extra.theme, 200 + (n * 170) % 1200)] }; }
    else { await wait(kind === 'fast' ? 500 : 900); const theme = 'theme-' + (answers.length % 3); out = { feelings: { ...zero(), hope: 0.4, unease: 0.3 }, ideas: [{ theme, n: answers.length || 1, gist: 'mock idea' }], set: [], add: [], draw: kind === 'fast' ? [{ id: 'm' + n, theme, layer: 5, brief: 'a blob' }, { id: 'n' + n, theme: 'theme-x', layer: 5, brief: 'another' }] : [], remove: [], note: 'mock note ' + n }; }
    calls.push({ kind, answers: answers.length, ms: Math.round(performance.now() - t0), mock: true });
    return out;
  }
  async function ask(kind, answers, extra) {
    if (MOCK) return mock(kind, answers, extra);
    if (!client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const { z } = await import('zod'); const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
      const P = z.array(z.object({ name: z.string(), value: z.number() }));
      formats = {
        patch: zodOutputFormat(z.object({
          feelings: z.object(Object.fromEntries(F.map(f => [f, z.number()]))),
          ideas: z.array(z.object({ theme: z.string(), n: z.number(), gist: z.string() })),
          set: z.array(z.object({ id: z.string(), params: P })),
          add: z.array(z.object({ id: z.string(), theme: z.string(), layer: z.number(), desc: z.string(), code: z.string(), params: P })),
          draw: z.array(z.object({ id: z.string(), theme: z.string(), layer: z.number(), brief: z.string() })),
          remove: z.array(z.string()), note: z.string(),
        })),
        concepts: zodOutputFormat(z.object({ concepts: z.array(z.object({ title: z.string(), pitch: z.string(), room: z.string() })) })),
      };
      client = new Anthropic();
    }
    const { system, user } = prompt(kind, answers, extra), t0 = performance.now();
    const res = await client.messages.parse({
      model, max_tokens: kind === 'open' ? 24000 : kind === 'fast' || kind === 'concepts' ? 3000 : 10000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],     // identical on every call, so it caches
      output_config: { format: kind === 'concepts' ? formats.concepts : formats.patch, effort: 'low' },
      messages: [{ role: 'user', content: user }],
    });
    calls.push({ kind, answers: answers?.length ?? 0, ms: Math.round(performance.now() - t0), out: res.usage?.output_tokens, cached: res.usage?.cache_read_input_tokens });
    if (res.stop_reason === 'refusal') { lastError = 'the model declined this request'; return null; }
    return res.parsed_output;
  }
  const guard = async (label, fn) => { try { await fn(); } catch (e) { lastError = `${label}: ${String(e.message || e).slice(0, 260)}`; console.error('director', lastError); } };
  async function open(done) {
    if (!hasKey() || opening || live.size) return;
    opening = true;
    await guard('opening', async () => { const p = await ask('open'); if (p) { apply(p, { opening: true }); done(); } });
    opening = false;
  }
  async function pump(done) {
    if (busy || !hasKey() || !live.size) return;
    busy = true;
    await guard('batch', async () => {
      while (queue.length || wantFinal) {
        if (queue.length && !isFinal) {
          const batch = queue.splice(0);
          const fast = await ask('fast', batch); if (!fast) continue;
          apply({ ...fast, add: [] }, { answers: batch.length }); done();
          await Promise.all((fast.draw || []).slice(0, maxAdd(batch.length)).map(d => guard('draw ' + d.id, async () => { const r = await ask('draw', batch, d); if (r?.add?.[0]) { apply({ add: [r.add[0]] }, { partial: true }); done(); } })));
        } else if (wantFinal) { wantFinal = false; const p = await ask('final'); if (p) { apply(p, { final: true }); done(); } }
        else queue.length = 0;
      }
    });
    busy = false;
  }
  // Answers arriving while a request is in flight wait and go together in the next batch.
  function onBatch(texts, done) {
    if (recorded() || isFinal) return;
    queue.push(...texts);
    if (sessionMode()) return wake();
    pump(done);
  }
  // session mode: hand the next piece of work to whoever is acting as director
  async function next(waitMs) {
    if (!sessionMode()) return { kind: 'none', reason: 'not in session mode' };
    if (wantConcepts) { wantConcepts = false; return { kind: 'concepts', ...prompt('concepts') }; }
    if (!live.size) return { kind: 'open', ...prompt('open') };
    if (!queue.length && !wantFinal) await new Promise(r => { waiter = r; setTimeout(r, waitMs); });
    if (wantConcepts) { wantConcepts = false; return { kind: 'concepts', ...prompt('concepts') }; }
    if (queue.length && !isFinal) { const answers = queue.splice(0); inFlight = answers.length; issuedCap = maxAdd(answers.length); return { kind: 'patch', answers, ...prompt('patch', answers) }; }
    if (wantFinal) { wantFinal = false; return { kind: 'final', ...prompt('final') }; }
    return { kind: 'idle' };
  }

  function clear() { order.length = 0; live.clear(); themes.clear(); latest = null; queue = []; calls = []; lastError = null; inFlight = 0; journal = []; answersSeen = 0; batchNo = 0; recent = zero(); total = zero(); weight = 0; settleNow = false; isFinal = false; endsAt = 0; wantFinal = false; }
  return {
    scene, prompt, apply, open, onBatch, next,
    tick(done) { if (endsAt && !isFinal && Date.now() > endsAt) { endsAt = 0; settleNow = true; wantFinal = true; sessionMode() ? wake() : pump(done); } },
    control(b, done) {
      if (typeof b.abstraction === 'number') settings.abstraction = clamp(b.abstraction);
      if (typeof b.magnitude === 'number') settings.magnitude = clamp(b.magnitude);
      if (b.start) { startedAt = Date.now(); endsAt = startedAt + Math.max(20, Number(b.start)) * 1000; settleNow = false; isFinal = false; }
      if (b.settle) settleNow = true;
      if (b.final) { wantFinal = true; sessionMode() ? wake() : pump(done); }
      if (typeof b.question === 'string' && b.question.trim() && b.question.trim() !== question) { question = b.question.trim().slice(0, 200); concepts = []; chosen = null; clear(); loadOpening(); }
      if (b.propose) { if (sessionMode()) { wantConcepts = true; wake(); } else guard('concepts', async () => { const p = await ask('concepts'); if (p) { apply(p); done(); } }); }
      if (b.concept !== undefined) {
        chosen = typeof b.concept === 'number' ? concepts[b.concept] || null : { title: String(b.concept).slice(0, 60), pitch: String(b.concept).slice(0, 300) };
        clear(); loadOpening(); if (!live.size) sessionMode() ? wake() : open(done);
      }
      return this.status();
    },
    question: () => question,
    status: () => ({ mode: mode(), model, question, phase: phase(), settings, effectiveMagnitude: effMag(), secondsLeft: endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null, answersSeen, concepts, chosen, themes: recorded() ? [] : scene().themes, feelings: { session: total, lately: recent }, atmosphere: atmosphere(), journal: journal.slice(-12), lastError, calls: calls.slice(-20), elements: [...live.values()].map(e => ({ id: e.id, theme: e.theme, layer: e.layer, params: e.params, chars: e.code.length, desc: e.desc })) }),
    reset(fresh) { clear(); if (fresh) { try { fs.unlinkSync(cacheFile()); } catch {} } else loadOpening(); },
  };
}
