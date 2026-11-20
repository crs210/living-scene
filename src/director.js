// The director: turns batches of audience answers into a changing comic panel, as code.
//
// What Claude decides                         What the app does with it
//   feelings in this batch (nine of them)  ->  blended into the room's atmosphere, which drives
//                                              light, colour, weather, wear and bloom everywhere
//   set: new numbers for elements          ->  eased, so the picture morphs
//   add: new elements as draw code         ->  grown in
//   remove: elements whose time has passed ->  faded out
//   note: one line on what the picture says->  kept as the journey, and fed back next time
//
// Modes: API (ANTHROPIC_API_KEY set), session (no key: requests queue for a Claude Code session
// to answer through tools/director-wait.js and director-reply.js), recorded (DIRECTOR_RECORDED=1).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BASE, REACT, NEWSTARS } from './comic-library.js';

export const FEELINGS = {
  hope: 'things could turn out well',
  dread: 'fear of what is coming',
  wonder: 'awe, excitement, curiosity',
  anger: 'outrage, unfairness, resentment',
  grief: 'loss, sadness, missing what is going',
  belonging: 'connection, togetherness, care',
  agency: 'feeling capable, empowered, free to act',
  unease: 'doubt, mistrust, mixed feelings, not knowing',
  urgency: 'speed, pressure, overwhelm',
};
const F = Object.keys(FEELINGS);
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;

const KIT_DOC = `HOW THE PICTURE IS MADE
The picture is a list of elements. Each element is { id, layer, desc, code, params }.
"code" is the BODY of a JavaScript function (k, p, t, m) that runs every frame on a 1600 x 900 canvas (x right, y down).
  p = this element's own numbers. They ease smoothly toward their latest values and start at 0 when an element is new,
      so write code that grows from nothing as its numbers rise. Changing numbers later is how the picture morphs.
  t = seconds, for motion.
  m = the room's atmosphere, eased, the same for every element (all 0..1 unless noted):
      m.decay  how run-down, broken, neglected the world is      m.bloom  how flourishing, cared-for, alive it is
      m.light  how bright (0.6 is neutral)                        m.warmth -1 cold .. +1 warm
      m.storm  violence of the weather   m.wind  wind strength    m.bond  how much people gather   m.tension  agitation
  k = the ONLY drawing API. It inks, wobbles and prints everything in one comic style; rain, mist, colour grading and grain
      are added over the whole panel automatically from the atmosphere, so never draw those yourself.
    k.shape(points, fill, {lw, curve, a})  closed polygon; points = [[x,y],...]; lw = ink width (default 4, 0 = none); curve:true smooths
    k.rect(x, y, w, h, fill, opts)     k.blob(x, y, rx, ry, fill, opts)     k.line(points, lw, colour, {a, curve})  open stroke
    k.dots(points, colour, size, gap, {fade:'up'|'down', a})  halftone dot screen clipped to a polygon (shading, gradients, light)
    k.hatch(points, colour, gap)  cross-hatching clipped to a polygon     k.glow(x, y, r, colour, a)  printed halo
    k.burst(x, y, rOuter, rInner, spikes, fill, opts)  star / spark / impact     k.alpha(a, function () { ... })  group opacity
  Ready-made pieces (use them: they are faster to write and match the style):
    k.figure(x, y, heightInPixels, coatColour, {walk: phase, sit: true, arms: true, bowed: true, hair: '#hex'})  a person, feet at (x, y)
    k.tree(x, y, heightInPixels, {bare: 0..1, bloom: 0..1, leaf: '#hex', flower: '#hex', sway: number, seed: n})  bare > 0.6 snaps branches
    k.cloud(x, y, width, fill, {dark: true})     k.smoke(x, y, amount, colour, t, wind)     k.sparkle(x, y, r, colour)
    k.crack(x, y, length, seed)   a jagged crack running downward     k.boards(x, y, w, h)   a boarded-up opening
    k.scribble(x, y, w, h, colour, seed)   a graffiti scrawl
  Maths: k.clamp(x, 0, 1)   k.lerp(a, b, u)   k.mix('#hex', '#hex', u)   k.rand(n) -> stable pseudo-random 0..1
Code rules: plain ES5 (var, function, for loops with fixed bounds). Use only k, p, t, m and Math. No "while", no globals.
Colours are '#rrggbb'. At most 40 lines and 2600 characters per element; shorter is better and faster.
Layers: lower draws first; 0 backdrop .. 9 nearest foreground. Ink is #15111c, paper white #fbf6e9.
Choose a bold limited palette of 5 to 7 flat colours for the scene and reuse it everywhere.`;

const SYSTEM = `You are the art director and cartoonist of ONE continuous comic-book panel, projected to a live audience. The audience answers an open question on their phones and the panel changes while they watch. The purpose is "a picture paints a thousand words": over the session the picture travels with how the room feels, and by the end it should be a single image that holds their collective answer. You never produce stills or restart: you maintain one living shot.

${KIT_DOC}

THE STATE-OF-REPAIR RULE (this is how the whole place shifts with the mood)
Every element you write must carry its own response to the atmosphere, in a way that belongs to the thing and the setting:
  as m.decay rises it visibly wears: broken, boarded, cracked, bare, toppled, rusted, overgrown, scrawled-on, dimmed, abandoned.
  as m.bloom rises it visibly thrives: mended, lit, painted, leafed, flowering, decorated, busy with people.
  m.light dims or brightens its lamps and windows; m.storm and m.wind bend what can bend; m.bond gathers figures together.
A city decays into shutters and graffiti, a forest into bare and snapped trees, a kitchen into unwashed plates and a cold stove.
Do this inside each element's code so the change is smooth and needs no rewriting.

THE NINE FEELINGS
${F.map(f => `  ${f}: ${FEELINGS[f]}`).join('\n')}
For every batch, report how strongly each is present in THOSE answers, 0..1 (most will be 0). They are not opposites: a room can hold hope and grief together, and the picture should show both.

OPENING SHOT (when asked for one)
Invent a setting that suits the question: a specific place seen from a specific spot, with a backdrop, a middle ground with recognisable landmarks, and something near the viewer. It should be a place where the things people are likely to say could plausibly arrive, be built, break, gather or leave. Compose big for a projector: the main landmarks should each span a fifth of the frame or more, and nothing important should be smaller than 40 pixels. Give it quiet life. Return 7 to 10 elements. Give most of them one to three numbers that could later be turned to express change, at calm starting values. In each "desc" say what the element is, exactly where it sits in canvas coordinates, what each number means, and how it wears and thrives, because later you will only see descriptions, not code.

EACH BATCH OF ANSWERS
1. Read whole sentences. One answer can hold several ideas with different feelings; treat each idea separately.
2. Physical things people name (data centres, a hospital, a fence, a garden) can enter the scene as themselves, placed where they belong and anchored to landmarks by the coordinates in the descriptions.
   Draw new things large enough to read from the back of a room, and in front of anything that would hide them.
3. Feelings and abstract thoughts need an image that belongs to this place: something that happens to the place or the people in it. Never use lettering, captions, icons or floating symbols.
4. Look first at what is already there. If an idea is present, deepen it through its numbers. If a new idea connects to an old one, show the connection (the pipe that drains the sea runs from the building someone else asked for).
5. You may rewrite an existing element (return its id again with new code) when it needs to change in kind, and remove an element when the room has moved on from it, so the picture does not silt up.
6. Follow the two controls given with each request: ABSTRACTION (how literal or dreamlike the imagery is) and MAGNITUDE (how much you change).
7. Write a "note": one plain sentence saying what the picture as a whole now says about the room's answer.

FINAL IMAGE (when asked)
The session is over. Do not add new ideas. Compose: bring forward what the room felt most, quieten or remove what was a passing remark, resolve anything half-finished, and set numbers so the shot comes to rest as one balanced picture someone could look at and understand how this room answered the question.

REPLY FORMAT
Return only JSON:
{ "feelings": { ${F.map(f => `"${f}": 0`).join(', ')} },
  "set": [ { "id", "params": [ { "name", "value" } ] } ],
  "add": [ { "id", "layer", "desc", "code", "params": [ { "name", "value" } ] } ],
  "remove": [ "id" ],
  "note": "..." }
Ids are short lowercase words. "set" and "remove" may only name existing elements. Lists may be empty. For an opening shot only "add" and "note" matter.`;

const abstractionText = a => a < 0.25 ? 'LITERAL. Show what people name as itself, in the place, at believable scale. Feelings appear through weather, light, repair and what the figures do.'
  : a < 0.6 ? 'GROUNDED METAPHOR. Ideas become things that could almost happen in this place: plausible objects and events standing for the idea.'
  : a < 0.85 ? 'POETIC. Let scale, gravity and logic bend: things may be far too large, float, grow where they should not, or merge, as long as the place is still recognisable.'
  : 'DREAMLIKE. Treat the place as a dream of itself. Impossible and symbolic transformations are welcome; keep only enough landmarks that the audience knows it is the same shot.';
const maxAdd = (mag, phase) => phase === 'final' ? 1 : phase === 'settling' ? 1 : Math.round(1 + mag * 4);
const magnitudeText = (mag, phase) => {
  const n = maxAdd(mag, phase);
  const base = mag < 0.3 ? 'GENTLE. Mostly adjust numbers by small steps.' : mag < 0.7 ? 'CLEAR. Each idea should produce a change someone would notice from the back of the room; move numbers by a third of their range where it fits.' : 'BOLD. Change the scene decisively: large new elements, numbers moved most of the way, existing landmarks rewritten or removed when an answer calls for it.';
  return `${base} At most ${n} new or rewritten element${n === 1 ? '' : 's'} in this reply.` + (phase === 'settling' ? ' The session is nearly over: favour deepening and tidying over new imagery.' : '');
};

export function createDirector({ question: q0 }) {
  let question = q0;
  const order = [];                    // recorded mode only
  const live = new Map();              // id -> element
  const settings = { abstraction: 0.5, magnitude: 0.5 };
  let phase = 'gathering', endsAt = 0, startedAt = 0;   // gathering -> settling -> final
  let journal = [], answersSeen = 0;
  const zero = () => Object.fromEntries(F.map(f => [f, 0]));
  let recent = zero(), total = zero(), weight = 0;
  let latest = null, busy = false, queue = [], wantFinal = false, client = null, format = null, lastError = null, calls = [], opening = false, waiter = null, inFlight = 0;

  const model = process.env.DIRECTOR_MODEL || 'claude-sonnet-5-5';
  const hasKey = () => !!process.env.ANTHROPIC_API_KEY;
  const recorded = () => !hasKey() && !!process.env.DIRECTOR_RECORDED;
  const sessionMode = () => !hasKey() && !recorded();
  const mode = () => recorded() ? 'recorded demo' : (hasKey() ? 'Claude (' + model + ')' : 'Claude (test session)') + (live.size ? '' : ', opening shot being written');
  const cacheFile = () => path.join(process.cwd(), '.cache', 'opening-v2-' + crypto.createHash('sha1').update(question).digest('hex').slice(0, 10) + '.json');
  const loadOpening = () => { try { for (const e of JSON.parse(fs.readFileSync(cacheFile(), 'utf8'))) live.set(e.id, structuredClone(e)); } catch {} };
  loadOpening();

  // ---- atmosphere: nine feelings -> the handful of drivers the renderer and every element read ----
  function atmosphere() {
    const k = phase === 'gathering' ? 0.65 : 0.3;                 // settle toward the whole journey at the end
    const a = Object.fromEntries(F.map(f => [f, k * recent[f] + (1 - k) * total[f]]));
    const gain = 0.6 + settings.magnitude * 1.0;
    const pos = (a.hope + a.wonder + a.belonging + a.agency) / 4, neg = (a.dread + a.anger + a.grief + a.unease) / 4;
    const g = x => clamp(x * gain);
    return {
      feelings: a,
      m: {
        decay: g((a.grief + a.dread + a.anger) * 0.62 + a.unease * 0.2 - (a.hope + a.agency) * 0.3),
        bloom: g((a.hope + a.wonder + a.belonging + a.agency) * 0.5 - neg * 0.5),
        light: clamp(0.6 + gain * ((a.hope + a.wonder) * 0.35 - (a.dread + a.grief) * 0.45 - a.unease * 0.15)),
        warmth: clamp(gain * ((a.hope + a.belonging) * 0.9 - (a.dread + a.unease) * 0.8 - a.grief * 0.4), -1, 1),
        storm: g(a.anger * 0.8 + a.dread * 0.5 + a.urgency * 0.4 - a.hope * 0.2),
        rain: g(a.grief * 1.0 + a.dread * 0.35 - a.hope * 0.3 - a.wonder * 0.2),
        mist: g(a.unease * 1.0 + a.grief * 0.25),
        wind: g(a.urgency * 0.9 + a.anger * 0.4),
        tension: g(a.anger * 0.9 + a.urgency * 0.5 + a.dread * 0.3),
        wonder: g(a.wonder * 1.1 + a.hope * 0.2),
        bond: g(a.belonging * 1.2 + a.hope * 0.2),
        val: clamp((pos - neg) * 2 * gain, -1, 1),
      },
    };
  }
  function feel(f, n) {
    if (!f) return;
    const b = Object.fromEntries(F.map(x => [x, clamp(Number(f[x]) || 0)]));
    const w = 1 - Math.exp(-Math.max(1, n) / 3), step = (0.35 + 0.45 * settings.magnitude) * (0.5 + 0.5 * w);
    for (const x of F) { recent[x] += (b[x] - recent[x]) * step; total[x] = (total[x] * weight + b[x] * n) / (weight + n); }
    weight += n;
  }

  function scene(world, snap) {
    if (!recorded()) return { mode: mode(), latest, els: [...live.values()], m: atmosphere().m, phase, settings, waiting: queue.length + inFlight, note: journal.at(-1)?.note || '' };
    const els = BASE.map(e => ({ ...e, base: true, params: { ...e.params } }));
    for (const id of Object.keys(REACT)) if (world.motifs[id].mass > 0 && !order.includes(id)) { order.push(id); latest = REACT[id].id; }
    for (const id of order) { const { from, ...e } = REACT[id]; els.push({ ...e, params: from(snap[id], snap[id + '_e']) }); }
    if (world.stars > 0) els.push({ ...NEWSTARS, params: { count: world.stars } });
    if (order.includes('jobs')) els.find(e => e.id === 'walkers').params.humans = 6 - snap.jobs * 6;
    return { mode: mode(), latest, els, m: { val: snap.val, tension: snap.tension, wind: snap.wind }, phase, settings };
  }

  // ---- the exact text sent to the model ----
  const topFeelings = a => Object.entries(a).filter(e => e[1] > 0.08).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([f, v]) => `${f} ${v.toFixed(2)}`).join(', ') || 'none yet';
  function prompt(kind, answers = [], forQuestion = question) {
    const controls = `ABSTRACTION ${settings.abstraction.toFixed(2)}: ${abstractionText(settings.abstraction)}`;
    if (kind === 'open') return { system: SYSTEM, user: `The question on screen is:\n"${forQuestion}"\n\n${controls}\n\nWrite the opening shot.` };
    const els = [...live.values()].map(e => `- ${e.id} (layer ${e.layer}) numbers ${JSON.stringify(e.params)}: ${e.desc}`).join('\n');
    const story = journal.slice(-8).map((j, i) => `${i + 1}. ${j.note}`).join('\n') || '(nothing yet)';
    const head = `The question on screen is:\n"${question}"\n\nThe journey so far (${answersSeen} answers):\n${story}\nThe room across the whole session: ${topFeelings(total)}\nThe room just lately: ${topFeelings(recent)}\n\nElements in the scene now:\n${els}\n\n`;
    if (kind === 'final') return { system: SYSTEM, user: head + `${controls}\n\nThe session has ended. Compose the FINAL IMAGE.` };
    return { system: SYSTEM, user: head + `${controls}\nMAGNITUDE ${settings.magnitude.toFixed(2)}: ${magnitudeText(settings.magnitude, phase)}\n\nNew answers in this batch (${answers.length}):\n${answers.map(a => `- ${a}`).join('\n')}` };
  }

  function apply(patch, { opening: isOpening = false, final: isFinal = false, answers = 0 } = {}) {
    const obj = list => Array.isArray(list) ? Object.fromEntries(list.map(({ name, value }) => [String(name), Number(value) || 0])) : { ...(list || {}) };
    const out = { added: [], set: [], removed: [], rejected: [] };
    const cap = isOpening ? 12 : isFinal ? 3 : maxAdd(settings.magnitude, phase);
    for (const a of (patch.add || []).slice(0, cap)) {
      if (!a || typeof a.code !== 'string' || !a.id || a.code.length > 6000) { out.rejected.push(a?.id || '?'); continue; }
      const prev = live.get(a.id);
      live.set(a.id, { id: String(a.id), layer: Number(a.layer) || 0, desc: String(a.desc || ''), code: a.code, params: { ...(prev?.params || {}), ...obj(a.params) } });
      latest = a.id; out.added.push(a.id);
    }
    for (const s of patch.set || []) { const e = live.get(s.id); if (e) { Object.assign(e.params, obj(s.params)); out.set.push(s.id); } else out.rejected.push(s.id); }
    for (const id of patch.remove || []) if (live.delete(id)) out.removed.push(id);
    if (isOpening) { if (live.size) { try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify([...live.values()])); } catch {} } }
    else {
      const n = answers || inFlight || 1;
      feel(patch.feelings, n); answersSeen += isFinal ? 0 : n;
      if (patch.note) journal.push({ note: String(patch.note).slice(0, 300), n });
      if (isFinal) phase = 'final';
    }
    inFlight = 0;
    return out;
  }

  // ---- API mode ----
  async function ask(kind, answers) {
    if (!client) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const { z } = await import('zod'); const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
      const P = z.array(z.object({ name: z.string(), value: z.number() }));
      format = zodOutputFormat(z.object({
        feelings: z.object(Object.fromEntries(F.map(f => [f, z.number()]))),
        set: z.array(z.object({ id: z.string(), params: P })),
        add: z.array(z.object({ id: z.string(), layer: z.number(), desc: z.string(), code: z.string(), params: P })),
        remove: z.array(z.string()), note: z.string(),
      }));
      client = new Anthropic();
    }
    const { system, user } = prompt(kind, answers), t0 = performance.now();
    const res = await client.messages.parse({
      model, max_tokens: kind === 'open' ? 24000 : 12000,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],   // identical every call, so it caches
      output_config: { format, effort: 'low' },
      messages: [{ role: 'user', content: user }],
    });
    calls.push({ kind, answers: answers?.length ?? 0, ms: Math.round(performance.now() - t0), out: res.usage?.output_tokens, cached: res.usage?.cache_read_input_tokens });
    if (res.stop_reason === 'refusal') { lastError = 'the model declined this request'; return null; }
    return res.parsed_output;
  }
  async function open(done) {
    if (!hasKey() || opening || live.size) return;
    opening = true;
    try { const patch = await ask('open'); if (patch) { apply(patch, { opening: true }); done(); } }
    catch (e) { lastError = String(e.message || e).slice(0, 300); console.error('director (opening):', lastError); }
    finally { opening = false; }
  }
  async function pump(done) {
    if (busy || !hasKey() || !live.size) return;
    busy = true;
    try {
      while (queue.length || wantFinal) {
        if (queue.length && phase !== 'final') { const batch = queue.splice(0); const patch = await ask('patch', batch); if (patch) { apply(patch, { answers: batch.length }); done(); } }
        else if (wantFinal) { wantFinal = false; const patch = await ask('final'); if (patch) { apply(patch, { final: true }); done(); } }
        else queue.length = 0;
      }
    } catch (e) { lastError = String(e.message || e).slice(0, 300); console.error('director:', lastError); }
    finally { busy = false; }
  }
  // Answers arriving while a request is in flight wait and go together in the next batch.
  function onBatch(texts, done) {
    if (recorded() || phase === 'final') return;
    queue.push(...texts);
    if (sessionMode()) { if (waiter) { const w = waiter; waiter = null; w(); } return; }
    pump(done);
  }
  // session mode: hand the next piece of work to whoever is acting as director
  async function next(waitMs) {
    if (!sessionMode()) return { kind: 'none', reason: 'not in session mode' };
    if (!live.size) return { kind: 'open', ...prompt('open') };
    if (!queue.length && !wantFinal) await new Promise(r => { waiter = r; setTimeout(r, waitMs); });
    if (queue.length && phase !== 'final') { const answers = queue.splice(0); inFlight = answers.length; return { kind: 'patch', answers, ...prompt('patch', answers) }; }
    if (wantFinal) { wantFinal = false; return { kind: 'final', ...prompt('final') }; }
    return { kind: 'idle' };
  }

  function clear() { order.length = 0; live.clear(); latest = null; queue = []; calls = []; lastError = null; inFlight = 0; journal = []; answersSeen = 0; recent = zero(); total = zero(); weight = 0; phase = 'gathering'; endsAt = 0; wantFinal = false; }
  return {
    scene, prompt, apply, open, onBatch, next,
    // The session clock: gather, then settle for the last fifth, then ask for the final image.
    tick(done) {
      if (!endsAt || phase === 'final') return;
      const now = Date.now();
      if (phase === 'gathering' && now > startedAt + (endsAt - startedAt) * 0.8) phase = 'settling';
      if (now > endsAt) { endsAt = 0; wantFinal = true; if (sessionMode()) { if (waiter) { const w = waiter; waiter = null; w(); } } else pump(done); }
    },
    control(b, done) {
      if (typeof b.abstraction === 'number') settings.abstraction = clamp(b.abstraction);
      if (typeof b.magnitude === 'number') settings.magnitude = clamp(b.magnitude);
      if (b.start) { startedAt = Date.now(); endsAt = startedAt + Math.max(20, Number(b.start)) * 1000; phase = 'gathering'; }
      if (b.settle) phase = 'settling';
      if (b.final) { wantFinal = true; if (sessionMode()) { if (waiter) { const w = waiter; waiter = null; w(); } } else pump(done); }
      if (typeof b.question === 'string' && b.question.trim() && b.question.trim() !== question) { question = b.question.trim().slice(0, 200); clear(); loadOpening(); }
      return this.status();
    },
    question: () => question,
    status: () => ({ mode: mode(), model, question, phase, settings, secondsLeft: endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null, answersSeen, feelings: { session: total, lately: recent }, atmosphere: atmosphere().m, journal: journal.slice(-12), lastError, calls: calls.slice(-20), elements: [...live.values()].map(e => ({ id: e.id, layer: e.layer, params: e.params, desc: e.desc })) }),
    reset(fresh) { clear(); if (fresh) { try { fs.unlinkSync(cacheFile()); } catch {} } else loadOpening(); },
  };
}
