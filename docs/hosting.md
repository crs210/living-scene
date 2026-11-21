# Hosting

The app has not been hosted anywhere yet. This page says what a host has to provide, so whoever
sets it up (a person or a coding agent) knows what they are dealing with.

## What the app is, from a host's point of view

- **One long-running Node process** (`node server.js`, Node 20.12 or newer). Not a static site and
  not a set of stateless functions.
- **All state is in memory**: the scene, the themes, the queue. Two copies of the app would be two
  different pictures, so run exactly one instance, and expect a restart to lose the session.
- **A one-second timer** batches answers and pushes the scene.
- **Long-lived connections**: each display holds a Server-Sent Events connection (`GET /events`)
  open for as long as it is showing. Phones only make short POSTs.
- **Outbound HTTPS** to `api.anthropic.com`. One request can take 20 seconds.
- **No database.** It writes two small folders (`.cache/`, `sessions/`); losing them is harmless.
- It listens on `PORT` (default 3000) on all interfaces.

## Settings a hosted copy needs

| Setting | Why |
|---|---|
| `ANTHROPIC_API_KEY` | So it can direct itself. Store it as a secret on the host, never in the repository. |
| `HOST_KEY` | When hosted, nobody is "at localhost", so the host controls are locked. Set a long random value and open the display as `/comic?key=<HOST_KEY>`. Anyone with that link controls the session. |
| `PUBLIC_URL` | The address phones should use, shown on the display and in the QR code. |
| `MAX_API_CALLS` | The cap on model requests per session (default 500). The answer page is open to anyone with the link, and every batch costs money. |

## Hosts that fit

Anything that runs a persistent Node process with one instance and allows long-lived responses:
a small virtual machine, or a container/app platform such as Render, Railway or Fly.io. Use the
start command `node server.js`, set the settings above, and keep it to a single instance.

For an event in one room there is a simpler route: run it on the presenting laptop and let phones
reach it over the venue Wi-Fi, or through a tunnel (Cloudflare Tunnel, ngrok) with `PUBLIC_URL`
set to the tunnel's address. Requests through a tunnel count as remote, so set `HOST_KEY` too.

## ChatGPT Sites

Looked at on 2026-11-21; not attempted. From OpenAI's documentation and third-party write-ups:

- The documentation does not name the runtime. It lists "background services" as unsupported.
  A third-party comparison describes it as a Workers-style runtime with D1 (a database) and R2
  (file storage), and no Node.js.
- HTTP, HTTPS and WebSockets are supported. Server-Sent Events, request duration limits, outbound
  calls to third-party APIs and how secrets are stored are not stated.

If that is right, the app would not run there unchanged. It would need: the in-memory scene moved
into the database, the one-second timer replaced by work done when requests arrive, the event
stream replaced by WebSockets or polling, and the Node-only parts (the file system, the Anthropic
SDK's Node build) replaced. That is a port of `server.js` and `src/director.js`, not a deployment.
The display, the drawing kit and the prompt would carry over as they are.
