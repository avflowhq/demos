import 'server-only';

import { serverEnv } from '@/lib/env';
import { createPublishToken, createSubscribeToken } from '@/lib/livekit';
import { TRANSLATE_LANGUAGES } from '@/lib/languages';
import type { Job } from '@/lib/avflow/types';

import { AVFLOW_IDENTITY, jobName } from './shared';

/**
 * Simultaneous interpretation as an extra audio track in the same room.
 *
 *   livekit(room, audio) → translate → livekit sink (translated voice + text)
 *
 * `translate` emits speech in the target language plus `avflow.translateText`
 * data events, so publishing it back into the room gives listeners a channel
 * they can switch to. The source excludes the translator's own identity —
 * otherwise it would translate its own output in a loop.
 *
 * Unlike `asr` and `voice_agent`, `translate` is platform-managed only: sending
 * `provider` or `providerConfig` is rejected at submit time.
 */
export async function buildLiveTranslateJob(opts: {
  room: string;
  targetLanguage: string;
}): Promise<Job> {
  const { url } = serverEnv.livekit();
  const identity = `${AVFLOW_IDENTITY.translator}-${opts.targetLanguage}`;

  const subscribeToken = await createSubscribeToken(opts.room, `${identity}-in`);
  const publishToken = await createPublishToken(opts.room, identity);

  return {
    name: jobName(`translate-${opts.targetLanguage}`, opts.room),
    metadata: { demo: 'live-translate', room: opts.room, targetLanguage: opts.targetLanguage },
    sources: [
      {
        name: 'room',
        type: 'livekit',
        config: {
          serverUrl: url,
          token: subscribeToken,
          select: {
            mediaTypes: ['audio'],
            // Excluding every translator identity keeps parallel language jobs
            // from feeding each other.
            excludeIdentities: TRANSLATE_LANGUAGES.map(
              (l) => `${AVFLOW_IDENTITY.translator}-${l.code}`,
            ),
          },
        },
      },
    ],
    nodes: [
      {
        name: 'interpreter',
        type: 'translate',
        inputs: ['room'],
        config: { targetLanguage: opts.targetLanguage },
      },
    ],
    sinks: [
      {
        name: 'to_room',
        type: 'livekit',
        inputs: ['interpreter'],
        config: {
          serverUrl: url,
          token: publishToken,
          audioTrackName: `translation-${opts.targetLanguage}`,
        },
      },
    ],
    policies: { maxDurationSec: 4 * 60 * 60, idleTimeoutSec: 120 },
  };
}
