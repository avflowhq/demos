import 'server-only';

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { serverEnv } from '@/lib/env';

function client() {
  const s3 = serverEnv.s3();
  return new S3Client({
    region: s3.region,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    ...(s3.endpoint ? { endpoint: s3.endpoint, forcePathStyle: true } : {}),
  });
}

/**
 * Finds the WebVTT rendition a `segment` sink wrote. HLS names it
 * `<base>_subs.vtt`, so the suffix is matched rather than the full key.
 */
export async function findTranscriptKey(prefix: string): Promise<string | null> {
  const s3 = serverEnv.s3();
  const out = await client().send(
    new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, MaxKeys: 1000 }),
  );
  const vtt = (out.Contents ?? [])
    .map((o) => o.Key)
    .filter((k): k is string => Boolean(k?.endsWith('_subs.vtt')))
    .sort();
  return vtt.at(-1) ?? null;
}

export async function readTextObject(key: string): Promise<string> {
  const s3 = serverEnv.s3();
  const out = await client().send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
  return (await out.Body?.transformToString()) ?? '';
}

/**
 * The newest snapshot per participant under an image sink's pathPrefix.
 *
 * The Job templates its pathPrefix as `.../{identity}`, so the folder names are the
 * participants. Polling is what stands in here for the bucket event you would
 * actually wire up: the image sink only uploads, it has no webhook.
 */
export async function latestFramePerIdentity(
  prefix: string,
): Promise<{ identity: string; key: string; at: string }[]> {
  const s3 = serverEnv.s3();
  const out = await client().send(
    new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, MaxKeys: 1000 }),
  );

  const newest = new Map<string, { key: string; at: Date }>();
  for (const object of out.Contents ?? []) {
    if (!object.Key || !object.LastModified) continue;
    const rest = object.Key.slice(prefix.replace(/\/$/, '').length + 1);
    const identity = rest.split('/')[0];
    if (!identity || !rest.includes('/')) continue;
    const seen = newest.get(identity);
    if (!seen || object.LastModified > seen.at) {
      newest.set(identity, { key: object.Key, at: object.LastModified });
    }
  }

  return [...newest.entries()]
    .map(([identity, { key, at }]) => ({ identity, key, at: at.toISOString() }))
    .sort((a, b) => a.identity.localeCompare(b.identity));
}

/** A short-lived URL so the browser can render a private object. */
export async function signedFrameUrl(key: string): Promise<string> {
  const s3 = serverEnv.s3();
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: s3.bucket, Key: key }), {
    expiresIn: 300,
  });
}

export async function listRecordingKeys(prefix: string): Promise<string[]> {
  const s3 = serverEnv.s3();
  const out = await client().send(
    new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, MaxKeys: 1000 }),
  );
  return (out.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
}
