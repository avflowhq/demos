'use client';

import { useCallback, useState } from 'react';

import { CaptionFeed } from '@/components/feeds';
import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, btnGhost, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';

export function VoiceRoomClient({
  ready,
}: {
  ready: { rtmp: boolean; publicBaseUrl: boolean };
}) {
  const [room, setRoom] = useState('avflow-voiceroom');
  const [identity, setIdentity] = useState('speaker-1');
  const job = useJob('voice-room');

  const start = useCallback(() => {
    void job.submit({ room, language: 'multi' });
  }, [job, room]);

  const blocked = !ready.rtmp || !ready.publicBaseUrl;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <RoomPanel room={room} identity={identity} displayName={identity} video={false}>
          <CaptionFeed title="Captions arriving in the room" />
        </RoomPanel>

        <Callout title="The captions take a round trip">
          AVFlow never draws captions onto pixels. The <code className="text-slate-200">asr</code>{' '}
          node emits sidecar data, so a{' '}
          <code className="text-slate-200">livekit</code> sink publishes it back into this room, the
          overlay page below renders it onto a canvas as a normal room participant, and{' '}
          <code className="text-slate-200">web_capture</code> records that canvas. Because a
          non-segment sink carrying captions must also carry video, a 16×16{' '}
          <code className="text-slate-200">video_generator</code> rides along as the cheapest
          possible video carrier.
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
          <Field label="Your identity">
            <input
              className={inputClass}
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
            />
          </Field>
          <a
            className={`${btnGhost} w-full`}
            href={`/overlay/captions?room=${encodeURIComponent(room)}`}
            target="_blank"
            rel="noreferrer"
          >
            Preview the 9:16 overlay ↗
          </a>
          <p className="text-xs text-muted">
            This is the exact page AVFlow captures. It must be reachable from the internet, so
            PUBLIC_BASE_URL has to point at a tunnel when you run locally.
          </p>
        </Card>

        <JobConsole
          job={job}
          onStart={start}
          startLabel="Go live"
          disabled={blocked}
          disabledReason={
            !ready.publicBaseUrl
              ? 'Set PUBLIC_BASE_URL to a public tunnel URL — AVFlow’s browser has to load the overlay page.'
              : 'Set RTMP_PUSH_URL to your ingest URL.'
          }
        />
      </div>
    </div>
  );
}
