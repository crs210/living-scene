# Limitations

## Speed

Measured on 2026-11-21 through the API with Sonnet 5.5, three batches of four or five answers:

| Step | Time |
|---|---|
| A repeat grows and flashes; first mood nudge | under a second (no model) |
| Opening drawn | 18 s |
| A batch read: mood, themes, numbers | 8 to 9 s |
| All of a batch's drawings arrived | 20 to 23 s |

One run is not much evidence. It has not been timed with a large audience or with other models.

## Cost

- That run (an opening and three batches, 15 requests, about 23,500 output tokens) cost roughly
  30 US cents: about 8 cents a batch on Sonnet 5.5. This is an estimate from token counts.
- Cost follows the number of batches, not the number of people.
- The app stops calling the model after `MAX_API_CALLS` requests in a session (default 500). That
  is a count of requests, not a budget in money.

## Safety

- **Drawings are code written by the model, and audience text steers what it writes.** That code
  runs in the display page behind a word blocklist, not a sandbox. This is acceptable on a host's
  own laptop. It is not good enough for an untrusted public deployment.
- A drawing that throws is switched off after four errors, and one that is too slow to draw is
  switched off too. Code that never returns would still freeze the display.
- The answer filter is a short English word list. The two-second limit per phone relies on an id
  the phone supplies, so it stops accidents, not abuse.
- Anyone who can reach the answer page can submit answers, and every batch costs money.

## Scale and state

- One question and one picture per running app.
- Everything is in memory: restarting the app loses the session in progress.
- Tested with a 150-answer burst and a handful of displays, never with a real audience.
- Phones must be able to reach the app: the same network with no client isolation, or a hosted copy.
- The display's lettering comes from Google Fonts and falls back to system fonts offline.

## The API path

- It has had one real run. Requests are not streamed, so output is capped at 16,000 tokens for an
  opening and 8,000 for a drawing.
- A refused request is reported and skipped; there is no fallback model.
- If the model returns a drawing with a syntax error, that element is switched off rather than retried.

## Picture quality

- In the API run every change was a rewrite of the six opening elements; nothing brand new was
  added. The rule that pushes combining over adding may now be too strong.
- Sonnet tends to give each answer its own theme, so repetition counts for less than it should.
- The abstraction slider has little effect on openings.
- At most 14 arrived elements, 6,000 characters of code each; the final image may rewrite three.
- The camera has only been seen pulling back, never closing in.
- **Nobody has yet checked the animation by eye in an ordinary browser**: the frame rate, the
  entrances, the pops on repeats and the camera move were verified from still screenshots and
  from the numbers, not by watching.
