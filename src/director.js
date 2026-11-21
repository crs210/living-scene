// The director: turns batches of audience answers into a changing comic panel, as code.
//
// What the model decides                       What the app does with it
//   feelings in this batch (nine of them)   ->  blended into the atmosphere: light, colour, weather,
//                                               wear and bloom across the whole panel
//   ideas: which THEME each answer joins    ->  a running tally. An element's weight (p.w) follows its
//                                               theme's share of the room, so repeats grow by themselves;
//                                               themes the room drops recede, and are pruned only when full
//   set / add / remove                      ->  eased; revealed one piece at a time, each with an entrance
//   note: one line on what the picture says ->  kept as the journey and fed back next time
//
// Phases: upheaval (answers overturn the opening), building, settling, final (one composed image, held).
//
// Three ways to supply the model:
//   test session (default)  requests queue; a Claude Code session answers with tools/director-wait.js and
//                           tools/director-reply.js, as one worker or as a reader plus cartoonists
//   API                     ANTHROPIC_API_KEY set: a fast pass, then one request per drawing in parallel
//   mock                    DIRECTOR_MOCK=1: canned replies through the API path, to test the plumbing
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { FEELINGS, F, SYSTEM, abstractionText, PHASE_TEXT } from './prompt.js';
import { matchTheme, leanOf } from './instant.js';
import { layoutReport } from './layout.js';
import { atmosphereFrom } from './atmosphere.js';
import { callModel, mockReply } from './model.js';

export { FEELINGS };
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const MAX_ARRIVALS = 6;                // elements beyond the opening; past that the weakest quiet theme gives way
const FULL_FRAME = 9;                  // with this many elements in all, nothing brand new may be added: ideas must go into what exists

export function createDirector({ question: q0 }) {
  let question = q0;
  const live = new Map();                        // id -> element
  const themes = new Map();                      // key -> { count, born, last, gist }
  const settings = { abstraction: 0.5, magnitude: 0.5 };
  let camera = { zoom: 1, focus: [800, 560] };   // the view: below 1 pulls back, above 1 closes in on the focus point
  let instantLog = [];                           // what the app did by itself the moment an answer arrived
  // THE FAST SPEED. No model: runs the second an answer is accepted. It only does small, self-limiting things:
  // a first guess at the mood (the director's reading replaces it), and, when the answer plainly repeats an idea
  // already in the picture, one more count for that theme, which makes its element pop and grow at once.
  function instant(texts) {
    for (const text of texts.slice(0, 60)) {
      const { v, lean } = leanOf(text);
      for (const x in lean) if (lean[x] > recent[x]) recent[x] += (lean[x] - recent[x]) * 0.08;
      const key = matchTheme(text, themes.keys()), t = key && themes.get(key);
      if (t) { t.count++; t.pre = (t.pre || 0) + 1; t.last = batchNo; }
      instantLog.push({ text: text.slice(0, 80), theme: key, v: +v.toFixed(2) }); if (instantLog.length > 10) instantLog.shift();
    }
  }
  let settleNow = false, isFinal = false, endsAt = 0, startedAt = 0, batchNo = 0;
  let journal = [], answersSeen = 0, concepts = [], chosen = null, issuedCap = 0, issuedNew = 0, ghosts = [], revealClock = 0;
  let GAP = Number(process.env.STAGGER_MS || 3500);          // pieces of one reply are revealed this far apart
  const ENTER = ['rise', 'drop', 'slide', 'grow', 'fade'];
  let jobs = [], jobSeq = 0;
  // One entry per request to the director: what went in, how long it took, what came back.
  const begin = (kind, answers = [], p = null, brief = null) => {
    const last = jobs.at(-1); if (last && !last.doneAt && last.kind === kind && kind !== 'draw' && last.answers.length === answers.length) return last;   // the same request, asked for again
    const j = { n: ++jobSeq, kind, answers: [...answers], sentAt: Date.now(), promptChars: p ? p.system.length + p.user.length : 0, requestChars: p ? p.user.length : 0, brief: brief || null };
    jobs.push(j); if (jobs.length > 14) jobs.shift(); return j;
  };
  const nextReveal = () => (revealClock = Math.max(Date.now() + 1200, revealClock + GAP));
  const zero = () => Object.fromEntries(F.map(f => [f, 0]));
  let recent = zero(), total = zero(), weight = 0;
  let latest = null, busy = false, queue = [], wantFinal = false, wantConcepts = false, lastError = null, calls = [], opening = false, waiters = [], drawWaiters = [], drawQueue = [], lastBatch = [], inFlight = 0;

  const model = process.env.DIRECTOR_MODEL || 'claude-sonnet-5-5';
  const drawModel = process.env.DRAW_MODEL || model;
  const API_CAP = Number(process.env.MAX_API_CALLS || 500);   // requests to the model per session, so a busy or hostile room cannot run up a bill
  let apiCalls = 0, capHit = false;   // the drawings can be written by a different (lighter, faster) model than the one that reads the room
  const MOCK = !!process.env.DIRECTOR_MOCK;      // exercise the API-mode plumbing with canned replies and delays, no network
  const hasKey = () => !!process.env.ANTHROPIC_API_KEY || MOCK;
  const sessionMode = () => !hasKey();
  let tape = [], playing = null, replaying = false;   // every applied reply is recorded, so a session can be replayed with no model
  const mode = () => playing ? 'a recorded session being replayed, no model running' : (MOCK ? 'mock replies' : hasKey() ? 'Claude (' + model + (drawModel !== model ? ' + ' + drawModel : '') + ')' : 'Claude (test session)') + (live.size ? '' : ', waiting for an opening shot') + (capHit ? '. SPENDING CAP REACHED: the picture has stopped changing' : '');
  const wake = () => { const ws = waiters; waiters = []; for (const w of ws) w(); };
  const wakeDraw = () => { const ws = drawWaiters; drawWaiters = []; for (const w of ws) w(); };
  const cacheFile = () => path.join(process.env.CACHE_DIR || path.join(process.cwd(), '.cache'), 'opening-v2-' + crypto.createHash('sha1').update(question + (chosen ? '|' + chosen.title : '')).digest('hex').slice(0, 10) + '.json');
  const loadOpening = () => { try { for (const e of JSON.parse(fs.readFileSync(cacheFile(), 'utf8'))) live.set(e.id, { ...structuredClone(e), theme: null, opening: true }); } catch {} };
  loadOpening();

  function phase() {
    if (isFinal) return 'final';
    if (endsAt) { const f = (Date.now() - startedAt) / (endsAt - startedAt); return f < 0.35 ? 'upheaval' : f < 0.8 ? 'building' : 'settling'; }
    return settleNow ? 'settling' : answersSeen < 10 ? 'upheaval' : 'building';
  }
  const effMag = () => clamp(settings.magnitude * ({ upheaval: 1.35, building: 1, settling: 0.5, final: 0.3 })[phase()]);
  const maxAdd = (n = 0) => phase() === 'settling' ? 1 : Math.min(5, Math.round(1 + effMag() * 3) + (n >= 8 ? 1 : 0));   // a big batch earns one more

  // Of the elements a reply may change, only some may be brand new; the rest must be rewrites, so ideas get combined.
  const newCap = (n = 0) => live.size >= FULL_FRAME ? 0 : phase() === 'settling' ? 1 : Math.min(FULL_FRAME - live.size, Math.max(1, Math.ceil(maxAdd(n) / 2)));
  // Where things stand, from the footprints the model declares: what is piled up, and where there is room.
  const layout = () => layoutReport([...live.values()], camera);

  // ---- themes: repetition is what makes something big ----
  function weights() {
    let max = 1; for (const t of themes.values()) max = Math.max(max, t.count);
    const g = ({ final: 1.5, settling: 1.5 })[phase()] || 1, out = {};
    for (const [k, t] of themes) { let w = Math.pow(t.count / max, g); if (batchNo - t.born <= 1 && phase() !== 'final') w = Math.max(w, 0.4); out[k] = clamp(w, phase() === 'final' ? 0.28 : 0.1, 1); }
    return out;
  }
  function prune() {
    // Weak themes are not deleted: they recede (see scene()). Deletion happens only when the scene is over-full,
    // and then only for arrivals whose theme nobody has voiced for a while. Opening landmarks are never pruned.
    const w = weights(), removed = [];
    const arrivals = [...live.values()].filter(e => e.theme && !e.stage && batchNo - (themes.get(e.theme)?.last ?? 0) >= 2);
    arrivals.sort((a, b) => (w[a.theme] ?? 0) - (w[b.theme] ?? 0));
    let extra = [...live.values()].filter(e => e.theme && !e.stage).length - MAX_ARRIVALS;
    for (const e of arrivals) if (extra > 0) { live.delete(e.id); ghosts.push({ el: e, until: nextReveal() }); removed.push(e.id); extra--; }
    return removed;
  }

  // ---- atmosphere: nine feelings -> the drivers the renderer and every element read ----
  const atmosphere = () => atmosphereFrom(recent, total, phase(), settings.magnitude);
  function feel(f, n) {
    if (!f) return;
    const step = (0.35 + 0.45 * settings.magnitude) * (0.5 + 0.5 * (1 - Math.exp(-Math.max(1, n) / 3)));
    for (const x of F) { const b = clamp(Number(f[x]) || 0); recent[x] += (b - recent[x]) * step; total[x] = (total[x] * weight + b * n) / (weight + n); }
    weight += n;
  }

  function scene() {
    const w = weights();
    const now = Date.now(); ghosts = ghosts.filter(g => g.until > now && !live.has(g.el.id));
    // an element not yet revealed shows as its previous version (or not at all); removed ones linger until their turn
    const shown = [...live.values()].map(e => e.revealAt > now ? e.was : e).filter(Boolean).concat(ghosts.map(g => g.el));
    const els = shown.map(({ was, revealAt, ...e }) => {
      if (!e.theme || w[e.theme] === undefined) return e;
      const quiet = batchNo - (themes.get(e.theme)?.last ?? batchNo);
      const recede = e.stage || phase() === 'final' ? 0 : +(clamp((0.34 - w[e.theme]) / 0.24) * clamp((quiet - 1) / 2)).toFixed(2);   // weak AND unvoiced for a while
      return { ...e, recede, hits: themes.get(e.theme).count, params: { ...e.params, w: w[e.theme] } };
    });
    return { mode: mode(), question, camera, latest, els, m: atmosphere(), phase: phase(), settings, waiting: queue.length + inFlight, dev: { now: Date.now(), instant: instantLog.slice(-6), queue: queue.slice(0, 30), toDraw: drawQueue.map(d => d.brief.id), jobs: jobs.slice(-10) }, note: journal.at(-1)?.note || '', concepts, chosen: chosen?.title || null,
      themes: [...themes].map(([k, t]) => ({ key: k, count: t.count, w: +w[k].toFixed(2), gist: t.gist })).sort((a, b) => b.count - a.count) };
  }

  // ---- the exact text sent to the model ----
  const top = a => Object.entries(a).filter(e => e[1] > 0.08).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([f, v]) => `${f} ${v.toFixed(2)}`).join(', ') || 'none yet';
  function prompt(kind, answers = [], extra = null) {
    const abs = `ABSTRACTION ${settings.abstraction.toFixed(2)}: ${abstractionText(settings.abstraction)}`;
    if (kind === 'concepts') return { system: SYSTEM, user: `The question on screen will be:\n"${question}"\n\nBefore any drawing, propose FOUR different opening stages for the host to choose between. Make them really different in kind: one everyday and literal, one a metaphorical place, one unexpected or surreal, and one nearly empty stage that the audience will fill. Each needs a title (2 to 4 words), a pitch (one sentence: the place and the viewpoint) and "room" (one sentence: what kinds of answers could arrive, break, grow or gather there).\nReturn only JSON: { "concepts": [ { "title", "pitch", "room" } ] }` };
    if (kind === 'open') return { system: SYSTEM, user: `The question on screen is:\n"${question}"\n\n${chosen ? `The host chose this opening stage:\n${chosen.title}: ${chosen.pitch}\n\n` : ''}${abs}\n\nWrite the opening shot.` };
    const w = weights();
    const els = [...live.values()].map(e => `- ${e.id}${e.theme ? ` [theme ${e.theme}, w ${(w[e.theme] ?? 0).toFixed(2)}]` : ''}${e.stage ? ' [opening landmark]' : ''} (layer ${e.layer}${e.box ? `, box ${e.box.join(',')}` : ''}${e.at ? `, at ${e.at.join(',')}` : ''}) ${JSON.stringify(e.params)}: ${e.desc}`).join('\n');
    const th = [...themes].sort((a, b) => b[1].count - a[1].count).map(([k, t]) => `- ${k}: ${t.count} answer${t.count === 1 ? '' : 's'}, weight ${w[k].toFixed(2)} (${t.gist})`).join('\n') || '(none yet)';
    const story = journal.slice(-6).map((j, i) => `${i + 1}. ${j.note}`).join('\n') || '(nothing yet)';
    const head = `The question on screen is:\n"${question}"\n\nThe journey so far (${answersSeen} answers):\n${story}\nFeelings across the session: ${top(total)}\nFeelings lately: ${top(recent)}\n\nThemes so far:\n${th}\n\nElements in the scene now:\n${els}\n\n`;
    if (kind === 'final') return { system: SYSTEM, user: head + `${abs}\n\nThe session has ended. Compose the FINAL IMAGE.` };
    const n = maxAdd(answers.length), ph = phase();
    const pictured = new Set([...live.values()].map(e => e.theme).filter(Boolean));
    const owed = [...themes].filter(([k2, t]) => !pictured.has(k2) && t.count >= 2).sort((a, b) => b[1].count - a[1].count).map(([k2, t]) => `${k2} (${t.count})`).join(', ');
    const controls = `PHASE: ${PHASE_TEXT[ph] || PHASE_TEXT.building}\n${abs}\nMAGNITUDE ${effMag().toFixed(2)}: at most ${n} new or rewritten element${n === 1 ? '' : 's'} in this reply, of which at most ${newCap(answers.length)} may be brand new (the rest must be rewrites that work the new ideas into what exists); move numbers ${effMag() < 0.3 ? 'by small steps' : effMag() < 0.7 ? 'by about a third of their range' : 'most of the way'}.${owed ? `\nOWED A PICTURE: these themes have been voiced more than once and still have no element: ${owed}. Draw them before anything voiced only once.` : ''}` + layout();
    const list = `New answers in this batch (${answers.length}):\n${answers.map(a => `- ${a}`).join('\n')}`;
    if (kind === 'fast') return { system: SYSTEM, user: head + controls + '\n\n' + list + '\n\nFAST PASS: be quick. Write no code and leave "add" empty. Do everything else now: feelings, ideas with "touches", "set" (move numbers), "remove", "note". Then, for each new or rewritten element you want, add a brief to a "draw" list: { "id", "theme", "layer", "brief" }. To change an existing element use its id. Each brief goes to a separate cartoonist who sees the scene list but not your thoughts, so say in two or three sentences: what it is, in which mood (grim, idealised, playful), where it stands and how big, what it is attached to or does to its neighbours, and what its numbers mean.' };
    if (kind === 'draw') return { system: SYSTEM, user: head + controls + '\n\n' + list + `\n\nDRAW PASS: write exactly ONE element, returned alone in "add" (with "at" and "enter"), for this brief:\n${JSON.stringify(extra)}\n${live.get(extra?.id) ? `This REWRITES the existing element "${extra.id}": keep what it shows and add the change. Its current code:\n${live.get(extra.id).code}\n` : ''}Leave every other list empty and all feelings 0.` };
    return { system: SYSTEM, user: head + controls + '\n\n' + list };
  }

  function apply(patch, { opening: isOpening = false, final = false, answers = 0, partial = false } = {}) {
    const job = jobs.includes(patch._job) ? patch._job : jobs.findLast(j => !j.doneAt && j.kind !== 'draw') || begin(isOpening ? 'open' : final ? 'final' : 'manual');
    if (Array.isArray(patch.concepts)) { Object.assign(job, { doneAt: Date.now(), ms: Date.now() - job.sentAt, note: patch.concepts.length + ' opening options' }); concepts = patch.concepts.slice(0, 5).map(c => ({ title: String(c.title || '').slice(0, 60), pitch: String(c.pitch || '').slice(0, 300), room: String(c.room || '').slice(0, 300) })); return { concepts: concepts.length }; }
    const obj = list => Array.isArray(list) ? Object.fromEntries(list.map(({ name, value }) => [String(name), Number(value) || 0])) : { ...(list || {}) };
    const out = { added: [], set: [], removed: [], pruned: [], rejected: [] }, rewritten = new Set();
    if (patch.camera && Number.isFinite(Number(patch.camera.zoom))) { const f = patch.camera.focus; camera = { zoom: clamp(Number(patch.camera.zoom), 0.6, 1.6), focus: Array.isArray(f) && f.length === 2 && f.every(Number.isFinite) ? [clamp(f[0], 0, 1600), clamp(f[1], 0, 900)] : camera.focus }; out.camera = camera; }
    const n = answers || inFlight || 1;
    if (!replaying) tape.push({ answers: isOpening || final || partial ? [] : [...lastBatch], opts: { opening: isOpening, final, partial, answers: n }, patch: (({ _job, ...p }) => p)(patch) });
    if (!isOpening && !partial) {
      batchNo++;
      for (const i of patch.ideas || []) {
        const key = String(i.theme || '').toLowerCase().trim().replace(/\s+/g, '-').slice(0, 40); if (!key) continue;
        const t = themes.get(key) || { count: 0, born: batchNo, gist: String(i.gist || key).slice(0, 60) };
        t.count += Math.max(0, Math.max(1, Math.min(n, Number(i.n) || 1)) - (t.pre || 0)); t.pre = 0; t.last = batchNo; themes.set(key, t);   // repeats the app already counted are not counted twice
      }
    }
    // Honour the allowance the director was told when the request went out, even if the phase has moved on since.
    const cap = isOpening ? 12 : final ? 3 : partial ? 1 : Math.max(maxAdd(n), issuedCap); issuedCap = 0;
    const capped = !isOpening && !final && !partial, newAllowed = Math.max(newCap(n), issuedNew); let newCount = 0; if (capped) issuedNew = 0;
    for (const a of (patch.add || []).slice(cap)) out.rejected.push((a?.id || '?') + ' (over the allowance of ' + cap + ')');
    for (const a of (patch.add || []).slice(0, cap)) {
      if (!a || typeof a.code !== 'string' || !a.id || a.code.length > 6000) { out.rejected.push(a?.id || '?'); continue; }
      const prev = live.get(a.id), key = a.theme ? String(a.theme).toLowerCase().trim().replace(/\s+/g, '-') : (prev?.theme ?? null);
      if (key && !themes.has(key)) themes.set(key, { count: 1, born: batchNo, last: batchNo, gist: key });
      const { w, ...params } = { ...(prev?.params || {}), ...obj(a.params) };
      if (capped && !prev && ++newCount > newAllowed) { out.rejected.push(a.id + ' (more than ' + newAllowed + ' brand-new elements: work it into an existing one)'); continue; }
      const box = Array.isArray(a.box) && a.box.length === 4 && a.box.every(Number.isFinite) && a.box[2] > 0 && a.box[3] > 0 ? [Math.round(clamp(a.box[0], -200, 1600)), Math.round(clamp(a.box[1], -200, 900)), Math.round(clamp(a.box[2], 10, 2000)), Math.round(clamp(a.box[3], 10, 1300))] : prev?.box ?? null;
      const at = Array.isArray(a.at) && a.at.length === 2 && a.at.every(Number.isFinite) ? [clamp(a.at[0], 0, 1600), clamp(a.at[1], 0, 900)] : prev?.at ?? (box ? [clamp(box[0] + box[2] / 2, 0, 1600), clamp(box[1] + box[3], 0, 900)] : null);
      const el = { id: String(a.id), layer: Number(a.layer) || 0, desc: String(a.desc || '').slice(0, 400), code: a.code, params, theme: isOpening ? null : key, opening: isOpening || (prev?.opening && !key), stage: isOpening || !!prev?.stage || !!prev?.opening, born: prev?.born ?? batchNo, box, at, enter: ENTER.includes(a.enter) ? a.enter : prev?.enter || 'fade' };
      if (!isOpening && !final) {                          // revealed one after another, not all at once
        el.revealAt = nextReveal();
        if (prev) { const { was, revealAt, ...seen } = prev; el.was = revealAt > Date.now() ? was : seen; }
      }
      live.set(a.id, el);
      latest = a.id; out.added.push(a.id); if (prev) rewritten.add(a.id);
    }
    for (const s of patch.set || []) { const e = live.get(s.id); if (e) { const { w, ...ps } = obj(s.params); Object.assign(e.params, ps); out.set.push(s.id); } else out.rejected.push(s.id); }
    for (const id of patch.remove || []) { const e = live.get(id); if (!e) continue; live.delete(id); out.removed.push(id); if (!isOpening && !final) { const { was, revealAt, ...seen } = e; const old = revealAt > Date.now() ? was : seen; if (old) ghosts.push({ el: old, until: nextReveal() }); } }
    if (isOpening) { if (live.size && !replaying) { try { fs.mkdirSync(path.dirname(cacheFile()), { recursive: true }); fs.writeFileSync(cacheFile(), JSON.stringify([...live.values()])); } catch {} } }
    else if (!partial) {
      for (const t of themes.values()) t.pre = 0;
      feel(patch.feelings, n); if (!final) answersSeen += n;
      if (patch.note) journal.push({ note: String(patch.note).slice(0, 300), n });
      if (final) {
        drawQueue = [];
        isFinal = true;
        if (!replaying)
        // Keep the finished session: the picture (as its elements), the journey, and the tally.
        try {
          const dir = process.env.SESSIONS_DIR || path.join(process.cwd(), 'sessions'); fs.mkdirSync(dir, { recursive: true });
          const w = weights();
          fs.writeFileSync(path.join(dir, new Date().toISOString().replace(/[:.]/g, '-') + '.json'), JSON.stringify({ question, chosen, opening: chosen, tape, answers: answersSeen, settings, journey: journal.map(j => j.note), themes: [...themes].map(([k, t]) => ({ theme: k, answers: t.count, weight: +w[k].toFixed(2), gist: t.gist })).sort((a, b) => b.answers - a.answers), feelings: total, atmosphere: atmosphere(), elements: [...live.values()] }, null, 1));
        } catch (e) { console.error('could not save session:', e.message); }
      }
      out.pruned = prune();
    }
    if (!partial) { inFlight = 0; lastBatch = []; }
    const pieces = out.added.map(id => { const e = live.get(id); return { id, what: rewritten.has(id) ? 'rewrite' : 'new', theme: e.theme, enter: e.enter, chars: e.code.length, desc: e.desc.slice(0, 160), revealAt: e.revealAt || 0 }; });
    for (const g of ghosts) if (out.removed.includes(g.el.id) || out.pruned.includes(g.el.id)) pieces.push({ id: g.el.id, what: out.pruned.includes(g.el.id) ? 'pruned' : 'remove', revealAt: g.until });
    Object.assign(job, { doneAt: Date.now(), ms: Date.now() - job.sentAt, feelings: patch.feelings ? top(patch.feelings) : '', ideas: (patch.ideas || []).slice(0, 12).map(i => ({ theme: String(i.theme || ''), n: Number(i.n) || 1, gist: String(i.gist || '').slice(0, 60), touches: Array.isArray(i.touches) ? i.touches.slice(0, 6).map(String) : [] })),
      set: out.set, briefs: (patch.draw || []).map(d => String(d.id)), pieces, rejected: out.rejected, note: String(patch.note || '').slice(0, 300) });
    return out;
  }

  // ---- API mode: a fast pass (feelings, themes, numbers) lands first; drawings follow in parallel ----
  // Canned replies with realistic delays, to test batching and the fast-then-draw pipeline without a key.
  // One request to the director model (or its canned stand-in). Counts toward the spending cap.
  async function ask(kind, answers, extra) {
    if (apiCalls >= API_CAP) { capHit = true; throw new Error('spending cap reached (' + API_CAP + ' requests this session; raise MAX_API_CALLS or reset)'); }
    apiCalls++;
    const p = prompt(kind, answers, extra), job = begin(kind, answers || [], p, extra?.brief);
    const r = MOCK ? await mockReply(kind, answers || [], extra, calls.length) : await callModel(kind, p, kind === 'draw' ? drawModel : model);
    calls.push({ kind, answers: answers?.length ?? 0, ms: r.ms, out: r.outputTokens, cached: r.cachedTokens, mock: MOCK || undefined });
    if (r.refused) { lastError = 'the model declined this request'; Object.assign(job, { doneAt: Date.now(), ms: Date.now() - job.sentAt, note: lastError }); return null; }
    if (r.out) r.out._job = job;
    return r.out;
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
          const batch = queue.splice(0); lastBatch = batch;
          const fast = await ask('fast', batch); if (!fast) continue;
          apply({ ...fast, add: [] }, { answers: batch.length }); done();
          await Promise.all((fast.draw || []).slice(0, maxAdd(batch.length)).map(d => guard('draw ' + d.id, async () => { const r = await ask('draw', batch, d); if (r?.add?.[0]) { apply({ add: [r.add[0]], _job: r._job }, { partial: true }); done(); } })));
        } else if (wantFinal) { wantFinal = false; const p = await ask('final'); if (p) { apply(p, { final: true }); done(); } }
        else queue.length = 0;
      }
    });
    busy = false;
  }
  // Answers arriving while a request is in flight wait and go together in the next batch.
  function onBatch(texts, done) {
    if (isFinal) return;
    if (live.size) instant(texts);
    queue.push(...texts);
    if (sessionMode()) return wake();
    pump(done);
  }
  // session mode: hand the next piece of work to whoever is acting as director
  const issue = (kind, answers = []) => { const p = prompt(kind, answers); begin(kind, answers, p); return { kind, ...(kind === 'patch' || kind === 'fast' ? { answers } : {}), ...p }; };
  // role 'all' (default): one director does everything, a whole batch per reply.
  // role 'read': feelings, themes, numbers and briefs only (fast). role 'draw': one drawing per request; run several at once.
  // role 'all': one director, a whole batch per reply (drawings included).
  // role 'solo': one director, two speeds: each batch gets a quick read first (feelings, themes, numbers, briefs),
  //              then the drawings are done one at a time, with new answers always read before more drawing.
  // role 'read' / 'draw': the same split across several workers.
  async function next(waitMs, role = 'all', gone = () => false) {   // gone(): the asker hung up while waiting, so it must not be handed work
    if (!sessionMode()) return { kind: 'none', reason: 'not in session mode' };
    const drawJob = () => {
      const d = drawQueue.shift(); if (!d) return { kind: 'idle' };
      const p = prompt('draw', d.answers, d.brief), job = begin('draw', d.answers, p, d.brief.id + ': ' + String(d.brief.brief || '').slice(0, 400));
      return { kind: 'draw', job: job.n, id: d.brief.id, ...p };
    };
    if (role === 'draw') {
      if (!drawQueue.length) await new Promise(r => { drawWaiters.push(r); setTimeout(r, waitMs); });
      return gone() ? { kind: 'idle' } : drawJob();
    }
    const solo = role === 'solo';
    if (wantConcepts) { wantConcepts = false; return issue('concepts'); }
    if (!live.size) return issue('open');
    if (!queue.length && !wantFinal && !(solo && drawQueue.length)) await new Promise(r => { waiters.push(r); setTimeout(r, waitMs); });
    if (gone()) return { kind: 'idle' };
    if (wantConcepts) { wantConcepts = false; return issue('concepts'); }
    if (queue.length && !isFinal) { const answers = queue.splice(0); inFlight = answers.length; issuedCap = maxAdd(answers.length); issuedNew = newCap(answers.length); lastBatch = answers; return issue(solo || role === 'read' ? 'fast' : 'patch', answers); }
    if (wantFinal) { wantFinal = false; return issue('final'); }
    if (solo && drawQueue.length && !isFinal) return drawJob();
    return { kind: 'idle' };
  }

  function clear() { apiCalls = 0; capHit = false; camera = { zoom: 1, focus: [800, 560] }; instantLog = []; playing = null; tape = []; live.clear(); themes.clear(); latest = null; queue = []; calls = []; lastError = null; inFlight = 0; journal = []; answersSeen = 0; batchNo = 0; jobs = []; drawQueue = []; ghosts = []; revealClock = 0; recent = zero(); total = zero(); weight = 0; settleNow = false; isFinal = false; endsAt = 0; wantFinal = false; }
  return {
    scene, prompt, apply, open, onBatch, next,
    // Replay a recorded session ({ question, chosen, tape }) on a timer. No model is involved.
    async play(demo, { onAnswers = () => {}, done = () => {}, gap = 1200 } = {}) {
      clear();
      const token = {}, keepGap = GAP, sleep = ms => new Promise(r => setTimeout(r, ms));
      playing = token; GAP = gap;
      if (demo.question) question = String(demo.question).slice(0, 200);
      chosen = demo.chosen || null;
      try {
        for (const step of demo.tape || []) {
          if (playing !== token) return;
          if (step.answers && step.answers.length) { lastBatch = step.answers; onAnswers(step.answers); await sleep(1300); if (playing !== token) return; }
          replaying = true; try { apply(step.patch, step.opts); } finally { replaying = false; }
          tape.push(step); done();
          await sleep(step.opts.opening ? 2500 : Math.max(1500, revealClock - Date.now() + 1200));
        }
      } finally { GAP = keepGap; if (playing === token) { playing = null; done(); } }
    },
    tape: () => ({ question, chosen, tape }),
    // a reply posted by whoever is acting as director (test-session mode)
    reply(b) {
      const patch = b.patch || b;
      if (b.draw) { const a = (patch.add || [])[0]; if (!a) return { rejected: ['no element in reply'] }; return apply({ add: [a], _job: jobs.find(j => j.n === Number(b.job)) }, { partial: true }); }
      if (b.fast) {
        const cap = Math.max(maxAdd(inFlight), issuedCap), answers = lastBatch, newOk = Math.max(newCap(inFlight), issuedNew);
        const out = apply({ ...patch, add: [] }, {});
        // Nothing is thrown away: briefs within this round's allowance are drawn first; the rest wait in the
        // backlog behind anything already queued, and are drawn when a cartoonist is free.
        const all = (Array.isArray(patch.draw) ? patch.draw : []).filter(d => d && d.id), now = [], later = []; let fresh = 0;
        for (const d of all) { const isNew = !live.has(d.id); if (now.length < cap && (!isNew || ++fresh <= newOk)) now.push(d); else later.push(d); }
        drawQueue = drawQueue.filter(q => !all.some(d => d.id === q.brief.id));          // a newer brief for the same element replaces the queued one
        drawQueue = [...now.map(d => ({ brief: d, answers })), ...drawQueue, ...later.map(d => ({ brief: d, answers, backlog: true }))].slice(0, 24);
        wakeDraw(); wake();
        return { ...out, toDraw: now.map(d => d.id), backlog: later.map(d => d.id) };
      }
      return apply(patch, { opening: !!b.opening, final: !!b.final });
    },
    tick(done) { if (endsAt && !isFinal && Date.now() > endsAt) { endsAt = 0; settleNow = true; wantFinal = true; sessionMode() ? wake() : pump(done); } },
    control(b, done) {
      if (typeof b.abstraction === 'number') settings.abstraction = clamp(b.abstraction);
      if (typeof b.magnitude === 'number') settings.magnitude = clamp(b.magnitude);
      if (typeof b.zoom === 'number') camera = { ...camera, zoom: clamp(b.zoom, 0.6, 1.6) };
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
    seen: () => answersSeen,
    status: () => ({ mode: mode(), model, question, phase: phase(), settings, effectiveMagnitude: effMag(), secondsLeft: endsAt ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : null, answersSeen, concepts, chosen, themes: scene().themes, feelings: { session: total, lately: recent }, atmosphere: atmosphere(), journal: journal.slice(-12), lastError, calls: calls.slice(-20), elements: [...live.values()].map(e => ({ id: e.id, theme: e.theme, layer: e.layer, params: e.params, chars: e.code.length, desc: e.desc })) }),
    reset(fresh) { clear(); if (fresh) { try { fs.unlinkSync(cacheFile()); } catch {} } else loadOpening(); },
  };
}
