import 'server-only';

import { serverEnv } from '@/lib/env';

export { jobName, roomSlug } from '@/lib/naming';

/**
 * Identities AVFlow joins a room under.
 *
 * The ones belonging to a sink that publishes back into the room are also
 * excluded from that job's own `livekit` source `select`, so a node never
 * consumes its own output — an agent would otherwise hear itself speak and a
 * translator would translate its own translation. `moderator` is the exception:
 * it only subscribes, so there is nothing to exclude.
 */
export const AVFLOW_IDENTITY = {
  recorder: 'avflow-recorder',
  captions: 'avflow-captions',
  agent: 'avflow-agent',
  translator: 'avflow-translator',
  cohost: 'avflow-cohost',
  overlay: 'avflow-overlay',
  moderator: 'avflow-moderator',
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
  const pathPrefix = [s3.pathPrefix, pathSuffix].filter(Boolean).join('/');
  return {
    bucket: s3.bucket,
    region: s3.region,
    accessKeyId: s3.accessKeyId,
    secretAccessKey: s3.secretAccessKey,
    ...(s3.endpoint ? { endpoint: s3.endpoint, forcePathStyle: true } : {}),
    ...(pathPrefix ? { pathPrefix } : {}),
  };
}
