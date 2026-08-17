import 'server-only';

import type { Job } from '@/lib/avflow/types';
import type { DemoId } from '@/lib/demos';
import { requiredString } from '@/lib/http';

import { COHOST_LAYOUTS, type CohostLayoutId } from '@/lib/cohostLayouts';
import { TRANSLATE_LANGUAGES } from '@/lib/languages';

import { buildCohostJob } from './cohost';
import { buildLiveTranslateJob } from './liveTranslate';
import { buildMeetingRecordingJob } from './meetingRecording';
import { buildModerationJob } from './moderation';
import { buildVoiceAgentJob } from './voiceAgent';
import { buildVoiceRoomJob } from './voiceRoom';

const DEMO_IDS = new Set<DemoId>([
  'meeting-recording',
  'cohost',
  'voice-room',
  'live-translate',
  'voice-agent',
  'moderation',
]);

export function parseDemoId(value: unknown): DemoId {
  const id = requiredString(value, 'demo') as DemoId;
  if (!DEMO_IDS.has(id)) throw new Error(`Unknown demo \`${id}\``);
  return id;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function buildDemoJob(demo: DemoId, params: Record<string, unknown>): Promise<Job> {
  const room = requiredString(params.room, 'room');

  switch (demo) {
    case 'meeting-recording':
      return buildMeetingRecordingJob({ room, language: optionalString(params.language) });

    case 'cohost': {
      const layout = requiredString(params.layout, 'layout') as CohostLayoutId;
      if (!(COHOST_LAYOUTS as readonly string[]).includes(layout)) {
        throw new Error(`\`layout\` must be one of ${COHOST_LAYOUTS.join(', ')}`);
      }
      return buildCohostJob({
        room,
        layout,
        hostIdentity: optionalString(params.hostIdentity) ?? 'host',
        guestIdentity: optionalString(params.guestIdentity) ?? 'guest',
      });
    }

    case 'voice-room':
      return buildVoiceRoomJob({ room, language: optionalString(params.language) });

    case 'live-translate': {
      const targetLanguage = requiredString(params.targetLanguage, 'targetLanguage');
      if (!TRANSLATE_LANGUAGES.some((l) => l.code === targetLanguage)) {
        throw new Error(`\`targetLanguage\` must be one of ${TRANSLATE_LANGUAGES.map((l) => l.code).join(', ')}`);
      }
      return buildLiveTranslateJob({ room, targetLanguage });
    }

    case 'moderation': {
      const intervalSec = Number(params.intervalSec);
      return buildModerationJob({
        room,
        intervalSec: Number.isFinite(intervalSec) && intervalSec > 0 ? intervalSec : undefined,
        audioUrl: requiredString(params.audioUrl, 'audioUrl'),
        audioToken: optionalString(params.audioToken),
      });
    }

    case 'voice-agent':
      return buildVoiceAgentJob({
        room,
        language: optionalString(params.language),
        instructions: optionalString(params.instructions),
        greeting: optionalString(params.greeting),
        voice: optionalString(params.voice),
      });
  }
}
