# Living Scene

A live audience answers an open question on their phones. One comic-book picture on the projector
changes as they answer, and settles into a single image of how the room replied.

There is no image or video model. Claude writes the picture as small drawing programs against a
fixed comic-style drawing kit, and the browser animates between states.

## Quick start

You need Node 20.12 or newer.

```
git clone https://github.com/crs210/living-scene.git
cd living-scene
npm install
node server.js
```

Open **http://localhost:3000/comic** and press **0**. A recorded session replays in about half a
minute. This needs no API key and costs nothing, so start here.

To have it respond to real answers:

1. Copy `.env.example` to `.env` and put your own Anthropic API key in it. Git ignores `.env`.
2. Restart `node server.js`.
3. Open the display, then open the address shown on it (or scan the QR code) on a phone on the
   same network, and send an answer.

**Never commit `.env` or paste a key into code, an issue or a chat.** Each batch of answers costs
a few cents; see [docs/limitations.md](docs/limitations.md).

## The two pages

| Page | Address | For |
|---|---|---|
| Display | `/comic` | The projector and the host |
| Answer page | `/` | The audience's phones |

Display keys: `0` demo, `S` controls, `D` director panel, `C` scene code, `P` save picture,
`F` feed, `H` hide everything but the picture, `R` reset, `1`-`4` send an example answer.

## Where things are

| Path | What it holds | Change it when |
|---|---|---|
| `src/prompt.js` | Everything the model is told: the kit's documentation, the rules, the reply format | You want the picture directed differently |
| `src/director.js` | State and flow: themes, weights, phases, staggered reveal, the queue, recording | You are changing how a session runs |
| `src/model.js` | The only code that calls the Claude API, plus canned replies for testing | You are changing models or request settings |
| `src/atmosphere.js` | Feelings in, weather and colour out | You want a mood to look different |
| `src/layout.js` | Works out what is piled on what and where there is room | Placement needs tuning |
| `src/instant.js` | What the app does with no model the second an answer lands | Repeats or first mood guesses need tuning |
| `src/filter.js` | The word and contact-detail filter on answers | An answer is wrongly blocked or allowed |
| `public/display/kit.js` | The drawing kit: the only thing drawings may call | You are adding a ready-made piece or changing the art style |
| `public/display/stage.js` | Draws every frame: easing, camera, entrances, weather | You are changing animation |
| `public/display/panels.js`, `host.js` | The side panels; the feed, controls and keys | You are changing the host's screen |
| `public/index.html` | The answer page | You are changing what the audience sees |
| `server.js` | Web server: answers in, the scene out, host controls | You are adding an endpoint |
| `tools/` | `selfcheck.js` (the tests), scripted audiences, the manual director tools | |
| `demos/` | Recorded sessions that replay without a model | |

More detail:

- [docs/how-it-works.md](docs/how-it-works.md): the ideas, the flow, the reply format, settings
- [docs/limitations.md](docs/limitations.md): speed, cost, safety, scale, picture quality
- [docs/hosting.md](docs/hosting.md): what a host must provide, and the host key
- [CONTRIBUTING.md](CONTRIBUTING.md): how to work on it

## Checking your changes

```
npm test
```

54 checks of the whole pipeline in under a minute, with scripted replies: no key, no cost. Run
them before every push; GitHub runs them too. They cannot tell you whether a picture is any good; for that,
play the demo, or run with a key and look.
