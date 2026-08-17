import 'server-only';

import { serverEnv } from '@/lib/env';
import { createSubscribeToken } from '@/lib/livekit';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, jobName, s3StorageConfig } from './shared';

/** What the resample node hands the socket. 16 kHz mono is what speech models want. */
export const REVIEW_AUDIO = { sampleRate: 16_000, channels: 1 } as const;

/**
 * Per-participant moderation.
 *
 *   livekit(room) ─┬→ image ──────────────────────→ S3 (one jpeg per participant)
 *                  └→ audio_resample → websocket ─→ your service (one socket each)
 *
 * This is the only demo here that never mixes, and the reason is the question it
 * answers: not "what did the room look like" but "who did this". Three
 * constraints shape it.
 *
 * 1. `image` and `websocket` are the only `n:n` sinks — they keep one output per
 *    upstream stream. Every other sink is `1:1` and rejects a multi-stream
 *    producer, so using one would mean composing the room first and throwing
 *    away the attribution. (`segment` is 1:1 deliberately: it would otherwise run
 *    a full encoder per participant.)
 *
 * 2. An `audio_encoder` is `1:1`, so `livekit → audio_encoder` is rejected at
 *    submit time with a hint to insert a mixer — exactly what we are avoiding.
 *    Per-participant audio therefore leaves as PCM, and `audio_resample` is the
 *    one `n:n` audio node available to shape it first.
 *
 * 3. That resample is a cost decision as much as a format one. PCM is billed as
 *    egress: 48 kHz stereo is ~1.5 Mbit/s per participant against ~0.26 Mbit/s
 *    at 16 kHz mono.
 *
 * Neither sink carries captions, so transcription happens on the PCM we receive
 * rather than in an `asr` node.
 */
export async function buildModerationJob(opts: {
  room: string;
  /** Seconds between snapshots. The engine caps this at 3600. */
  intervalSec?: number;
  /** Where AVFlow opens one WebSocket per participant. Must be reachable from the internet. */
  audioUrl: string;
  audioToken?: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();
  const name = jobName('moderation', opts.room);
  const token = await createSubscribeToken(opts.room, AVFLOW_IDENTITY.moderator);

  return {
    name,
    metadata: { demo: 'moderation', room: opts.room },
    sources: [
      {
        name: 'room',
        type: 'livekit',
        config: {
          serverUrl: url,
          token,
          select: { mediaTypes: ['audio', 'video'] },
        },
      },
    ],
    nodes: [
      {
        name: 'for_review',
        type: 'audio_resample',
        inputs: [{ name: 'room', select: { mediaTypes: ['audio'] } }],
        config: { ...REVIEW_AUDIO },
      },
    ],
    sinks: [
      {
        name: 'frames',
        type: 'image',
        // The select matters: the source carries video and audio, and an image
        // sink that is offered audio is rejected.
        inputs: [{ name: 'room', select: { mediaTypes: ['video'] } }],
        config: {
          storageType: 's3',
          // `{identity}` is expanded per frame, so each participant gets their own
          // folder and attribution does not depend on parsing a filename.
          storageConfig: s3StorageConfig(`moderation/${name}/{identity}`),
          format: 'jpeg',
          intervalSec: opts.intervalSec ?? 10,
          quality: 80,
          width: 640,
          height: 360,
        },
      },
      {
        name: 'audio_review',
        type: 'websocket',
        inputs: ['for_review'],
        config: {
          url: opts.audioUrl,
          ...(opts.audioToken
            ? { headers: { Authorization: `Bearer ${opts.audioToken}` } }
            : {}),
        },
      },
    ],
    policies: { maxDurationSec: 4 * 60 * 60, idleTimeoutSec: 300 },
  };
}
