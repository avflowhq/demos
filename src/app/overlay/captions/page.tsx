import type { Metadata } from 'next';

import { OverlayCanvas } from './OverlayCanvas';

export const metadata: Metadata = {
  title: 'AVFlow caption overlay',
  robots: { index: false, follow: false },
};

/** Rendered for `web_capture`, not for people — no site chrome. */
export default function CaptionOverlayPage() {
  return <OverlayCanvas />;
}
