import 'server-only';

import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

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

export async function listRecordingKeys(prefix: string): Promise<string[]> {
  const s3 = serverEnv.s3();
  const out = await client().send(
    new ListObjectsV2Command({ Bucket: s3.bucket, Prefix: prefix, MaxKeys: 1000 }),
  );
  return (out.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
}
