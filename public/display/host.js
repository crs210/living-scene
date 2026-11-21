// The display page: connects to the app, shows the feed, and wires the host's controls and keys.
import { cv, moodT } from './kit.js';
import { applyScene, info, pop, start } from './stage.js';
import { renderDev, renderCodePanel } from './panels.js';

const feedEl = document.getElementById('feed');
let slidersTouched = false, themesNow = [], conceptsNow = [], chosenNow = null;

// Host actions (settings, reset, demo) are accepted from the computer running the app, or from a display opened
// with the host key in its address: /comic?key=... (the key is HOST_KEY in the app's settings).
const qs = new URLSearchParams(location.search);
let hostKey = qs.get('key') || ''; try { if (hostKey) sessionStorage.setItem('hostKey', hostKey); else hostKey = sessionStorage.getItem('hostKey') || ''; } catch {}
const hostPost = (url, body = {}) => fetch(url, { method: 'POST', headers: hostKey ? { 'x-host-key': hostKey } : {}, body: JSON.stringify(body) }).then(r => {
  if (r.status === 403) alert('Host controls are locked on this screen. Open the display at localhost on the computer running the app, or add ?key= followed by the host key to its address.');
  return r;
});

// everything about a new scene that is the page's business rather than the stage's
function showScene(scene) {
  renderDev(scene, !document.body.classList.contains('dev'));
  if (scene.question) document.getElementById('q').textContent = scene.question;
  if (scene.camera) { const z = document.getElementById('zoom'); if (z && document.activeElement !== z) z.value = scene.camera.zoom; }
  themesNow = scene.themes || [];
  if (JSON.stringify(scene.concepts || []) !== JSON.stringify(conceptsNow) || scene.chosen !== chosenNow) { conceptsNow = scene.concepts || []; chosenNow = scene.chosen; renderConcepts(); }
  if (scene.settings && !slidersTouched) for (const key of ['abstraction', 'magnitude']) { const inp = document.getElementById(key); if (inp) inp.value = scene.settings[key]; }
  document.getElementById('keys').textContent = 'Scene written by ' + scene.mode + '  ·  S controls · 0 demo · D director · C scene code · P save picture · F feed · H hide all · R reset';
  applyScene(scene);
  renderCodePanel(themesNow);
}

const es = new EventSource('/events');
es.addEventListener('state', msg => {
  const s = JSON.parse(msg.data);
  if (s.scene) showScene(s.scene);
  // People typing right now put a breeze through the picture. Everything else about the mood is the director's.
  const stir = s.typing && s.typing.n ? Math.min(1, s.typing.n / 4) * (0.5 + 0.5 * s.typing.energy) : 0;
  if (s.scene && s.scene.m) moodT.wind = Math.min(1, (s.scene.m.wind || 0) + 0.3 * stir);
  const have = new Set([...feedEl.children].map(c => +c.dataset.id)), want = new Set(s.feed.map(f => f.id));
  for (const c of [...feedEl.children]) if (!want.has(+c.dataset.id)) c.remove();
  for (const f of s.feed.slice(0, 9).reverse()) if (!have.has(f.id)) { const d = document.createElement('div'); d.dataset.id = f.id; d.textContent = f.text; feedEl.prepend(d); }
  const inPicture = new Set(s.feed.filter(f => f.in).map(f => f.id));       // answers the director has worked into the picture change colour
  for (const c of feedEl.children) c.classList.toggle('in', inPicture.has(+c.dataset.id));
});
es.addEventListener('accept', pop);
fetch('/api/config').then(r => r.json()).then(c => {
  document.getElementById('q').textContent = c.question; document.getElementById('url').textContent = c.joinUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const qr = document.getElementById('qr'); qr.onerror = () => qr.remove(); qr.src = '/qr.svg';
});
// sliders: abstraction (how literal or dreamlike) and magnitude (how much each batch changes)
const setting = b => hostPost('/api/settings', b);
document.getElementById('zoom').addEventListener('input', e => setting({ zoom: +e.target.value }));
for (const key of ['abstraction', 'magnitude']) document.getElementById(key).addEventListener('input', e => { slidersTouched = true; setting({ [key]: +e.target.value }); });
document.getElementById('start').onclick = () => setting({ start: +document.getElementById('secs').value || 120 });
document.getElementById('settle').onclick = () => setting({ settle: true });
document.getElementById('final').onclick = () => setting({ final: true });
document.getElementById('newq').onclick = () => { const q = document.getElementById('question').value.trim(); if (q) setting({ question: q }).then(() => { feedEl.innerHTML = ''; document.getElementById('q').textContent = q; }); };
// opening concepts: the host asks for proposals, then picks one (or types their own)
function renderConcepts() {
  const box = document.getElementById('concepts'); box.innerHTML = '';
  conceptsNow.forEach((cn, i) => { const b = document.createElement('button'); b.className = 'concept' + (cn.title === chosenNow ? ' on' : ''); const h = document.createElement('b'); h.textContent = cn.title; const p = document.createElement('span'); p.textContent = cn.pitch; b.append(h, p); b.onclick = () => setting({ concept: i }); box.append(b); });
}
// keep the picture: a PNG of the panel exactly as it stands
function savePicture() { cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'living-scene-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }); }
document.getElementById('savepic').onclick = savePicture;
// a recorded session replayed on a timer: about twenty seconds, no model involved
const playDemo = () => hostPost('/api/demo').then(r => { if (r.ok) feedEl.innerHTML = ''; });
document.getElementById('demo').onclick = playDemo;
document.getElementById('propose').onclick = () => setting({ propose: true });
document.getElementById('own').onclick = () => { const v = document.getElementById('ownconcept').value.trim(); if (v) setting({ concept: v }); };
const EXAMPLES = ['Honestly I just have a bad feeling about where this ends up', 'I worry hackers will use it to break into everything, but I hope it helps people understand each other', 'Cybersecurity. Every lock we rely on is going to fail', 'Excited about curing diseases, though my kids may never find jobs'];
addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (e.target.tagName === 'INPUT') return;
  if (key === 's') document.body.classList.toggle('controls');
  if (key === 'p') savePicture();
  if (key === '0') playDemo();
  if (key === 'f') document.body.classList.toggle('nofeed');
  if (key === 'h') document.body.classList.toggle('bare');
  if (key === 'd') { document.body.classList.toggle('dev'); renderDev(); }
  if (key === 'c') { document.body.classList.toggle('code'); renderCodePanel(themesNow); }
  if (key === 'r') hostPost('/api/reset').then(() => { feedEl.innerHTML = ''; });
  if (EXAMPLES[+key - 1]) fetch('/api/submit', { method: 'POST', body: JSON.stringify({ text: EXAMPLES[+key - 1], cid: 'demo' + Math.random() }) });
});
for (const c of ['bare', 'nofeed', 'code', 'dev']) if (qs.has(c)) document.body.classList.add(c);
window.comicDiag = () => { const i = info(); return { fps: Math.round(i.fps), Q: +i.quality.toFixed(2), phase: i.phase, themes: themesNow.map(th => th.key + ':' + th.count), els: i.order.map(([id, el]) => [id, el.errors]), slow: i.order.filter(e => e[1].tooSlow).map(e => e[0]), cost: Object.fromEntries(i.order.map(([id, el]) => [id, +(el.cost || 0).toFixed(2)])), mode: i.mode }; };
start();
