# Working on Living Scene

## The loop

1. `git pull`, then make a branch: `git checkout -b short-name-for-the-change`.
2. Make the change. The table in the README says which file holds what.
3. `npm test`. All checks should pass.
4. Look at it: `node server.js`, open `/comic`, press `0` for the recorded demo.
5. Commit, push the branch, open a pull request into `main`. `main` should always work.

## Rules that keep it safe

- **Keys stay out of git.** Your key lives in `.env`, which is ignored. If a key is ever committed
  or pasted somewhere shared, revoke it in the Anthropic console; deleting the commit is not enough.
- **Running with a key costs money.** A batch of answers is a few cents on Sonnet. The app stops
  calling the model after `MAX_API_CALLS` requests in a session (default 500).
- **Test without a key first.** `npm test`, the demo, and `DIRECTOR_MOCK=1 node server.js` (canned
  replies through the real pipeline) cost nothing.

## Common changes

**Changing how the picture is directed.** Edit `src/prompt.js`. It is plain text: the rules the
model follows. Then run a short session with a key and look; the checks cannot judge pictures. If
the run is good, keep it as a demo so others can see it without spending:

```
curl -X POST localhost:3000/api/demo -d "{\"save\":\"my-demo-name\"}"
```

**Adding a ready-made drawing piece.** Add the function to `k` in `public/display/kit.js`, and
document it in `KIT_DOC` in `src/prompt.js`. If it is not documented there, the model will never
use it. Keep to the kit's own primitives so the piece is inked like everything else.

**Changing the look of a mood.** `src/atmosphere.js` turns the nine feelings into the numbers the
display uses. The weather and colour grade themselves are drawn in `atmosphere()` in
`public/display/stage.js`.

**Changing a reply field.** A new field in the model's reply needs three edits: the reply format
in `src/prompt.js`, the schema in `src/model.js`, and wherever `apply()` in `src/director.js`
should use it. Add a check to `tools/selfcheck.js`.

**Adding a check.** `tools/selfcheck.js` starts a private copy of the app and posts scripted
replies to it. Copy a nearby block; each `ok(condition, 'what should be true')` is one check.

## How the code is written

- Plain JavaScript modules, no build step, no framework. What is in the repository is what runs.
- Comments say why, not what.
- The drawing kit is the art style. Drawings written by the model may call only the kit, which is
  what keeps different drawings looking like one picture.
- Code written by the model runs in the display page behind a word blocklist, not a sandbox.
  Do not widen what scene code can reach.
