import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';
import { envReadiness } from '@/lib/env';

import { CohostClient } from './CohostClient';

export const dynamic = 'force-dynamic';

export default function CohostPage() {
  const ready = envReadiness();

  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('cohost')} />
      <CohostClient ready={{ rtmp: ready.rtmp }} />
    </div>
  );
}
