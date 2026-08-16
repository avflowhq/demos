'use client';

import { useState } from 'react';

import type { JobControl } from '@/hooks/useJob';
import { Card, CodeBlock, StatusBadge, btnDanger, btnGhost, btnPrimary } from '@/components/ui';

export function JobConsole({
  job,
  onStart,
  startLabel = 'Start job',
  disabled,
  disabledReason,
  children,
}: {
  job: JobControl;
  onStart: () => void;
  startLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
}) {
  const [showJson, setShowJson] = useState(false);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">AVFlow job</h2>
          <StatusBadge status={job.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btnPrimary}
            onClick={onStart}
            disabled={job.busy || disabled}
          >
            {job.busy ? 'Working…' : job.isLive ? 'Re-submit' : startLabel}
          </button>
          <button
            type="button"
            className={btnDanger}
            onClick={() => void job.stop()}
            disabled={job.busy || !job.jobName || !job.isLive}
          >
            Stop
          </button>
        </div>
      </div>

      {job.jobName ? (
        <p className="font-mono text-xs text-muted">
          name: <span className="text-slate-300">{job.jobName}</span>
        </p>
      ) : null}

      {disabled && disabledReason ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          {disabledReason}
        </p>
      ) : null}

      {job.error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm break-words text-red-200">
          {job.error}
        </p>
      ) : null}

      {children}

      {job.submittedJob ? (
        <div className="space-y-2">
          <button
            type="button"
            className={`${btnGhost} w-full`}
            onClick={() => setShowJson((v) => !v)}
          >
            {showJson ? 'Hide' : 'Show'} submitted Job JSON
          </button>
          {showJson ? (
            <>
              <CodeBlock>{JSON.stringify(job.submittedJob, null, 2)}</CodeBlock>
              <p className="text-xs text-muted">
                Tokens, storage keys, and stream keys are redacted before this reaches the browser.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
