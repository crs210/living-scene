// The two side panels on the display: the director at work (D) and the scene as code (C).
import { info } from './stage.js';
import { moodT } from './kit.js';

// ---------- developer panel: the director at work ----------
let devScene = null;
export function renderDev(scene, quiet = false) {   // quiet: remember the scene but do not redraw the panel
  if (scene) devScene = scene; const sc0 = devScene, d = sc0 ? sc0.dev || null : null, box = document.getElementById('dev'); if (!box || !sc0 || quiet) return;
  const keep = box.scrollTop; box.innerHTML = '';
  const add = (parent, tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; parent.append(e); return e; };
  const secs = ms => (ms / 1000).toFixed(ms < 10000 ? 1 : 0) + ' s', tok = ch => '~' + (ch / 4000).toFixed(1) + 'k tokens';
  add(box, 'h3', '', 'DIRECTOR');
  add(box, 'div', 'dim', sc0.mode + '  ·  phase ' + sc0.phase + '  ·  ' + sc0.els.length + ' elements  ·  abstraction ' + sc0.settings.abstraction + ', magnitude ' + sc0.settings.magnitude);
  if (!d) { add(box, 'div', 'dim', 'No director log in this mode.'); return; }
  const jobs = d.jobs || [], open = jobs.filter(j => !j.doneAt), done = jobs.filter(j => j.doneAt).reverse();
  add(box, 'h3', '', '0  DONE AT ONCE BY THE APP, NO MODEL');
  if (!(d.instant || []).length) add(box, 'div', 'dim', 'nothing yet');
  for (const i of d.instant || []) add(box, 'div', i.theme ? 'hot' : 'dim', '· ' + i.text + (i.theme ? '   ->  repeat of ' + i.theme + ': grown and flashed' : '') + (i.v ? '   mood ' + (i.v > 0 ? '+' : '') + i.v : ''));
  add(box, 'h3', '', '1  WAITING TO BE READ  (' + d.queue.length + ')');
  if (!d.queue.length) add(box, 'div', 'dim', 'nothing waiting'); for (const a of d.queue) add(box, 'div', 'ans', '· ' + a);
  add(box, 'h3', '', '2  WITH THE DIRECTOR  (' + open.length + ')');
  if (!open.length) add(box, 'div', 'dim', 'idle');
  if (d.toDraw && d.toDraw.length) add(box, 'div', 'dim', 'waiting for a free cartoonist: ' + d.toDraw.join(', '));
  for (const j of open) {
    const b = add(box, 'div', 'job live');
    add(b, 'div', 'hot', '#' + j.n + ' ' + j.kind + '  ·  ' + secs(d.now - j.sentAt) + ' so far  ·  prompt ' + tok(j.promptChars) + ' (' + tok(j.requestChars) + ' of it changes each time)');
    if (j.brief) add(b, 'div', 'dim', 'brief: ' + j.brief);
    for (const a of j.answers) add(b, 'div', 'ans', '· ' + a);
  }
  const coming = done.flatMap(j => (j.pieces || []).filter(p => p.revealAt > d.now).map(p => ({ ...p, job: j.n }))).sort((a, b) => a.revealAt - b.revealAt);
  add(box, 'h3', '', '3  ARRIVING IN THE PICTURE  (' + coming.length + ')');
  if (!coming.length) add(box, 'div', 'dim', 'nothing queued');
  for (const p of coming) add(box, 'div', 'hot', 'in ' + Math.ceil((p.revealAt - d.now) / 1000) + ' s   ' + p.id + '  (' + p.what + (p.enter ? ', ' + p.enter : '') + ')  from #' + p.job);
  add(box, 'h3', '', '4  DONE  (latest first)');
  if (!done.length) add(box, 'div', 'dim', 'nothing yet');
  for (const j of done) {
    const b = add(box, 'div', 'job');
    add(b, 'div', '', '#' + j.n + ' ' + j.kind + '  ·  took ' + secs(j.ms) + (j.answers.length ? '  ·  ' + j.answers.length + ' answer' + (j.answers.length === 1 ? '' : 's') : '') + (j.promptChars ? '  ·  prompt ' + tok(j.promptChars) : ''));
    for (const a of j.answers) add(b, 'div', 'ans', '· ' + a);
    if (j.feelings) add(b, 'div', 'dim', 'felt: ' + j.feelings);
    for (const i of j.ideas || []) add(b, 'div', 'dim', 'idea: ' + i.theme + ' x' + i.n + ' (' + i.gist + ')' + (i.touches.length ? '  ->  changes ' + i.touches.join(', ') : ''));
    if (j.briefs && j.briefs.length) add(b, 'div', 'dim', 'sent to be drawn: ' + j.briefs.join(', '));
    for (const p of j.pieces || []) add(b, 'div', p.revealAt > d.now ? 'hot' : '', (p.what === 'new' ? '+ ' : p.what === 'rewrite' ? '~ ' : '- ') + p.id + '  ' + p.what + (p.theme ? ' [' + p.theme + ']' : '') + (p.chars ? '  ' + p.chars + ' chars' : '') + (p.desc ? '  ' + p.desc : ''));
    if (j.set && j.set.length) add(b, 'div', 'dim', 'numbers moved on: ' + j.set.join(', '));
    if (j.rejected && j.rejected.length) add(b, 'div', 'bad', 'NOT APPLIED: ' + j.rejected.join(', '));
    if (j.note) add(b, 'div', 'dim', 'says: ' + j.note);
  }
  box.scrollTop = keep;
}
// ---------- scene code panel ----------
export function renderCodePanel(themes = []) {
  if (!document.body.classList.contains('code')) return;
  const codeEl = document.getElementById('code'), { order, mode, fps, phase, note, quality, latestId, els } = info();
  codeEl.innerHTML = '';
  const add = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; d.textContent = text; codeEl.append(d); return d; };
  add('h3', '', `Scene: ${order.length} elements (${mode})   ${fps.toFixed(0)} fps   phase: ${phase}`);
  if (note) add('div', 'new', 'The picture now says: ' + note);
  if (themes.length) add('div', 'el', 'themes  ' + themes.map(th => `${th.key} x${th.count} (w ${th.w})`).join('   '));
  add('div', 'el', `quality scaler ${quality.toFixed(2)}`);
  add('div', 'el', 'atmosphere  ' + Object.entries(moodT).filter(e => Math.abs(e[1]) > 0.02).map(([a, b]) => `${a} ${(+b).toFixed(2)}`).join('  '));
  for (const [id, el] of order) add('div', id === latestId ? 'new' : 'el', `${id === latestId ? '▶ ' : '  '}${id}${el.theme ? ' [' + el.theme + ']' : ''}${el.tooSlow ? ' (SWITCHED OFF: too slow)' : el.errors > 3 ? ' (SWITCHED OFF: errors)' : ''}  ${(el.cost || 0).toFixed(1)} ms  ${JSON.stringify(Object.fromEntries(Object.entries(el.tgt).map(([a, b]) => [a, +(+b).toFixed(2)])))}`);
  const el = els.get(latestId);
  if (el) { add('h3', '', '').style.marginTop = '2vh'; add('h3', '', `Latest element written: "${latestId}"`); add('div', 'el', el.desc || ''); add('div', '', '\n' + el.code.trim()); }
}
