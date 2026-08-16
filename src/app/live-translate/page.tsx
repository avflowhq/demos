import { DemoHeader } from '@/components/DemoHeader';
import { demoById } from '@/lib/demos';

import { TranslateClient } from './TranslateClient';

export default function LiveTranslatePage() {
  return (
    <div className="space-y-8">
      <DemoHeader demo={demoById('live-translate')} />
      <TranslateClient />
    </div>
  );
}
