import 'server-only';

import { serverEnv } from '@/lib/env';
import { createPublishToken, createSubscribeToken } from '@/lib/livekit';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, jobName, voiceAgentCredentials } from './shared';

export const DEFAULT_AGENT_INSTRUCTIONS = [
  'You are a co-host on a live audio show.',
  'Keep replies to one or two sentences so the conversation stays quick.',
  'When the hosts talk to each other, stay quiet unless asked something.',
].join(' ');

/**
 * An AI participant that hears the room and talks back.
 *
 *   livekit(room, audio) → voice_agent → livekit sink (voice + transcript)
 *
 * Two loop guards matter here:
 *
 *   - the source excludes the agent's own identity, so the agent never
 *     transcribes its own speech;
 *   - the sink's token is publish-only (`canSubscribe: false`), so the
 *     publishing participant cannot echo room audio back.
 *
 * Omitting `provider`/`providerConfig` uses platform-managed credentials.
 */
export async function buildVoiceAgentJob(opts: {
  room: string;
  language?: string;
  instructions?: string;
  greeting?: string;
  voice?: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();

  const subscribeToken = await createSubscribeToken(opts.room, `${AVFLOW_IDENTITY.agent}-in`);
  const publishToken = await createPublishToken(opts.room, AVFLOW_IDENTITY.agent);

  return {
    name: jobName('agent', opts.room),
    metadata: { demo: 'voice-agent', room: opts.room },
    sources: [
      {
        name: 'room',
        type: 'livekit',
        config: {
          serverUrl: url,
          token: subscribeToken,
          select: {
            mediaTypes: ['audio'],
            excludeIdentities: [AVFLOW_IDENTITY.agent],
          },
        },
      },
    ],
    nodes: [
      {
        name: 'agent',
        type: 'voice_agent',
        inputs: ['room'],
        config: {
          language: opts.language ?? 'en',
          instructions: opts.instructions?.trim() || DEFAULT_AGENT_INSTRUCTIONS,
          greeting: opts.greeting?.trim() || 'Hey everyone, I just joined. What are we talking about?',
          ...(opts.voice ? { voice: opts.voice } : {}),
          interrupt: true,
          ...voiceAgentCredentials(),
        },
      },
    ],
    sinks: [
      {
        name: 'to_room',
        type: 'livekit',
        inputs: ['agent'],
        config: {
          serverUrl: url,
          token: publishToken,
          audioTrackName: 'agent-voice',
        },
      },
    ],
    policies: { maxDurationSec: 2 * 60 * 60, idleTimeoutSec: 120 },
  };
}
