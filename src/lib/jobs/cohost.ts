import 'server-only';

import { serverEnv } from '@/lib/env';
import { createSubscribeToken } from '@/lib/livekit';
import { cohostLayout, type CohostLayoutId } from '@/lib/cohostLayouts';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, jobName } from './shared';

const CANVAS = { width: 1080, height: 1920 } as const;

/**
 * Vertical co-host stream with a switchable layout.
 *
 *   livekit(room) ─┬→ video_mixer (custom, 1080x1920) ─┐
 *                  └→ audio_mixer ──────────────────── ┴→ rtmp_push
 *
 * Re-submitting this job under the same `name` with a different layout is an
 * upsert: AVFlow reconfigures the running mixer in place instead of restarting
 * the pipeline, so the RTMP output never drops.
 */
export async function buildCohostJob(opts: {
  room: string;
  layout: CohostLayoutId;
  hostIdentity: string;
  guestIdentity: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();
  const token = await createSubscribeToken(opts.room, AVFLOW_IDENTITY.cohost);

  return {
    name: jobName('cohost', opts.room),
    metadata: { demo: 'cohost', room: opts.room, layout: opts.layout },
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
        name: 'stage',
        type: 'video_mixer',
        inputs: ['room'],
        config: {
          canvas: {
            ...CANVAS,
            fps: 30,
            backgroundColor: '#05070f',
            coordinateSystem: 'ratio',
          },
          layout: cohostLayout(opts.layout, opts.hostIdentity, opts.guestIdentity),
        },
      },
      { name: 'mix', type: 'audio_mixer', inputs: ['room'], config: {} },
    ],
    sinks: [
      {
        name: 'live',
        type: 'rtmp_push',
        inputs: ['stage', 'mix'],
        config: {
          urls: [serverEnv.rtmpUrl()],
          encoding: {
            videoCodec: 'h264',
            audioCodec: 'aac',
            videoBitrateBps: 4_000_000,
            audioBitrateBps: 128_000,
            keyframeIntervalSec: 2,
          },
        },
      },
    ],
    policies: { maxDurationSec: 4 * 60 * 60, idleTimeoutSec: 120 },
  };
}
