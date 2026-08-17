# AVFlow demos

Six things people actually build on [AVFlow](https://avflow.dev), as one runnable
Next.js app. Every demo joins a live LiveKit room in your browser, submits a real
Job to the AVFlow API, and shows you the JSON it sent.

Nothing here is mocked. Where AVFlow cannot do something directly, the demo shows
the real workaround instead of pretending — that is the most useful part.

| Demo | What it shows | Needs |
| --- | --- | --- |
| [Meeting recording with AI notes](#1-meeting-recording-with-ai-notes) | Speaker-layout recording to S3 with a WebVTT transcript, then an LLM summary | S3, OpenAI |
| [Vertical co-host switcher](#2-vertical-co-host-switcher) | A 1080×1920 stream whose layout you retarget mid-broadcast, without dropping RTMP | RTMP |
| [Captioned vertical voice room](#3-captioned-vertical-voice-room) | An audio-only room as 9:16 video with visible live captions | RTMP, tunnel |
| [Live interpretation channel](#4-live-interpretation-channel) | A translated voice track published back into the room | — |
| [AI co-host in the room](#5-ai-co-host-in-the-room) | A speech-to-speech agent that listens, answers, and can be interrupted | — |
| [Per-participant moderation](#6-per-participant-moderation) | One image stream and one audio socket per participant, with nothing mixed | S3, OpenAI, tunnel |

---

## Quick start

You need an [AVFlow API key](https://console.avflow.dev) and a LiveKit project.
Everything else is per-demo.

```bash
git clone https://github.com/avflowhq/demos.git
cd demos
pnpm install
cp .env.example .env.local   # fill in AVFLOW_API_KEY + LIVEKIT_*
pnpm dev
```

Open <http://localhost:3000>. The homepage marks which integrations it can see,
and each demo disables its start button with an explanation when something it
needs is missing.

You do **not** need Deepgram, OpenAI Realtime, or any other vendor key for the
ASR and voice-agent demos. Omitting `provider` and `providerConfig` tells AVFlow
to use platform-managed credentials. See [Credentials](#credentials) to switch to
your own.

---

## The Job model in one paragraph

An AVFlow Job is a JSON document with `sources` (inputs), optional `nodes`
(mixing, ASR, translation, agents), and `sinks` (outputs). Nodes and sinks name
their upstream components in `inputs`, which makes the whole thing a DAG. A Job
allows at most 5 sources and 3 sinks. `POST /v1/jobs` is an **upsert keyed by
`name`** — there is no update endpoint, and re-submitting the same name
reconfigures a running pipeline instead of restarting it.

```jsonc
{
  "name": "my-job",
  "sources": [{ "name": "room", "type": "livekit", "config": { } }],
  "nodes":   [{ "name": "stage", "type": "video_mixer", "inputs": ["room"], "config": { } }],
  "sinks":   [{ "name": "out", "type": "rtmp_push", "inputs": ["stage"], "config": { } }]
}
```

Full reference: [avflow.dev/concepts/job](https://avflow.dev/concepts/job/).

---

## 1. Meeting recording with AI notes

**Code:** [`src/lib/jobs/meetingRecording.ts`](src/lib/jobs/meetingRecording.ts) ·
[`src/app/meeting-recording`](src/app/meeting-recording) ·
[`src/app/api/meeting-notes/route.ts`](src/app/api/meeting-notes/route.ts)

```
livekit(room) ─┬→ video_mixer (speaker, screen share wins) ─┐
               ├→ audio_mixer ─────────────────────────────┤→ segment (S3: HLS + WebVTT)
               └→ asr ─────────────────────────────────────┘
```

The mixer runs in `speaker` mode with `mainPriority: "screen_share"`, so a screen
share is promoted to the main region and cameras fall into the thumbnail rail.

**`segment` is the only sink that carries captions without video.** Every other
sink transports captions inside the encoded video — as SEI on RTMP/SRT, or as
data messages on RTC. HLS is the exception because it has an independent WebVTT
rendition, which is also what makes the transcript readable afterwards.

**Summarising is not an AVFlow node.** AVFlow gives you `<base>_subs.vtt` next to
the recording; `/api/meeting-notes` finds it in S3, parses it, and sends it to an
LLM. Note that HLS finalises the VTT when the job stops, so stop the job before
asking for notes.

Streaming ASR emits a cue per interim update, so the same sentence arrives several
times with a growing tail. [`src/lib/vtt.ts`](src/lib/vtt.ts) collapses those into
one line per utterance before summarising.

## 2. Vertical co-host switcher

**Code:** [`src/lib/jobs/cohost.ts`](src/lib/jobs/cohost.ts) ·
[`src/lib/cohostLayouts.ts`](src/lib/cohostLayouts.ts) ·
[`src/app/cohost`](src/app/cohost)

```
livekit(room) ─┬→ video_mixer (custom, 1080x1920) ─┐
               └→ audio_mixer ──────────────────── ┴→ rtmp_push
```

Three presets — host only, split screen, picture in picture — as `custom` layout
regions in `ratio` coordinates, so the same numbers work at any canvas size.
Regions match participants by identity, which is why the page lets you choose
whether you are the host or the guest.

**Switching layouts does not interrupt the stream.** There is no layout-only API.
Clicking a preset re-submits the entire Job under the same name, and AVFlow treats
that as an upsert: it reconfigures the running mixer in place rather than tearing
the pipeline down. The RTMP output keeps flowing.

Two limits worth knowing: the canvas caps at 1920 on the long edge and 1080 on the
short edge, so 1080×1920 is the largest vertical frame. And `zIndex` is paint
order only — there is no alpha blending, so an inset tile fully covers whatever is
beneath it.

## 3. Captioned vertical voice room

**Code:** [`src/lib/jobs/voiceRoom.ts`](src/lib/jobs/voiceRoom.ts) ·
[`src/app/overlay/captions`](src/app/overlay/captions) ·
[`src/app/voice-room`](src/app/voice-room)

```
livekit(room, audio) ─┬→ asr ────────────────→ livekit sink ──╮
                      └→ audio_mixer ──────┐                  │ captions re-enter
video_generator (16x16 carrier) ────────────┴→ livekit sink    │ the room as data
                                                              │
web_capture(overlay canvas) ─────┐                            │
                                 └→ rtmp_push ←───────────────╯
```

This is the most interesting demo because the obvious approach does not exist.

**AVFlow never burns captions into pixels.** ASR output is sidecar data only. So to
make captions *visible* in a stream, the captions have to travel back through
something that can draw them: a `livekit` sink publishes them into the room on the
`avflow.asrText` topic, `/overlay/captions` joins that room as an ordinary
participant and draws them onto a canvas, and `web_capture` records that canvas.

Three constraints shaped the details:

- **A non-`segment` sink carrying captions must also carry video.** Rather than
  waste bandwidth echoing the composed vertical frame back into the room, a 16×16
  `video_generator` rides along as the cheapest legal video carrier.
- **`captureElement` requires an element with `.captureStream()`**, which means a
  canvas or a media element — not a div. That is why the overlay is drawn rather
  than laid out in HTML. It also raises the frame-rate ceiling from 10 fps
  (full-page capture) to 60.
- **The Job omits `viewport` on purpose.** An explicit height above 1080 would be
  clamped, but with no viewport the canvas keeps its natural size, and portrait
  capture allows up to 1280×1920.

The draw loop runs unconditionally: `captureStream` only emits frames when the
canvas is painted, so a static scene would stall the stream.

Because AVFlow's browser has to load the overlay over the public internet,
`PUBLIC_BASE_URL` must be a tunnel when you run locally:

```bash
cloudflared tunnel --url http://localhost:3000
# paste the https URL it prints into PUBLIC_BASE_URL
```

Only `rtmp_push` is a mux sink here, so the job stays inside the
one-`video_encoder`-per-job limit.

## 4. Live interpretation channel

**Code:** [`src/lib/jobs/liveTranslate.ts`](src/lib/jobs/liveTranslate.ts) ·
[`src/app/live-translate`](src/app/live-translate)

```
livekit(room, audio) → translate → livekit sink (translated voice + text)
```

`translate` emits speech in the target language plus `avflow.translateText` data
events, so publishing it back into the room gives listeners a track they can switch
to. Run one job per language and they coexist.

That coexistence needs a guard: the source's `select` excludes **every** translator
identity. Without it, the English interpreter would start translating the Japanese
interpreter's output.

Unlike `asr` and `voice_agent`, `translate` is platform-managed only — sending
`provider` or `providerConfig` is rejected at submit time.

## 5. AI co-host in the room

**Code:** [`src/lib/jobs/voiceAgent.ts`](src/lib/jobs/voiceAgent.ts) ·
[`src/app/voice-agent`](src/app/voice-agent)

```
livekit(room, audio) → voice_agent → livekit sink (voice + transcript)
```

One source, one node, one sink — the smallest interesting Job in this repo. The
agent hears the room, replies in speech, and honours barge-in, so talking over it
cuts its turn short.

Two loop guards matter:

- the source excludes the agent's own identity, so it never transcribes itself;
- the sink's token is publish-only (`canSubscribe: false`), so the publishing
  participant cannot echo room audio back in.

Drop either one and the agent talks itself into an infinite conversation.

## 6. Per-participant moderation

**Code:** [`src/lib/jobs/moderation.ts`](src/lib/jobs/moderation.ts) ·
[`src/app/moderation`](src/app/moderation) ·
[`server/moderation.ts`](server/moderation.ts)

```
livekit(room) ─┬→ image ──────────────────────→ S3 (one jpeg per participant)
               └→ audio_resample → websocket ─→ your service (one socket each)
```

The only Job here that never mixes, because the question it answers is not what
the room looked like but who did it. Three constraints produce that shape.

**`image` and `websocket` are the only `n:n` sinks.** They keep one output per
upstream stream. Every other sink is `1:1` and rejects a multi-stream producer
outright, so using one would mean composing the room first and throwing away the
attribution. `segment` is 1:1 deliberately — it would otherwise run a full
encoder per participant.

**Per-participant audio cannot go through an encoder.** `audio_encoder` is `1:1`,
so `livekit → audio_encoder` is rejected at submit time, with a hint to insert a
mixer that is exactly what you are trying to avoid:

```
component "enc" (type audio_encoder, 1:1) expects single stream input but
upstream "room" (type livekit, 1:n) produces multiple streams
```

Audio therefore leaves as PCM, and `audio_resample` — the one `n:n` audio node —
is what shapes it first.

**That resample is a cost decision as much as a format one.** PCM is billed as
egress. 48 kHz stereo is ~1.5 Mbit/s per participant against ~0.26 Mbit/s at
16 kHz mono, and 16 kHz mono is already what speech models want.

Two more things worth knowing:

- **The `image` sink has no webhook.** It uploads to storage and nothing else, so
  the loop is AVFlow → bucket → bucket event → your service. This demo polls
  instead of wiring a bucket event, and the newest frame is up to `intervalSec`
  old. The audio socket is the low-latency half.
- **Neither sink carries captions.** Routing an `asr` node into `image` is
  rejected, so the transcription happens in `server/moderation.ts` on the PCM it
  receives.

Attribution comes from the object key: `prefix` is templated, so
`moderation/<job>/{identity}` gives each participant their own folder. Note it is
`prefix` and not `pathPrefix` — an unrecognised key is dropped silently and
everything lands at the bucket root.

The service AVFlow connects out to is a separate process, because a Next route
handler cannot accept a WebSocket upgrade:

```bash
pnpm moderation                                  # ws://localhost:8787
cloudflared tunnel --url http://localhost:8787   # paste wss:// into MODERATION_WS_URL
```

---

## Credentials

`asr`, `translate`, and `voice_agent` need a streaming vendor. AVFlow resolves that
in one of two ways, decided per node:

| `provider` | `providerConfig` | Result |
| --- | --- | --- |
| omitted | omitted | **Platform-managed** — AVFlow supplies the vendor key, billed with the job |
| set | set | **BYOK** — your key, your vendor account |
| set | omitted | Rejected: `specifies provider … but has no providerConfig` |
| omitted | set | Rejected: `specifies providerConfig without a provider` |

These demos default to platform-managed, which is why they run with no vendor
keys. Set `ASR_PROVIDER` + `ASR_API_KEY` or `VOICE_AGENT_PROVIDER` +
`VOICE_AGENT_API_KEY` to switch. `translate` is platform-managed only.

## What is demo code, not production code

Read this before deploying anything here.

- **`/api/token` is unauthenticated.** Anyone who can reach it can mint a token for
  any room. Put it behind your own auth.
- **`/overlay/captions` is unauthenticated** so AVFlow's headless browser can load
  it. In production, sign the URL or restrict it by header — `web_capture`
  supports `setExtraHTTPHeaders`, `cookies`, and `authenticate`.
- **Storage credentials are sent inside the Job.** The `segment` and `image` sinks
  receive your S3 keys; scope them to one bucket and prefix.
- **The moderation server's auth is a shared bearer token**, and it is optional. It
  also holds audio and findings in memory, per process. A real one authenticates
  properly and publishes findings to a queue.
- **Job names are derived from the room name**, so two people using the same room
  name upsert each other's job. Namespace them per tenant for real use.
- Submitted Job JSON shown in the UI is redacted server-side
  ([`src/lib/avflow/redact.ts`](src/lib/avflow/redact.ts)), but the unredacted
  document still reaches AVFlow — that is the point.

## Layout

```
server/
└── moderation.ts            the WebSocket service AVFlow connects out to
src/
├── app/
│   ├── api/
│   │   ├── jobs/            submit (upsert), status, stop
│   │   ├── meeting-notes/   read the WebVTT from S3, summarise it
│   │   ├── moderation/      findings from the server, frames from the bucket
│   │   └── token/           LiveKit tokens for browser participants
│   ├── overlay/captions/    the 1080x1920 canvas web_capture records
│   └── <demo>/              one directory per demo
├── components/              room panel, job console, caption feeds
└── lib/
    ├── avflow/              Job typings, REST client, secret redaction
    ├── jobs/                one Job builder per demo — start reading here
    ├── captions.ts          decoding avflow.* data messages
    └── vtt.ts               WebVTT parsing and interim-cue collapsing
```

If you only read one directory, read [`src/lib/jobs`](src/lib/jobs). Each file is a
single function that returns a Job, with the reasoning for its shape in comments.

## Commands

```bash
pnpm dev         # dev server
pnpm moderation  # the moderation WebSocket service (moderation demo only)
pnpm build       # production build
pnpm lint        # eslint
pnpm typecheck   # tsc --noEmit
```

## Links

- [AVFlow docs](https://avflow.dev/introduction/) · [Use cases](https://avflow.dev/use-cases/) · [Console](https://console.avflow.dev)
- [Job structure](https://avflow.dev/concepts/job/) · [Wiring & DAG](https://avflow.dev/concepts/wiring/) · [Select filter](https://avflow.dev/concepts/select/)
- Questions or a broken demo: [open an issue](https://github.com/avflowhq/demos/issues)

MIT licensed.
