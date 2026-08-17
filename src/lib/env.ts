import 'server-only';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export const serverEnv = {
  avflow() {
    return {
      apiUrl: (optional('AVFLOW_API_URL') ?? 'https://api.avflow.dev').replace(/\/$/, ''),
      apiKey: required('AVFLOW_API_KEY'),
    };
  },

  livekit() {
    return {
      url: required('LIVEKIT_URL'),
      apiKey: required('LIVEKIT_API_KEY'),
      apiSecret: required('LIVEKIT_API_SECRET'),
    };
  },

  /** Public origin AVFlow's headless browser uses to reach our overlay pages. */
  publicBaseUrl() {
    return required('PUBLIC_BASE_URL').replace(/\/$/, '');
  },

  rtmpUrl() {
    return required('RTMP_PUSH_URL');
  },

  s3() {
    return {
      bucket: required('S3_BUCKET'),
      region: optional('S3_REGION') ?? 'us-east-1',
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      endpoint: optional('S3_ENDPOINT'),
      pathPrefix: optional('S3_PATH_PREFIX'),
    };
  },

  openaiKey() {
    return required('OPENAI_API_KEY');
  },

  /**
   * Where AVFlow opens one WebSocket per participant. This is the moderation
   * server in `server/moderation.ts`, which runs as its own process — a Next
   * route handler cannot accept a WebSocket upgrade — so running locally means
   * pointing this at a tunnel.
   */
  moderation() {
    return {
      wsUrl: required('MODERATION_WS_URL'),
      token: optional('MODERATION_TOKEN'),
    };
  },

  /**
   * Optional bring-your-own-key overrides. When unset the demos omit
   * `provider`/`providerConfig` entirely so AVFlow uses platform-managed
   * credentials — supplying only one of the two is rejected at submit time.
   */
  byok() {
    const asrProvider = optional('ASR_PROVIDER');
    const asrKey = optional('ASR_API_KEY');
    const agentProvider = optional('VOICE_AGENT_PROVIDER');
    const agentKey = optional('VOICE_AGENT_API_KEY');
    return {
      asr: asrProvider && asrKey ? { provider: asrProvider, apiKey: asrKey } : undefined,
      voiceAgent:
        agentProvider && agentKey ? { provider: agentProvider, apiKey: agentKey } : undefined,
    };
  },
};

/** Which optional integrations are configured, for rendering setup hints. */
export function envReadiness() {
  const has = (name: string) => Boolean(process.env[name]?.trim());
  return {
    avflow: has('AVFLOW_API_KEY'),
    livekit: has('LIVEKIT_URL') && has('LIVEKIT_API_KEY') && has('LIVEKIT_API_SECRET'),
    rtmp: has('RTMP_PUSH_URL'),
    s3: has('S3_BUCKET') && has('S3_ACCESS_KEY_ID') && has('S3_SECRET_ACCESS_KEY'),
    openai: has('OPENAI_API_KEY'),
    publicBaseUrl: has('PUBLIC_BASE_URL'),
    moderationUrl: has('MODERATION_WS_URL'),
  };
}
