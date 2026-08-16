'use client';

import { useCallback, useState } from 'react';

import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, btnGhost, btnPrimary, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';
import {
  COHOST_LAYOUTS,
  COHOST_LAYOUT_LABELS,
  COHOST_LAYOUT_NOTES,
  cohostRegions,
  type CohostLayoutId,
} from '@/lib/cohostLayouts';

/** Mirrors the mixer's ratio geometry so you can see a layout before switching to it. */
function LayoutPreview({
  layout,
  host,
  guest,
}: {
  layout: CohostLayoutId;
  host: string;
  guest: string;
}) {
  const regions = cohostRegions(layout, host, guest);

  return (
    <div className="relative mx-auto aspect-[9/16] w-44 overflow-hidden rounded-xl border border-line bg-ink">
      {regions.map((region) => (
        <div
          key={region.name}
          className="absolute grid place-items-center border border-sky-500/30 bg-sky-500/10 text-[0.625rem] font-semibold tracking-wide text-sky-200 uppercase"
          style={{
            left: `${(region.offsetX ?? 0) * 100}%`,
            top: `${(region.offsetY ?? 0) * 100}%`,
            width: `${region.width * 100}%`,
            height: `${region.height * 100}%`,
            zIndex: region.zIndex ?? 1,
            borderRadius: region.style?.borderRadius ? region.style.borderRadius / 3 : 4,
          }}
        >
          {region.name}
        </div>
      ))}
    </div>
  );
}

export function CohostClient({ ready }: { ready: { rtmp: boolean } }) {
  const [room, setRoom] = useState('avflow-cohost');
  const [hostIdentity, setHostIdentity] = useState('host');
  const [guestIdentity, setGuestIdentity] = useState('guest');
  const [seat, setSeat] = useState<'host' | 'guest'>('host');
  const [layout, setLayout] = useState<CohostLayoutId>('solo');

  const job = useJob('cohost');

  const submitWith = useCallback(
    (next: CohostLayoutId) => {
      void job.submit({ room, layout: next, hostIdentity, guestIdentity });
    },
    [job, room, hostIdentity, guestIdentity],
  );

  const pickLayout = useCallback(
    (next: CohostLayoutId) => {
      setLayout(next);
      // While the job runs, the same-name re-submit is the hot update that
      // retargets the mixer without dropping the RTMP output.
      if (job.isLive) submitWith(next);
    },
    [job.isLive, submitWith],
  );

  const seatIdentity = seat === 'host' ? hostIdentity : guestIdentity;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Take a seat</h2>
          <div className="flex gap-2">
            {(['host', 'guest'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={seat === option ? btnPrimary : btnGhost}
                onClick={() => setSeat(option)}
              >
                Join as {option}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            Regions match on participant identity, so the seat you pick decides which region you land
            in. Open this page in a second browser to fill the other seat.
          </p>
        </Card>

        <RoomPanel key={seatIdentity} room={room} identity={seatIdentity} displayName={seat} />

        <Callout title="Why switching does not interrupt the stream">
          There is no layout-only endpoint. Switching re-submits the whole Job under the same name,
          and AVFlow treats that as an upsert — the running mixer is reconfigured in place rather
          than torn down and rebuilt.
        </Callout>
      </div>

      <div className="space-y-6">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Setup</h2>
          <Field label="Room">
            <input
              className={inputClass}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={job.isLive}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Host identity">
              <input
                className={inputClass}
                value={hostIdentity}
                onChange={(e) => setHostIdentity(e.target.value)}
                disabled={job.isLive}
              />
            </Field>
            <Field label="Guest identity">
              <input
                className={inputClass}
                value={guestIdentity}
                onChange={(e) => setGuestIdentity(e.target.value)}
                disabled={job.isLive}
              />
            </Field>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
              Director — 1080 × 1920
            </h2>
            <p className="mt-1 text-sm text-muted">{COHOST_LAYOUT_NOTES[layout]}</p>
          </div>
          <LayoutPreview layout={layout} host={hostIdentity} guest={guestIdentity} />
          <div className="grid grid-cols-3 gap-2">
            {COHOST_LAYOUTS.map((option) => (
              <button
                key={option}
                type="button"
                className={`${layout === option ? btnPrimary : btnGhost} !px-2 text-xs`}
                onClick={() => pickLayout(option)}
                disabled={job.busy}
              >
                {COHOST_LAYOUT_LABELS[option]}
              </button>
            ))}
          </div>
          {job.isLive ? (
            <p className="text-xs text-emerald-300">
              Live — picking a layout hot-updates the running job.
            </p>
          ) : null}
        </Card>

        <JobConsole
          job={job}
          onStart={() => submitWith(layout)}
          startLabel="Go live"
          disabled={!ready.rtmp}
          disabledReason="Set RTMP_PUSH_URL to your ingest URL (TikTok, YouTube, Twitch, or a local SRS)."
        />
      </div>
    </div>
  );
}
