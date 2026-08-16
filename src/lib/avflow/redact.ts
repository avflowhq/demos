import type { Job } from './types';

const SECRET_KEYS = new Set([
  'token',
  'apiKey',
  'accessKeyId',
  'secretAccessKey',
  'credentialsJson',
  'providerConfig',
]);

/**
 * The demo pages render the submitted Job JSON so you can read the topology,
 * but the same document carries LiveKit JWTs, storage keys, and stream keys.
 * Everything sensitive is replaced with a placeholder before it leaves the
 * server.
 */
export function redactJob(job: Job): Job {
  return redact(job) as Job;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(key)) {
      out[key] = '<redacted>';
    } else if (key === 'urls' && Array.isArray(val)) {
      out[key] = val.map((u) => (typeof u === 'string' ? redactStreamKey(u) : u));
    } else {
      out[key] = redact(val);
    }
  }
  return out;
}

/** Keep the ingest host visible, hide the stream key that follows it. */
function redactStreamKey(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 1) segments[segments.length - 1] = '<stream-key>';
    return `${parsed.protocol}//${parsed.host}/${segments.join('/')}`;
  } catch {
    return '<redacted>';
  }
}
