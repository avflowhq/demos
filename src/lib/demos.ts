/** Client-safe demo metadata. Must not import server-only modules. */

export type DemoId =
  | 'meeting-recording'
  | 'cohost'
  | 'voice-room'
  | 'live-translate'
  | 'voice-agent';

export type EnvRequirement = 'avflow' | 'livekit' | 'rtmp' | 's3' | 'openai' | 'publicBaseUrl';

export type DemoMeta = {
  id: DemoId;
  href: string;
  title: string;
  tagline: string;
  /** What a real product would use this for. */
  scenario: string;
  pipeline: { sources: string[]; nodes: string[]; sinks: string[] };
  requires: EnvRequirement[];
  docs: { label: string; href: string }[];
};

export const DOCS = 'https://avflow.dev';

export const DEMOS: DemoMeta[] = [
  {
    id: 'meeting-recording',
    href: '/meeting-recording',
    title: 'Meeting recording with AI notes',
    tagline: 'Speaker-layout recording to S3, plus a transcript you can summarise.',
    scenario:
      'A conferencing product that ships "record this call" and emails a summary with action items afterwards.',
    pipeline: {
      sources: ['livekit'],
      nodes: ['video_mixer (speaker)', 'audio_mixer', 'asr'],
      sinks: ['segment → S3 (HLS + WebVTT)'],
    },
    requires: ['avflow', 'livekit', 's3', 'openai'],
    docs: [
      { label: 'segment sink', href: `${DOCS}/sinks/segment/` },
      { label: 'asr node', href: `${DOCS}/nodes/asr/` },
      { label: 'video_mixer', href: `${DOCS}/nodes/video-mixer/` },
    ],
  },
  {
    id: 'cohost',
    href: '/cohost',
    title: 'Vertical co-host switcher',
    tagline: 'A 1080x1920 guest stream whose layout you retarget mid-broadcast.',
    scenario:
      'Live shopping and creator apps where a host brings guests on and off screen without ever dropping the stream.',
    pipeline: {
      sources: ['livekit'],
      nodes: ['video_mixer (custom, 9:16)', 'audio_mixer'],
      sinks: ['rtmp_push'],
    },
    requires: ['avflow', 'livekit', 'rtmp'],
    docs: [
      { label: 'Custom layout', href: `${DOCS}/nodes/video-mixer/` },
      { label: 'rtmp_push sink', href: `${DOCS}/sinks/rtmp-push/` },
      { label: 'Create a job (upsert)', href: `${DOCS}/api/create-job/` },
    ],
  },
  {
    id: 'voice-room',
    href: '/voice-room',
    title: 'Captioned vertical voice room',
    tagline: 'An audio-only room broadcast as 9:16 video with live on-screen captions.',
    scenario:
      'Turning a social audio room into a vertical livestream that reads well with the sound off.',
    pipeline: {
      sources: ['livekit (audio)', 'web_capture', 'video_generator'],
      nodes: ['asr', 'audio_mixer'],
      sinks: ['livekit (captions back)', 'rtmp_push'],
    },
    requires: ['avflow', 'livekit', 'rtmp', 'publicBaseUrl'],
    docs: [
      { label: 'web_capture source', href: `${DOCS}/sources/web-capture/` },
      { label: 'video_generator', href: `${DOCS}/sources/video-generator/` },
      { label: 'livekit sink', href: `${DOCS}/sinks/livekit/` },
    ],
  },
  {
    id: 'live-translate',
    href: '/live-translate',
    title: 'Live interpretation channel',
    tagline: 'A translated voice track published back into the room listeners can switch to.',
    scenario:
      'Cross-border town halls and creator streams where each viewer picks their own language.',
    pipeline: {
      sources: ['livekit (audio)'],
      nodes: ['translate'],
      sinks: ['livekit (translated track)'],
    },
    requires: ['avflow', 'livekit'],
    docs: [
      { label: 'translate node', href: `${DOCS}/nodes/translate/` },
      { label: 'Select filter', href: `${DOCS}/concepts/select/` },
    ],
  },
  {
    id: 'voice-agent',
    href: '/voice-agent',
    title: 'AI co-host in the room',
    tagline: 'A speech-to-speech agent that listens, answers, and can be interrupted.',
    scenario:
      'An always-available co-host that keeps a show moving when the audience is quiet.',
    pipeline: {
      sources: ['livekit (audio)'],
      nodes: ['voice_agent'],
      sinks: ['livekit (agent voice)'],
    },
    requires: ['avflow', 'livekit'],
    docs: [
      { label: 'voice_agent node', href: `${DOCS}/nodes/voice-agent/` },
      { label: 'Wiring & DAG', href: `${DOCS}/concepts/wiring/` },
    ],
  },
];

export function demoById(id: DemoId): DemoMeta {
  const found = DEMOS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown demo ${id}`);
  return found;
}

export const ENV_LABELS: Record<EnvRequirement, string> = {
  avflow: 'AVFLOW_API_KEY',
  livekit: 'LIVEKIT_URL / _API_KEY / _API_SECRET',
  rtmp: 'RTMP_PUSH_URL',
  s3: 'S3_BUCKET / credentials',
  openai: 'OPENAI_API_KEY',
  publicBaseUrl: 'PUBLIC_BASE_URL (tunnel)',
};
