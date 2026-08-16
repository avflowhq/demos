import type { DemoMeta } from '@/lib/demos';

function Stage({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-[0.6875rem] font-semibold tracking-widest text-muted uppercase">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs leading-snug ${tone}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Arrow() {
  return (
    <div aria-hidden className="mt-7 shrink-0 text-lg text-slate-600 select-none">
      →
    </div>
  );
}

export function PipelineFlow({ pipeline }: { pipeline: DemoMeta['pipeline'] }) {
  return (
    <div className="flex items-start gap-3">
      <Stage
        label="Sources"
        items={pipeline.sources}
        tone="border-sky-500/25 bg-sky-500/5 text-sky-200"
      />
      <Arrow />
      <Stage
        label="Nodes"
        items={pipeline.nodes}
        tone="border-indigo-500/25 bg-indigo-500/5 text-indigo-200"
      />
      <Arrow />
      <Stage
        label="Sinks"
        items={pipeline.sinks}
        tone="border-emerald-500/25 bg-emerald-500/5 text-emerald-200"
      />
    </div>
  );
}
