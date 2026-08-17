/**
 * The moderation service AVFlow's `websocket` sink connects out to.
 *
 * This is a separate process, not a Next route handler, because a route handler
 * cannot accept a WebSocket upgrade. Run it with `pnpm moderation` and point
 * MODERATION_WS_URL at it — through a tunnel when AVFlow runs in the cloud and
 * this runs on your laptop.
 *
 * The sink opens ONE CONNECTION PER PARTICIPANT and describes that participant
 * in the opening handshake headers rather than in the messages, so identity is
 * read once at `connection` and every binary message afterwards is nothing but
 * audio. Each message is one chunk of interleaved signed 16-bit little-endian
 * PCM at the rate the `audio_resample` node was configured with.
 *
 * Demo code. A real service would authenticate properly, put findings in a
 * queue, and not hold audio in memory.
 */
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

const PORT = Number(process.env.MODERATION_PORT ?? 8787);
const TOKEN = process.env.MODERATION_TOKEN?.trim();
const APP_URL = (process.env.MODERATION_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OPENAI_KEY = process.env.OPENAI_API_KEY?.trim();
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe';
const REVIEW_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';

/** Seconds of speech to gather before asking for a verdict. */
const WINDOW_SEC = 6;

type Speaker = {
  identity: string;
  sampleRate: number;
  channels: number;
  format: string;
  /** PCM for the window currently being gathered. */
  pending: Buffer[];
  pendingBytes: number;
  totalBytes: number;
};

function header(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() || undefined;
}

/** RMS of an s16le buffer, 0..1. Enough to tell speech from an idle mic. */
function level(pcm: Buffer): number {
  const samples = Math.floor(pcm.length / 2);
  if (samples === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i += 1) {
    const s = pcm.readInt16LE(i * 2) / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / samples);
}

/** Wrap raw PCM in a WAV container, which is what the transcription API accepts. */
function toWav(pcm: Buffer, sampleRate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function transcribe(wav: Buffer): Promise<string> {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'window.wav');
  form.set('model', TRANSCRIBE_MODEL);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { text?: string };
  return body.text?.trim() ?? '';
}

type Verdict = { verdict: 'ok' | 'review' | 'violation'; reason: string };

async function review(text: string): Promise<Verdict> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: REVIEW_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You moderate short transcript excerpts from a live audio room. Reply as JSON ' +
            '{"verdict":"ok"|"review"|"violation","reason":"one short sentence"}. Use "ok" ' +
            'for ordinary conversation, "review" when something is borderline or ambiguous, ' +
            '"violation" only for clear abuse, threats, or sexual content involving minors.',
        },
        { role: 'user', content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`review failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(raw) as Partial<Verdict>;
  return {
    verdict: parsed.verdict === 'violation' || parsed.verdict === 'review' ? parsed.verdict : 'ok',
    reason: parsed.reason ?? '',
  };
}

/**
 * Hand the finding to the Next app, which holds it in memory for the demo UI.
 * A real service would publish to a queue instead.
 */
async function publish(finding: unknown): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/moderation/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finding),
    });
  } catch (err) {
    console.error('[moderation] could not reach the app:', (err as Error).message);
  }
}

async function closeWindow(speaker: Speaker): Promise<void> {
  const pcm = Buffer.concat(speaker.pending);
  speaker.pending = [];
  speaker.pendingBytes = 0;

  const rms = level(pcm);
  // Skip silence rather than paying to transcribe it.
  if (rms < 0.01) return;

  const base = {
    identity: speaker.identity,
    at: new Date().toISOString(),
    seconds: pcm.length / (speaker.sampleRate * speaker.channels * 2),
    level: Number(rms.toFixed(3)),
  };

  if (!OPENAI_KEY) {
    await publish({ ...base, verdict: 'ok', reason: 'audio received; set OPENAI_API_KEY to review it' });
    return;
  }

  try {
    const text = await transcribe(toWav(pcm, speaker.sampleRate, speaker.channels));
    if (!text) return;
    const { verdict, reason } = await review(text);
    await publish({ ...base, text, verdict, reason });
  } catch (err) {
    console.error(`[moderation] ${speaker.identity}:`, (err as Error).message);
  }
}

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('avflow moderation demo\n');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (TOKEN && header(req.headers.authorization) !== `Bearer ${TOKEN}`) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws: WebSocket, req) => {
  const speaker: Speaker = {
    identity: header(req.headers['x-avflow-identity']) ?? 'unknown',
    sampleRate: Number(header(req.headers['x-avflow-audio-sample-rate']) ?? 16000),
    channels: Number(header(req.headers['x-avflow-audio-channels']) ?? 1),
    format: header(req.headers['x-avflow-audio-format']) ?? 'pcm_s16le',
    pending: [],
    pendingBytes: 0,
    totalBytes: 0,
  };

  // Anything other than raw PCM would mean the Job put an `audio_encoder` in
  // front of the sink, which this demo does not decode.
  if (speaker.format !== 'pcm_s16le') {
    console.error(`[moderation] ${speaker.identity}: unexpected format ${speaker.format}`);
    ws.close(1003, 'expected pcm_s16le');
    return;
  }

  const windowBytes = WINDOW_SEC * speaker.sampleRate * speaker.channels * 2;
  console.log(
    `[moderation] ${speaker.identity} connected (${speaker.sampleRate} Hz, ${speaker.channels}ch)`,
  );

  ws.on('message', (data: Buffer, isBinary: boolean) => {
    if (!isBinary) return;
    speaker.pending.push(data);
    speaker.pendingBytes += data.length;
    speaker.totalBytes += data.length;
    if (speaker.pendingBytes >= windowBytes) void closeWindow(speaker);
  });

  ws.on('close', () => {
    const mb = (speaker.totalBytes / 1_000_000).toFixed(1);
    console.log(`[moderation] ${speaker.identity} disconnected after ${mb} MB`);
    if (speaker.pendingBytes > 0) void closeWindow(speaker);
  });

  ws.on('error', (err) => console.error(`[moderation] ${speaker.identity}:`, err.message));
});

server.listen(PORT, () => {
  console.log(`[moderation] listening on ws://localhost:${PORT}`);
  if (!OPENAI_KEY) console.log('[moderation] no OPENAI_API_KEY — reporting arrivals without review');
  if (!TOKEN) console.log('[moderation] no MODERATION_TOKEN — accepting any connection');
});
