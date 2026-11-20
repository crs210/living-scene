// Basic audience-appropriate filtering. Runs BEFORE a submission is published to
// the feed or allowed to influence the scene. Deliberately simple: a blocklist with
// light de-obfuscation, contact-detail rejection, and length limits. It will not
// catch names of real people or clever abuse: for a public room, add a moderator hold.

const INCLUDES = ['fuck', 'fuk', 'shit', 'cunt', 'nigg', 'faggot', 'bitch', 'whore', 'slut', 'asshole', 'arsehole', 'wank', 'motherf'];
const EXACT = new Set(['ass', 'arse', 'dick', 'dicks', 'cock', 'cocks', 'pussy', 'twat', 'fag', 'fags', 'retard', 'retarded',
  'rape', 'raped', 'rapist', 'kys', 'cum', 'porn', 'tits', 'penis', 'vagina', 'spic', 'kike', 'chink', 'tranny', 'paki']);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', '$': 's', '!': 'i' };

const norm = w => w.toLowerCase().replace(/[013457@$!]/g, c => LEET[c]).replace(/[^a-z]/g, '');
const squeeze = w => w.replace(/(.)\1+/g, '$1');

export function filterSubmission(raw) {
  let text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if ((text.match(/[a-zA-Z]/g) || []).length < 3) return { ok: false, reason: 'Say a little more?' };
  if (text.length > 240) return { ok: false, reason: 'Please keep it under 240 characters.' };
  if (/(https?:\/\/|www\.|\b[\w-]+\.(com|net|org|io|co|ly)\b)/i.test(text) || /\S+@\S+\.\S+/.test(text) ||
      /(\+?\d[\s-.]?){8,}/.test(text) || /(^|\s)@\w{2,}/.test(text)) {
    return { ok: false, reason: 'Please leave out links, handles and contact details.' };
  }
  const tokens = text.split(/\s+/);
  // join runs of single letters: "f u c k" -> "fuck"
  const joined = [];
  let run = '';
  for (const t of tokens) {
    if (norm(t).length === 1) { run += norm(t); continue; }
    if (run) { joined.push(run); run = ''; }
    joined.push(t);
  }
  if (run) joined.push(run);
  for (const t of joined) {
    for (const part of t.split(/[-_/.,]+/).concat(t)) {
      const n = norm(part), s = squeeze(n);
      if (EXACT.has(n) || EXACT.has(s) || INCLUDES.some(b => n.includes(b) || s.includes(squeeze(b)))) {
        return { ok: false, reason: 'Please rephrase that for a mixed audience.' };
      }
    }
  }
  return { ok: true, text };
}
