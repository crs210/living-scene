// The only file that talks to the Claude API. Given the kind of request and its prompt, it returns the model's
// reply as a checked object. Also holds the canned replies used by DIRECTOR_MOCK=1 to test the plumbing.
import { F } from './prompt.js';

let client = null, formats = null;
async function setUp() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { z } = await import('zod'); const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
  const P = z.array(z.object({ name: z.string(), value: z.number() }));
  formats = {
    patch: zodOutputFormat(z.object({
      feelings: z.object(Object.fromEntries(F.map(f => [f, z.number()]))),
      ideas: z.array(z.object({ theme: z.string(), n: z.number(), gist: z.string(), touches: z.array(z.string()) })),
      set: z.array(z.object({ id: z.string(), params: P })),
      add: z.array(z.object({ id: z.string(), theme: z.string(), layer: z.number(), box: z.array(z.number()), at: z.array(z.number()), enter: z.enum(['rise', 'drop', 'slide', 'grow', 'fade']), desc: z.string(), code: z.string(), params: P })),
      camera: z.object({ zoom: z.number(), focus: z.array(z.number()) }),
      draw: z.array(z.object({ id: z.string(), theme: z.string(), layer: z.number(), brief: z.string() })),
      remove: z.array(z.string()), note: z.string(),
    })),
    concepts: zodOutputFormat(z.object({ concepts: z.array(z.object({ title: z.string(), pitch: z.string(), room: z.string() })) })),
  };
  client = new Anthropic();           // reads ANTHROPIC_API_KEY from the environment
}

// kind: 'concepts' | 'open' | 'fast' | 'draw' | 'patch' | 'final'.   prompt: { system, user }
export async function callModel(kind, prompt, model) {
  if (!client) await setUp();
  const t0 = performance.now();
  const res = await client.messages.parse({
    model,
    max_tokens: kind === 'open' ? 16000 : kind === 'fast' || kind === 'concepts' ? 4000 : 8000,   // larger values would need streaming
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],          // identical on every call, so it is cached
    output_config: { format: kind === 'concepts' ? formats.concepts : formats.patch, effort: 'low' },
    messages: [{ role: 'user', content: prompt.user }],
  });
  return { out: res.stop_reason === 'refusal' ? null : res.parsed_output, refused: res.stop_reason === 'refusal', ms: Math.round(performance.now() - t0),
    outputTokens: res.usage?.output_tokens, cachedTokens: res.usage?.cache_read_input_tokens };
}

// Canned replies with realistic delays: no network, no cost. n = how many calls have been made so far.
export async function mockReply(kind, answers = [], extra, n = 0) {
  const t0 = performance.now(), wait = ms => new Promise(r => setTimeout(r, ms)), zero = Object.fromEntries(F.map(f => [f, 0]));
  const blob = (id, theme, x) => ({ id, theme, layer: 5, desc: 'mock ' + id, code: "var d = m.decay, b = m.bloom; k.blob(" + x + ", 520, 40 + 160 * (p.w || 1), 40 + 120 * (p.w || 1), k.mix('#57c7c2', '#6f6a80', d), { lw: 5 }); if (b > 0.3) k.sparkle(" + x + ", 380, 20);", params: [] });
  let out;
  if (kind === 'concepts') { await wait(400); out = { concepts: [{ title: 'Mock stage', pitch: 'A flat field.', room: 'Anything.' }] }; }
  else if (kind === 'open') { await wait(1500); out = { add: [{ id: 'sky', layer: 0, desc: 'mock sky', code: "k.rect(0, 0, 1600, 900, k.mix('#27364f', '#7fb7c9', m.light), { lw: 0 });", params: [] }, { id: 'ground', layer: 1, desc: 'mock ground', code: "k.rect(0, 600, 1600, 300, '#6fa35a', { lw: 4 });", params: [] }], note: 'mock opening' }; }
  else if (kind === 'draw') { await wait(1800 + Math.random() * 800); out = { add: [blob(extra.id, extra.theme, 200 + (n * 170) % 1200)] }; }
  else { await wait(kind === 'fast' ? 500 : 900); const theme = 'theme-' + (answers.length % 3); out = { feelings: { ...zero, hope: 0.4, unease: 0.3 }, ideas: [{ theme, n: answers.length || 1, gist: 'mock idea' }], set: [], add: [], draw: kind === 'fast' ? [{ id: 'm' + n, theme, layer: 5, brief: 'a blob' }, { id: 'n' + n, theme: 'theme-x', layer: 5, brief: 'another' }] : [], remove: [], note: 'mock note ' + n }; }
  return { out, refused: false, ms: Math.round(performance.now() - t0) };
}
