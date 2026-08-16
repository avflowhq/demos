'use client';

import { useCallback, useEffect, useState } from 'react';

import type { DemoId } from '@/lib/demos';

const LIVE_STATUSES = new Set(['pending', 'starting', 'running', 'stopping']);

export type JobControl = {
  status: string;
  jobName: string | null;
  error: string | null;
  submittedJob: unknown;
  busy: boolean;
  /** Upsert the job. Calling it again with new params hot-updates the pipeline. */
  submit: (params: Record<string, unknown>) => Promise<boolean>;
  stop: () => Promise<void>;
  isLive: boolean;
};

export function useJob(demo: DemoId): JobControl {
  const [status, setStatus] = useState('absent');
  const [jobName, setJobName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedJob, setSubmittedJob] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (params: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demo, ...params }),
        });
        const body = (await res.json()) as {
          error?: string;
          job?: unknown;
          status?: string;
          name?: string;
        };
        if (!res.ok) {
          setError(body.error ?? `Submit failed (${res.status})`);
          return false;
        }
        setSubmittedJob(body.job ?? null);
        setJobName(body.name ?? null);
        setStatus(body.status ?? 'pending');
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submit failed');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [demo],
  );

  const stop = useCallback(async () => {
    if (!jobName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(jobName)}`, { method: 'DELETE' });
      const body = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) {
        setError(body.error ?? `Stop failed (${res.status})`);
        return;
      }
      setStatus(body.status ?? 'stopping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stop failed');
    } finally {
      setBusy(false);
    }
  }, [jobName]);

  useEffect(() => {
    if (!jobName || !LIVE_STATUSES.has(status)) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${encodeURIComponent(jobName)}`);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { status?: string; error?: string };
        if (cancelled) return;
        if (body.status) setStatus(body.status);
        if (body.error) setError(body.error);
      } catch {
        // Transient poll failures are not worth surfacing.
      }
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobName, status]);

  return {
    status,
    jobName,
    error,
    submittedJob,
    busy,
    submit,
    stop,
    isLive: LIVE_STATUSES.has(status),
  };
}
