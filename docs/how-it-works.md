# How it works

## The ideas

1. **Claude writes the picture as code.** The scene is a list of elements. Each element is a small
   drawing function written by the model against a fixed drawing kit. The kit enforces one comic
   style (ink lines, halftone dots, grain), so everything looks like it belongs together.
2. **Numbers glide, code arrives.** Each element has named numbers. The display eases them toward
   their targets every frame, so changes glide. The model can move numbers cheaply, or rewrite an
   element when the thing itself must change; a rewrite inks in over the old drawing.
3. **The question drives the opening.** The host presses *Propose opening scenes*; the model offers
   four stages (literal, metaphorical, surreal, nearly empty). The host picks one or types their
   own. The opening is a stage for answers to change, not an answer itself.
4. **Feelings set the look.** Each batch is scored on nine feelings (hope, dread, wonder, anger,
   grief, belonging, agency, unease, urgency). The app turns them into atmosphere: light, warmth,
   rain, mist, wind, decay, bloom, tension. Every element is written to show its own wear and
   flourishing from that atmosphere. Rain is the one held back: it needs a sadness that lasts
   (most of the session, not one batch), and fades in over the first twenty or so answers.
5. **Repeats grow by themselves.** Each answer is sorted into a theme. The app tallies themes and
   feeds each theme's share of the room to its elements. An idea said twenty times is large without
   being redrawn (on screen, from about 0.8x to 1.24x its drawn size); themes the room drops shrink,
   fade and move aside.
6. **The answers list shows what was used.** The director says which answers went into each idea.
   An answer turns green once an element for its idea is on show, not merely when it has been read;
   an answer that fits no idea stays white. "×3" on an answer means three people have now said it.
7. **Edit and combine before adding.** Only a few brand-new elements are allowed per batch. Most
   changes are rewrites that work new ideas into what is already there.
8. **The picture goes on a journey, then settles.** Phases: upheaval (early answers must rewrite
   the opening), building, settling, and one final composed image that is held and saved.

## The flow: two speeds

```
 phone ── answer ──▶ server ──▶ instant layer (no model, under a second)
                        │          · a first nudge to the mood
                        │          · a plain repeat (it names a theme, or says the same as an
                        │            earlier answer) grows and flashes its element, and turns green
                        │
                        └─ batch ─▶ director model
                                     1. fast pass   (about 8 s): feelings, themes, number changes,
                                                     camera, and a brief for each thing to draw
                                     2. draw passes (about 10 s each, in parallel): one element each
                                   ──▶ pieces are revealed one at a time, each with its own entrance
```

- Everything received in a second goes to the model as one batch. Answers that arrive while it is
  busy wait and go together next time, so there is never a backlog of stale requests.
- Briefs beyond a round's allowance wait in a backlog and are drawn when there is capacity. New
  answers are always read before more of the backlog is drawn.
- The display receives the whole scene once a second over Server-Sent Events and animates toward it.

## An element

`{ id, theme, layer, box, at, enter, desc, code, params }`

- `code` is the body of `function (k, p, t, m)`: `k` the drawing kit, `p` the element's eased
  numbers (plus `p.w`, its theme's share of the room), `t` seconds, `m` the atmosphere.
- `layer` 0 is the backdrop, 9 the nearest foreground. `box` is the rectangle it covers, `at`
  where it stands, `enter` how it arrives (rise, drop, slide, grow, fade).
- The canvas is a 1600 x 900 stage.

## What the model replies

```
{ "feelings": { hope, dread, ... each 0..1 },
  "ideas":   [{ "theme", "n", "answers": [1, 4], "gist", "touches": ["id"] }],
                                                             answers: numbers in the batch list
  "set":     [{ "id", "params": [{ name, value }] }],        move numbers on existing elements
  "add":     [{ "id", "theme", "layer", "box", "at", "enter", "desc", "code", "params" }],
                                                             a new element, or a rewrite if the id exists
  "remove":  ["id"],
  "camera":  { "zoom", "focus": [x, y] },                    optional: pull back or close in
  "note":    "one sentence: what the picture now says" }
```

The full instructions are in `src/prompt.js`. `GET /api/settings` shows the live state: phase,
themes and weights, feelings, atmosphere, the journey so far and every element.

## Who plays the director

| Mode | How | Notes |
|---|---|---|
| API | `ANTHROPIC_API_KEY` in `.env` | Automatic. This is the normal way to run it. |
| Mock | `DIRECTOR_MOCK=1` | Canned replies through the same pipeline. Tests plumbing, free. |
| Recorded | press `0` | Replays a file from `demos/` on a timer. No model. |
| Manual | no key | Requests wait in a queue. Something answers them with `tools/director-wait.js` and `tools/director-reply.js` (usage is at the top of each file). This is how the project was built before it had a key. |

## Settings (environment variables, or lines in `.env`)

| Name | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on API mode |
| `DIRECTOR_MODEL` | `claude-sonnet-5-5` | The model that reads the room |
| `DRAW_MODEL` | same as above | The model that writes drawings |
| `MAX_API_CALLS` | 500 | Requests to the model per session before it stops |
| `HOST_KEY` | none | Lets a display that is not on the app's own computer use the host controls: open `/comic?key=<HOST_KEY>` |
| `PORT` | 3000 | |
| `QUESTION` | the AI question | The question at start-up |
| `PUBLIC_URL` | worked out from the network | The address shown to phones |
| `STAGGER_MS` | 3500 | Gap between arriving pieces |
| `CACHE_DIR`, `SESSIONS_DIR` | `.cache`, `sessions` | Where openings and finished sessions are kept |

## Host controls (`S` on the display)

- **Abstraction**: literal to dreamlike. Changes the instructions the model gets.
- **Magnitude**: gentle to bold. How many elements may change per batch, and how hard mood shifts the look.
- **View**: pull the camera back or close in. The model may move it too.
- **Start session / Settle now / Final image**: the session clock and its manual overrides.
- **Propose opening scenes / Use mine / New scene from question**.
- **Play demo**, **Save picture**, **Clear answers** (empties the list; the picture stays).

## Recording and replay

Every session is recorded as it runs. `POST /api/demo {"save":"name"}` keeps the current one as
`demos/name.json`; `POST /api/demo {"name":"name"}` replays it; with no name the newest plays.
A replay shows the display, the animation and the timing. It does not show what a model would
draw for new answers.
