import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';
import { envReadiness } from '@/lib/env';

import { VoiceRoomClient } from './VoiceRoomClient';

export const dynamic = 'force-dynamic';

export default function VoiceRoomPage() {
  const ready = envReadiness();

  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('voice-room')} />
      <VoiceRoomClient ready={{ rtmp: ready.rtmp, publicBaseUrl: ready.publicBaseUrl }} />
    </div>
  );
}
