# Living Scene

A live audience answers an open question on their phones. One comic-book panel on the projector
changes as they answer, and settles into a single image of how the room replied.

There is no image or video model. Claude writes the picture as small drawing programs against a
fixed comic-style drawing kit, and the browser animates between states.

## Run it

```
npm install             # once
copy .env.example .env  # then put your Anthropic API key in .env (git ignores it)
node server.js          # Node 20.12 or newer
npm test                # self-check: 41 checks of the plumbing, about 45 seconds, no model needed
```

- Display (projector, on the computer running the app): http://localhost:3000/comic
- Answers (phones on the same network): the address and QR code shown on the display
- With a key in `.env` the app directs itself through the Claude API. Without one it still starts, and waits
  for a Claude Code session to play the director (see below).
- **Never commit `.env` or paste a key into code, an issue or a chat.** Each person uses their own key.

Display keys: `0` play the recorded demo, `S` controls, `D` director panel, `C` scene code, `P` save picture, `F` feed,
`H` hide everything but the picture, `R` reset, `1`-`4` send an example answer.

## How it works

1. **The question drives the opening.** The host presses *Propose opening scenes*; the director
   offers four stages (literal, metaphorical, surreal, nearly empty). The host picks one or types
   their own, and it is drawn as 6 to 8 elements. The opening is a stage, not the answer.
2. **Two speeds.** The second an answer is accepted the app itself, with no model, nudges the mood and,
   if the answer plainly repeats an idea already in the picture, grows and flashes that element.
   Everything that needs judgement or drawing goes to the director at its own pace.
3. **Answers reach the director in batches.** Everything received in a second goes together; anything arriving
   while the director is busy waits for the next request. Nothing stale is queued.
4. **The director replies with:** nine feelings; which theme each answer joins and which existing
   elements it touches; new numbers for elements; new or rewritten elements as code; removals; an optional
   camera move (pull back or close in); one sentence on what the picture now says.
5. **The app does the rest:**
   - feelings become atmosphere (light, warmth, rain, mist, wind, decay, bloom, tension), and every
     element is written to show its own wear and flourishing from it;
   - each theme's share of the room is fed to its elements as `p.w`, so repeats grow by themselves;
   - themes the room stops voicing recede (smaller, fainter, moved aside); elements are deleted only
     when the scene is over-full, and opening landmarks never;
   - the pieces of a reply are revealed one at a time, each with its own entrance;
   - an idea that is voiced again makes its element pop and grow on the spot;
   - the director is told what is piled on top of what and where open ground remains, and may add
     only a few brand-new elements per batch, so most changes are rewrites that combine ideas.
6. **The session has phases:** upheaval (early answers must rewrite the opening), building,
   settling, and one final composed image that is held and saved to `sessions/`.

An element is `{ id, theme, layer, at, enter, desc, code, params }`. `code` is the body of
`function (k, p, t, m)`: `k` the drawing kit, `p` its eased numbers, `t` seconds, `m` the atmosphere.

## The recorded demo

Press `0` on the display (or *Play demo* in the controls) to replay a recorded session on a timer:
an opening, then three batches of answers, about half a minute, with no model running. It shows
the answers arriving, turning green, and the picture changing piece by piece. The display says it
is a replay while it runs.

- The demos are real Claude Sonnet sessions recorded on 2026-11-21, replayed as written. The newest file in
  `demos/` plays by default (`ai-two-speed`: a two-speed worker, with a camera move).
- Every session is recorded as it runs. `POST /api/demo {"save":"name"}` keeps the current one as
  `demos/name.json`; `POST /api/demo {"name":"name"}` replays it; finished sessions in `sessions/`
  carry the same recording.
- A replay tests the display, the animation and the timing. It does not test what a model would
  draw for new answers; for that, run a director and send `node tools/replay.js ai 1`.

## Who plays the director

| Mode | How | Notes |
|---|---|---|
| Test session (default) | no API key | Requests wait in a queue for a Claude Code session to answer with `tools/director-wait.js` and `tools/director-reply.js`. One worker in two steps (`--role solo`: a quick read of each batch, then the drawings one at a time, new answers always read first), one worker doing a whole batch per reply (no role), or a reader (`--role read`) plus several cartoonists (`--role draw`). Briefs beyond a round's allowance wait in a backlog; nothing is dropped. See `HANDOFF.md` for the worker briefs. |
| API | `ANTHROPIC_API_KEY` in `.env` | Automatic: a fast pass (feelings, themes, numbers, briefs), then one request per drawing in parallel. `DIRECTOR_MODEL` reads the room, `DRAW_MODEL` draws (both default `claude-sonnet-5-5`). First run for real on 2026-11-21. |
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
- Repeats and a first mood shift are instant (no model).
- Through the API with Sonnet 5.5 (measured 2026-11-21, three batches of four or five answers): the opening took
  18 seconds; each batch was read in 8 to 9 seconds and had all its drawings in after 20 to 23 seconds. That whole
  run (an opening and three batches, 15 requests) used about 23,500 output tokens, roughly 30 US cents.
- The figures below are for Claude Code workers standing in for the API, which are slower:
- One Sonnet worker, whole batch per reply: 35 to 50 seconds from answers to picture.
- One Sonnet worker in two steps: answers read in 15 to 30 seconds, then one drawing every 14 to 21 seconds;
  eight drawings took about two minutes to all arrive.
- Reader plus cartoonists: answers are read in 12 to 15 seconds; each drawing then takes 12 to 44.
- These are Claude Code stand-in timings. Real API speed has never been measured.

**It needs a director, and that costs something**
- With an API key every batch of answers costs money (a few cents on Sonnet), and so does each opening.
  Cost follows the number of batches, not the number of people. There is no spending cap in the app.
- The API path has had one real run. Requests are not streamed, so output is capped at 16,000 tokens for
  an opening and 8,000 for a drawing; refusals are reported but there is no fallback model.
- Without a key nothing happens until a Claude Code worker answers the queue, and every worker uses
  subscription allowance, including while it waits.

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
