import 'server-only';

import { serverEnv } from '@/lib/env';

import type { Job, JobResponse } from './types';

export class AvflowError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AvflowError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiUrl, apiKey } = serverEnv.avflow();
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = body as { code?: string; error?: string; message?: string } | null;
    throw new AvflowError(
      res.status,
      err?.code ?? 'request_failed',
      err?.message ?? err?.error ?? `AVFlow returned ${res.status}`,
    );
  }
  return body as T;
}

/**
 * Create or hot-update a job. `POST /v1/jobs` is an upsert keyed by `name`:
 * re-submitting the same name reconfigures the running pipeline instead of
 * restarting it, which is how the co-host demo switches layouts mid-stream.
 */
export function submitJob(job: Job): Promise<JobResponse> {
  return request<JobResponse>('/v1/jobs', {
    method: 'POST',
    body: JSON.stringify(job),
  });
}

export function getJob(name: string): Promise<JobResponse> {
  return request<JobResponse>(`/v1/jobs/${encodeURIComponent(name)}`);
}

export function listJobs(limit = 20): Promise<{ items?: JobResponse[] }> {
  return request<{ items?: JobResponse[] }>(`/v1/jobs?limit=${limit}&page=1`);
}

export function stopJob(name: string): Promise<JobResponse> {
  return request<JobResponse>(`/v1/jobs/${encodeURIComponent(name)}`, { method: 'DELETE' });
}
