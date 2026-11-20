# Living Scene

A live audience answers an open question on their phones. One comic-book panel on the projector
changes as they answer, and settles into a single image of how the room replied.

## Run it

```
node server.js
```

- Display (projector): http://localhost:3000/comic
- Answers (phones): http://localhost:3000/ (QR code is on the display)
- Keys on the display: `S` controls, `D` director panel, `C` scene code and themes, `P` save picture, `F` feed, `H` hide all, `R` reset

## How it works

1. **The question drives the opening.** The host presses *Propose opening scenes* and Claude offers
   four different stages (literal, metaphorical, surreal, nearly empty). The host picks one, or types
   their own. Claude then draws it as 6 to 8 elements. The opening is a stage, not the answer.
2. **Answers arrive in batches.** Anything sent while Claude is working goes together in the next request.
3. **Claude returns four things per batch:**
   - nine feelings (hope, dread, wonder, anger, grief, belonging, agency, unease, urgency)
   - which theme each answer belongs to, reusing earlier themes for the same idea
   - new numbers for existing elements, new elements as drawing code, and removals
   - one sentence on what the picture now says
4. **The app does the rest without Claude:**
   - feelings become atmosphere: light, warmth, colour drain, rain, mist, wind, shaky lines, sparkle
   - every element shows its own wear and bloom from that atmosphere
   - each theme's share of the room is fed to its elements as `p.w`, so repeats grow by themselves
   - weak themes are pruned when the scene is full
5. **The session has phases.** Early answers are told to overturn the opening; the middle reinforces
   what repeats; the last fifth converges; then one final image is composed and held.

## Controls (`S`)

- **Abstraction**: literal to dreamlike. Changes the instructions Claude gets.
- **Magnitude**: gentle to bold. Sets how many elements may change per batch and how hard tone shifts the look.
- **Start session / Settle now / Final image**: the session clock and its manual overrides.
- **Propose opening scenes / Use mine / New scene from question**.

## Modes

| Mode | When | What happens |
|---|---|---|
| Test session | no API key (default) | Requests queue; a Claude Code session answers them with `tools/director-wait.js` and `tools/director-reply.js`. Tests quality, not speed. |
| API | `ANTHROPIC_API_KEY` set | Automatic. A fast pass (feelings, themes, numbers) lands first; drawings follow in parallel. Model from `DIRECTOR_MODEL`, default `claude-sonnet-5-5`. **Not yet run.** |
| Recorded demo | `DIRECTOR_RECORDED=1` | A pre-written harbour driven by a keyword matcher. Not Claude. |

## Testing

- `node tools/replay.js ai 1` sends a scripted batch (sets: `ai`, `home`, `city`). The answers cover
  the kinds of thing people say: named things, bare feelings, opinions, questions, memories,
  contradictions, predictions, processes and repeats.
- `GET /api/settings` shows phase, themes and weights, feelings, atmosphere, the journey and every element.

## Files

- `src/director.js`: the prompt, themes, atmosphere, phases, API and test-session modes
- `public/comic.js`: the renderer and drawing kit (the fixed comic style)
- `server.js`: answers in, filtering, scene out
- `public/display.js` and `src/comic-library.js`: the earlier hand-built versions, kept for reference

## Known limits

- Scene code written by the model is run in the display page behind a word blocklist, not a real sandbox.
- API mode, the session clock and bursts of many answers have not been tested end to end.
