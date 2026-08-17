import Link from 'next/link';

import { PipelineFlow } from '@/components/PipelineFlow';
import { Card, Chip } from '@/components/ui';
import { DEMOS, DEMO_COUNT_TITLE, ENV_LABELS } from '@/lib/demos';
import { envReadiness } from '@/lib/env';

/** Reads env on every request so the readiness chips reflect the running process. */
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const ready = envReadiness();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Real scenarios, real Job JSON
        </p>
        <h1 className="max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {DEMO_COUNT_TITLE} things people actually build on AVFlow
        </h1>
        <p className="max-w-2xl leading-relaxed text-muted">
          Each demo joins a live room in your browser, submits a real AVFlow Job, and shows you the
          JSON it sent. Nothing is pre-recorded and nothing is faked — if a topology is not
          expressible, it is not here.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(
            [
              ['avflow', ready.avflow],
              ['livekit', ready.livekit],
              ['rtmp', ready.rtmp],
              ['s3', ready.s3],
              ['openai', ready.openai],
              ['publicBaseUrl', ready.publicBaseUrl],
            ] as const
          ).map(([key, ok]) => (
            <span
              key={key}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-line bg-ink-raised text-muted'
              }`}
            >
              {ok ? '✓' : '○'} {ENV_LABELS[key]}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        {DEMOS.map((demo) => (
          <Card key={demo.id} className="space-y-5 transition hover:border-accent/30">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <h2 className="text-xl font-semibold tracking-tight">
                  <Link href={demo.href} className="hover:text-accent">
                    {demo.title}
                  </Link>
                </h2>
                <p className="text-sm text-slate-300">{demo.tagline}</p>
                <p className="text-sm text-muted">{demo.scenario}</p>
              </div>
              <Link
                href={demo.href}
                className="shrink-0 rounded-lg border border-line bg-ink-raised px-3 py-1.5 text-sm font-semibold hover:border-accent/40"
              >
                Open →
              </Link>
            </div>

            <PipelineFlow pipeline={demo.pipeline} />

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {demo.requires.map((req) => (
                <Chip key={req}>{ENV_LABELS[req]}</Chip>
              ))}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
