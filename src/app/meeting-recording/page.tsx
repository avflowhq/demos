import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';
import { envReadiness } from '@/lib/env';

import { MeetingClient } from './MeetingClient';

export const dynamic = 'force-dynamic';

export default function MeetingRecordingPage() {
  const ready = envReadiness();

  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('meeting-recording')} />
      <MeetingClient ready={{ s3: ready.s3, openai: ready.openai }} />
    </div>
  );
}
