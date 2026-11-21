# Living Scene

A live audience answers an open question on their phones. One comic-book panel on the projector
changes as they answer, and settles into a single image of how the room replied.

There is no image or video model. Claude writes the picture as small drawing programs against a
fixed comic-style drawing kit, and the browser animates between states.

## Run it

```
node server.js          # Node 20 or newer; nothing to install for the default mode
npm test                # self-check: 35 checks of the plumbing, about 35 seconds, no model needed
```

- Display (projector, on the computer running the app): http://localhost:3000/comic
- Answers (phones on the same network): the address and QR code shown on the display
- `npm i` is only needed for the QR code (`qrcode`) and, in API mode, `@anthropic-ai/sdk` and `zod`.

Display keys: `0` play the recorded demo, `S` controls, `D` director panel, `C` scene code, `P` save picture, `F` feed,
`H` hide everything but the picture, `R` reset, `1`-`4` send an example answer.

## How it works

1. **The question drives the opening.** The host presses *Propose opening scenes*; the director
   offers four stages (literal, metaphorical, surreal, nearly empty). The host picks one or types
   their own, and it is drawn as 6 to 8 elements. The opening is a stage, not the answer.
2. **Answers arrive in batches.** Everything received in a second goes together; anything arriving
   while the director is busy waits for the next request. Nothing stale is queued.
3. **The director replies with:** nine feelings; which theme each answer joins and which existing
   elements it touches; new numbers for elements; new or rewritten elements as code; removals; one
   sentence on what the picture now says.
4. **The app does the rest:**
   - feelings become atmosphere (light, warmth, rain, mist, wind, decay, bloom, tension), and every
     element is written to show its own wear and flourishing from it;
   - each theme's share of the room is fed to its elements as `p.w`, so repeats grow by themselves;
   - themes the room stops voicing recede (smaller, fainter, moved aside); elements are deleted only
     when the scene is over-full, and opening landmarks never;
   - the pieces of a reply are revealed one at a time, each with its own entrance.
5. **The session has phases:** upheaval (early answers must rewrite the opening), building,
   settling, and one final composed image that is held and saved to `sessions/`.

An element is `{ id, theme, layer, at, enter, desc, code, params }`. `code` is the body of
`function (k, p, t, m)`: `k` the drawing kit, `p` its eased numbers, `t` seconds, `m` the atmosphere.

## The recorded demo

Press `0` on the display (or *Play demo* in the controls) to replay a recorded session on a timer:
an opening, then two batches of three answers, about 17 seconds, with no model running. It shows
the answers arriving, turning green, and the picture changing piece by piece. The display says it
is a replay while it runs.

- The demo is `demos/ai-sea.json`: a real Claude Sonnet session recorded on 2026-11-21, replayed as written.
- Every session is recorded as it runs. `POST /api/demo {"save":"name"}` keeps the current one as
  `demos/name.json`; `POST /api/demo {"name":"name"}` replays it; finished sessions in `sessions/`
  carry the same recording.
- A replay tests the display, the animation and the timing. It does not test what a model would
  draw for new answers; for that, run a director and send `node tools/replay.js ai 1`.

## Who plays the director

| Mode | How | Notes |
|---|---|---|
| Test session (default) | no API key | Requests wait in a queue for a Claude Code session to answer with `tools/director-wait.js` and `tools/director-reply.js`. Either one worker does everything, or a reader (`--role read`) plus several cartoonists (`--role draw`). See `HANDOFF.md` for the worker briefs. |
| API | `ANTHROPIC_API_KEY` set | Automatic: a fast pass (feelings, themes, numbers, briefs), then one request per drawing in parallel. `DIRECTOR_MODEL` reads the room, `DRAW_MODEL` draws (both default `claude-sonnet-5-5`). **Never run with a real key.** |
| Mock | `DIRECTOR_MOCK=1` | Canned replies through the API path. Tests plumbing only. |

Other settings: `PORT`, `QUESTION`, `PUBLIC_URL` (address shown to phones), `STAGGER_MS` (gap between
arriving pieces, default 3500), `CACHE_DIR`, `SESSIONS_DIR`.

## Controls (`S`)

- **Abstraction**: literal to dreamlike. Changes the instructions the director gets.
- **Magnitude**: gentle to bold. How many elements may change per batch, and how hard mood shifts the look.
- **Start session / Settle now / Final image**: the session clock and its manual overrides.
- **Propose opening scenes / Use mine / New scene from question**.

The controls work only at `localhost` on the computer running the app.

## Files

| File | What it holds |
|---|---|
| `server.js` | Answers in, filtering, batching, the scene out, the director's queue |
| `src/prompt.js` | Everything the director model is told. Edit here to change how the picture is directed |
| `src/director.js` | State and plumbing: themes, weights, receding, atmosphere, phases, staggered reveal, the three modes, the work log |
| `src/filter.js` | Basic word and contact-detail filter on answers |
| `public/comic.js`, `comic.html` | The display: drawing kit, renderer, print finish, host controls, director and code panels |
| `public/index.html`, `tone.js` | The answer page |
| `tools/selfcheck.js` | `npm test` |
| `tools/director-wait.js`, `director-reply.js` | The test-session director's two steps |
| `tools/replay.js`, `burst.js` | Scripted audiences (`ai`, `home`, `city`) and a many-answers-at-once test |

`.cache/` holds drawn openings and `sessions/` finished sessions; neither is in git.

## Testing

- `npm test` after any change. It checks batching, themes, staggered reveal, receding, the
  reader/cartoonist split, abandoned waits and the final image, with scripted replies.
- `node tools/replay.js ai 1` sends a scripted batch to a running app.
- `GET /api/settings` shows phase, themes and weights, feelings, atmosphere, the journey and every element.
- Whether the pictures are any good can only be judged by running a director and looking.

## Limitations

**Speed**
- One Sonnet worker takes 35 to 50 seconds from a batch of answers to its picture.
- Reader plus cartoonists: answers are read in 12 to 15 seconds; each drawing then takes 12 to 44.
- These are Claude Code stand-in timings. Real API speed has never been measured.

**It needs a director, and that costs something**
- Without an API key nothing happens until a Claude Code worker answers the queue, and every
  worker uses subscription allowance, including while it waits. Start workers only when someone is
  at the screen, prefer one, and give it a short idle limit.
- The API path is exercised only by mock replies.

**Safety**
- Model-written code runs in the display page behind a word blocklist, not a sandbox, and audience
  text steers what the model writes. Acceptable on a host's own laptop; not for an untrusted
  public deployment. A sandboxed renderer exists on the `sandboxed-renderer` branch, unverified.
- An element that throws is switched off after four errors, and one that is too slow to draw
  (three frames over 150 ms, or about two seconds averaging over 8 ms) is switched off too. A single
  call cannot be interrupted, so code that never returns would still freeze the display.
- The answer filter is a short English word list. The two-second limit per phone relies on an id
  the phone supplies, so it stops accidents, not abuse.

**Scale and state**
- One question and one picture per running app. Several rooms at once are not supported.
- Everything is in memory: restarting the app loses the session in progress.
- Tested with a 150-answer burst and a handful of displays, never with a real audience.
- Phones must be able to reach the computer: same network, no client isolation, or set `PUBLIC_URL`.
- The display's lettering comes from Google Fonts and falls back to system fonts offline.

**Picture quality**
- Sonnet tends to give each answer its own theme, so repetition counts for less than it should.
  Opus grouped better. Haiku draws acceptably but more crudely.
- The abstraction slider has little effect on openings.
- At most 14 arrived elements, 6,000 characters of code each; the final image may rewrite three.
- Frame rate and the look of the entrances have not been checked by eye in an ordinary browser.

## Versions

- `v0.2` (branch `main`): this set point.
- `v0.1-baseline`: the first comic display. `before-tidy`: the state just before the clean-up,
  including the older keyword-driven display that was removed.
- `sandboxed-renderer`: unverified experiment.
