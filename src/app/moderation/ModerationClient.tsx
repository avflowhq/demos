'use client';

import { useCallback, useEffect, useState } from 'react';

import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';

type Frame = { identity: string; at: string; url: string };
type Finding = {
  identity: string;
  at: string;
  verdict: 'ok' | 'review' | 'violation';
  reason: string;
  text?: string;
  seconds?: number;
  level?: number;
};

const VERDICT_STYLE: Record<Finding['verdict'], string> = {
  ok: 'border-line text-muted',
  review: 'border-amber-500/40 text-amber-200',
  violation: 'border-red-500/40 text-red-200',
};

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}

export function ModerationClient({
  ready,
}: {
  ready: { s3: boolean; moderationUrl: boolean; openai: boolean };
}) {
  const [room, setRoom] = useState('avflow-moderation');
  const [identity, setIdentity] = useState('participant-1');
  const [intervalSec, setIntervalSec] = useState(10);
  const job = useJob('moderation');

  const [frames, setFrames] = useState<Frame[]>([]);
  const [framesError, setFramesError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);

  const start = useCallback(() => {
    void job.submit({ room, intervalSec });
  }, [job, room, intervalSec]);

  // Two independent loops, because the two halves of this pipeline arrive
  // differently: audio streams in over a socket, while frames have to be looked
  // for in the bucket the image sink uploads to.
  useEffect(() => {
    if (!job.isLive) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/moderation/frames?room=${encodeURIComponent(room)}`);
        const body = (await res.json()) as { items?: Frame[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setFramesError(body.error ?? `Failed (${res.status})`);
          return;
        }
        setFramesError(null);
        setFrames(body.items ?? []);
      } catch {
        // A missed poll is not worth surfacing; the next one is seconds away.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), Math.max(5, intervalSec) * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job.isLive, room, intervalSec]);

  useEffect(() => {
    if (!job.isLive) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/moderation/events');
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { items?: Finding[] };
        if (!cancelled) setFindings(body.items ?? []);
      } catch {
        // Same here.
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job.isLive]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <RoomPanel room={room} identity={identity} displayName={identity} />

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Newest frame per participant
          </h2>
          {framesError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
              {framesError}
            </p>
          ) : null}
          {frames.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing yet. The first snapshot lands about {intervalSec}s after the job starts, and
              only participants publishing video get one.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {frames.map((frame) => (
                <li key={frame.identity} className="space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not a static asset */}
                  <img
                    src={frame.url}
                    alt={`Latest snapshot of ${frame.identity}`}
                    className="w-full rounded-lg border border-line"
                  />
                  <p className="truncate font-mono text-xs text-slate-300">{frame.identity}</p>
                  <p className="font-mono text-[0.7rem] text-muted">{clock(frame.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Callout title="Nothing here is mixed, and that is the point">
          <code className="text-slate-200">image</code> and{' '}
          <code className="text-slate-200">websocket</code> are the only two{' '}
          <code className="text-slate-200">n:n</code> sinks — they keep one output per participant.
          Every other sink is <code className="text-slate-200">1:1</code> and would need a mixer
          first, which is exactly what destroys the attribution a moderation finding depends on.
          Because an <code className="text-slate-200">audio_encoder</code> is also{' '}
          <code className="text-slate-200">1:1</code>, per-participant audio leaves as PCM;{' '}
          <code className="text-slate-200">audio_resample</code> drops it to 16 kHz mono, which is
          both what speech models want and about 6× less egress than 48 kHz stereo.
        </Callout>
      </div>

      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Setup</h2>
          <Field label="Room">
            <input
              className={inputClass}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={job.isLive}
            />
          </Field>
          <Field label="Your identity">
            <input
              className={inputClass}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
          </Field>
          <Field label="Snapshot interval (seconds)">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={3600}
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value) || 10)}
              disabled={job.isLive}
            />
          </Field>
          <p className="text-xs text-muted">
            Run <code className="text-slate-300">pnpm moderation</code> in a second terminal and
            point MODERATION_WS_URL at it. AVFlow dials that URL from the cloud, so locally it has
            to be a tunnel.
          </p>
        </Card>

        <JobConsole
          job={job}
          onStart={start}
          startLabel="Start reviewing"
          disabled={!ready.s3 || !ready.moderationUrl}
          disabledReason={
            !ready.moderationUrl
              ? 'Set MODERATION_WS_URL to the tunnel in front of `pnpm moderation` — AVFlow opens one socket per participant against it.'
              : 'Snapshots go to object storage, so S3_BUCKET and its credentials must be set.'
          }
        />

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            Audio findings
          </h2>
          <p className="text-sm text-muted">
            One socket per participant, reviewed in {6}-second windows. Silence is skipped rather
            than transcribed.
          </p>
          {!ready.openai ? (
            <p className="text-xs text-amber-200">
              Without OPENAI_API_KEY the server still reports which participant is speaking, it just
              does not transcribe or judge.
            </p>
          ) : null}
          {findings.length === 0 ? (
            <p className="text-sm text-muted">Nothing reviewed yet — say something in the room.</p>
          ) : (
            <ul className="space-y-2">
              {findings.map((finding, index) => (
                <li
                  key={`${finding.identity}-${finding.at}-${index}`}
                  className={`space-y-1 rounded-lg border bg-ink/60 p-3 ${VERDICT_STYLE[finding.verdict]}`}
                >
                  <p className="flex items-baseline justify-between gap-2 font-mono text-xs">
                    <span className="truncate text-slate-200">{finding.identity}</span>
                    <span>{finding.verdict}</span>
                  </p>
                  {finding.text ? (
                    <p className="text-sm text-slate-300">&ldquo;{finding.text}&rdquo;</p>
                  ) : null}
                  {finding.reason ? <p className="text-xs">{finding.reason}</p> : null}
                  <p className="font-mono text-[0.7rem] text-muted">{clock(finding.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
