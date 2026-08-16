import 'server-only';

import { serverEnv } from '@/lib/env';

export { jobName, roomSlug } from '@/lib/naming';

/**
 * Identities AVFlow sinks use when they publish back into a room.
 *
 * These are excluded from the matching `livekit` source's `select` so a node
 * never consumes its own output — an agent would otherwise hear itself speak
 * and a translator would translate its own translation.
 */
export const AVFLOW_IDENTITY = {
  recorder: 'avflow-recorder',
  captions: 'avflow-captions',
  agent: 'avflow-agent',
  translator: 'avflow-translator',
  cohost: 'avflow-cohost',
  overlay: 'avflow-overlay',
} as const;

/**
 * Credential block for an `asr` node.
 *
 * AVFlow treats an omitted `provider`/`providerConfig` pair as
 * platform-managed, and rejects a job that sets only one of the two. So the
 * BYOK fields are either both present or both absent.
 */
export function asrCredentials(): { provider?: string; providerConfig?: Record<string, unknown> } {
  const byok = serverEnv.byok().asr;
  if (!byok) return {};
  return { provider: byok.provider, providerConfig: { apiKey: byok.apiKey } };
}

export function voiceAgentCredentials(): {
  provider?: string;
  providerConfig?: Record<string, unknown>;
} {
  const byok = serverEnv.byok().voiceAgent;
  if (!byok) return {};
  return { provider: byok.provider, providerConfig: { apiKey: byok.apiKey } };
}

export function s3StorageConfig(pathSuffix: string) {
  const s3 = serverEnv.s3();
  const prefix = [s3.pathPrefix, pathSuffix].filter(Boolean).join('/');
  return {
    bucket: s3.bucket,
    region: s3.region,
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
    ...(s3.endpoint ? { endpoint: s3.endpoint, forcePathStyle: true } : {}),
    ...(prefix ? { pathPrefix: prefix } : {}),
  };
}
