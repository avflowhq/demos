import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';
import { envReadiness } from '@/lib/env';

import { ModerationClient } from './ModerationClient';

export const dynamic = 'force-dynamic';

export default function ModerationPage() {
  const ready = envReadiness();

  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('moderation')} />
      <ModerationClient
        ready={{ s3: ready.s3, moderationUrl: ready.moderationUrl, openai: ready.openai }}
      />
    </div>
  );
}
