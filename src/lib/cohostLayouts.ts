/** Co-host layout presets, shared by the Job builder and the browser preview. */

import type { Layout, Region } from '@/lib/avflow/types';

export const COHOST_LAYOUTS = ['solo', 'split', 'pip'] as const;
export type CohostLayoutId = (typeof COHOST_LAYOUTS)[number];

export const COHOST_LAYOUT_LABELS: Record<CohostLayoutId, string> = {
  solo: 'Host only',
  split: 'Split screen',
  pip: 'Picture in picture',
};

export const COHOST_LAYOUT_NOTES: Record<CohostLayoutId, string> = {
  solo: 'One full-frame region. Guests stay off screen even while they are in the room.',
  split: 'Two stacked halves — the shape vertical audiences expect for a duet.',
  pip: 'An inset guest tile. `zIndex` is paint order, and with no alpha the tile fully covers the frame beneath it.',
};

const ACCENT = '#38bdf8';
const PANEL = '#111a2e';

function waitingFor(label: string) {
  return {
    text: { content: `Waiting for ${label}…`, position: 'bottom', color: '#94a3b8', fontSize: 40 },
  };
}

/**
 * Regions use `ratio` coordinates (0..1), so the same numbers describe any
 * canvas size.
 */
export function cohostRegions(
  layout: CohostLayoutId,
  host: string,
  guest: string,
): Region[] {
  const hostTile: Region = {
    name: 'host',
    source: { identity: host },
    width: 1,
    height: 1,
    fit: 'cover',
    placeholder: waitingFor('the host'),
  };

  switch (layout) {
    case 'solo':
      return [hostTile];

    case 'split':
      return [
        { ...hostTile, height: 0.5 },
        {
          name: 'guest',
          source: { identity: guest },
          offsetY: 0.5,
          width: 1,
          height: 0.5,
          fit: 'cover',
          style: { backgroundColor: PANEL },
          placeholder: waitingFor('a guest'),
        },
      ];

    case 'pip':
      return [
        hostTile,
        {
          name: 'guest',
          source: { identity: guest },
          offsetX: 0.6,
          offsetY: 0.64,
          width: 0.36,
          height: 0.24,
          zIndex: 2,
          fit: 'cover',
          style: {
            backgroundColor: PANEL,
            borderColor: ACCENT,
            borderWidth: 4,
            borderRadius: 28,
          },
          placeholder: waitingFor('a guest'),
        },
      ];
  }
}

export function cohostLayout(layout: CohostLayoutId, host: string, guest: string): Layout {
  return {
    mode: 'custom',
    common: { borderRadius: 20 },
    custom: { regions: cohostRegions(layout, host, guest) },
  };
}
