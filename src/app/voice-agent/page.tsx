import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';

import { AgentClient } from './AgentClient';

export default function VoiceAgentPage() {
  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('voice-agent')} />
      <AgentClient />
    </div>
  );
}
