import 'server-only';

import { serverEnv } from '@/lib/env';
import { createPublishToken, createSubscribeToken } from '@/lib/livekit';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, asrCredentials, jobName } from './shared';

/** The overlay canvas AVFlow captures. Portrait fits under the 1280x1920 element-capture cap. */
export const OVERLAY_CANVAS = { width: 1080, height: 1920 } as const;
export const OVERLAY_SELECTOR = 'canvas#stage';

/**
 * Captioned vertical stream from an audio-only room.
 *
 *   livekit(room, audio) ─┬→ asr ──────────────→ livekit sink ──╮
 *                         └→ audio_mixer ───────────┐           │ captions re-enter
 *   video_generator (carrier) ────────→ livekit sink┘           │ the room as data
 *   web_capture(overlay canvas) ──────────────┐                 │
 *                                             └→ rtmp_push ←────╯ (overlay renders them)
 *
 * Two things force this shape:
 *
 * 1. AVFlow never burns captions into pixels. `asr` output travels as sidecar
 *    data — a WebVTT rendition on HLS, `avflow.asrText` data messages on RTC
 *    sinks, or SEI on RTMP. To make captions *visible*, the `livekit` sink
 *    publishes them back into the room and the overlay page (a browser client
 *    in that room) draws them onto its canvas, which `web_capture` records.
 *
 * 2. A non-`segment` sink carrying captions must also carry video, so the
 *    caption sink gets a tiny `video_generator` as its video carrier rather
 *    than wasting bandwidth echoing the composed vertical frame.
 *
 * Only `rtmp_push` is a mux sink here, so the job stays within the
 * one-video_encoder-per-job limit.
 */
export async function buildVoiceRoomJob(opts: {
  room: string;
  language?: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();
  const name = jobName('voiceroom', opts.room);

  const subscribeToken = await createSubscribeToken(opts.room, AVFLOW_IDENTITY.overlay);
  const publishToken = await createPublishToken(opts.room, AVFLOW_IDENTITY.captions);

  const overlayUrl = new URL('/overlay/captions', serverEnv.publicBaseUrl());
  overlayUrl.searchParams.set('room', opts.room);

  return {
    name,
    metadata: { demo: 'voice-room', room: opts.room },
    sources: [
      {
        name: 'room',
        type: 'livekit',
        config: {
          serverUrl: url,
          token: subscribeToken,
          // Audio only, and never the caption publisher's own carrier track.
          select: {
            mediaTypes: ['audio'],
            excludeIdentities: [AVFLOW_IDENTITY.captions],
          },
        },
      },
      {
        name: 'overlay',
        type: 'web_capture',
        config: {
          url: overlayUrl.toString(),
          // No `viewport`: an explicit height above 1080 would be clamped,
          // while omitting it keeps the canvas's natural 1080x1920.
          captureElement: OVERLAY_SELECTOR,
          fps: 30,
          captureAudio: false,
          waitForSelector: { selector: `${OVERLAY_SELECTOR}[data-ready="true"]`, timeout: 20_000 },
        },
      },
      {
        name: 'carrier',
        type: 'video_generator',
        config: { width: 16, height: 16, fps: 5, backgroundColor: '#000000' },
      },
    ],
    nodes: [
      {
        name: 'captions',
        type: 'asr',
        inputs: ['room'],
        config: { language: opts.language ?? 'multi', ...asrCredentials() },
      },
      { name: 'floor', type: 'audio_mixer', inputs: ['room'], config: {} },
    ],
    sinks: [
      {
        name: 'to_room',
        type: 'livekit',
        inputs: ['carrier', { name: 'captions', select: { mediaTypes: ['data'] } }],
        config: {
          serverUrl: url,
          token: publishToken,
          videoTrackName: 'avflow-caption-carrier',
        },
      },
      {
        name: 'live',
        type: 'rtmp_push',
        inputs: [{ name: 'overlay', select: { mediaTypes: ['video'] } }, 'floor'],
        config: {
          urls: [serverEnv.rtmpUrl()],
          encoding: {
            videoCodec: 'h264',
            audioCodec: 'aac',
            videoBitrateBps: 3_500_000,
            audioBitrateBps: 128_000,
            keyframeIntervalSec: 2,
          },
        },
      },
    ],
    policies: { maxDurationSec: 4 * 60 * 60, idleTimeoutSec: 120 },
  };
}
