import 'server-only';

import { serverEnv } from '@/lib/env';
import { createSubscribeToken } from '@/lib/livekit';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, asrCredentials, jobName, s3StorageConfig } from './shared';

/**
 * Meeting recording with a transcript.
 *
 *   livekit(room) ─┬→ video_mixer (speaker, screen share wins) ─┐
 *                  ├→ audio_mixer ─────────────────────────────┤→ segment (S3, HLS + WebVTT)
 *                  └→ asr ─────────────────────────────────────┘
 *
 * The `segment` sink is the only sink that carries captions as an independent
 * WebVTT rendition, which is what makes the transcript readable after the fact.
 * Summarising that transcript is not an AVFlow node — the app does it in
 * `/api/meeting-notes` once the recording has stopped.
 */
export async function buildMeetingRecordingJob(opts: {
  room: string;
  /** BCP-47 hint, or "multi" to let the provider detect. */
  language?: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();
  const token = await createSubscribeToken(opts.room, AVFLOW_IDENTITY.recorder);

  return {
    name: jobName('meeting', opts.room),
    metadata: { demo: 'meeting-recording', room: opts.room },
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
          canvas: { width: 1280, height: 720, fps: 25, backgroundColor: '#0b1120' },
          layout: {
            mode: 'speaker',
            common: { borderRadius: 12 },
            speaker: {
              mainPriority: ['screen_share', 'active_speaker'],
              mainRatio: 0.76,
              maxThumbnails: 4,
              thumbnailPosition: 'right',
            },
          },
        },
      },
      { name: 'floor', type: 'audio_mixer', inputs: ['room'], config: {} },
      {
        name: 'transcript',
        type: 'asr',
        inputs: ['room'],
        config: { language: opts.language ?? 'multi', ...asrCredentials() },
      },
    ],
    sinks: [
      {
        name: 'recording',
        type: 'segment',
        inputs: ['stage', 'floor', 'transcript'],
        config: {
          storageType: 's3',
          storageConfig: s3StorageConfig(`meetings/${jobName('meeting', opts.room)}`),
          format: 'hls',
          segmentDurationSec: 4,
          caption: { showSpeaker: true },
          encoding: { videoCodec: 'h264', audioCodec: 'aac', keyframeIntervalSec: 2 },
        },
      },
    ],
    policies: { maxDurationSec: 4 * 60 * 60, idleTimeoutSec: 180 },
  };
}
