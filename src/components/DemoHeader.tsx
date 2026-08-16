import Link from 'next/link';

import { PipelineFlow } from '@/components/PipelineFlow';
import { Card } from '@/components/ui';
import type { DemoMeta } from '@/lib/demos';

export function DemoHeader({ demo }: { demo: DemoMeta }) {
  return (
    <header className="space-y-5">
      <Link href="/" className="text-sm text-muted hover:text-body">
        ← All demos
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{demo.title}</h1>
        <p className="max-w-2xl leading-relaxed text-muted">{demo.scenario}</p>
      </div>
      <Card>
        <PipelineFlow pipeline={demo.pipeline} />
      </Card>
      <div className="flex flex-wrap gap-3 text-sm">
        {demo.docs.map((doc) => (
          <a key={doc.href} href={doc.href} className="text-accent hover:underline">
            {doc.label} ↗
          </a>
        ))}
      </div>
    </header>
  );
}
