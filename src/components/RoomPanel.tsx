'use client';

import '@livekit/components-styles';

import {
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useCallback, useState, type ReactNode } from 'react';

import { Card, btnGhost, btnPrimary } from '@/components/ui';

/** AVFlow's own participants (caption carrier, agent voice) are infrastructure, not people. */
const isBot = (identity: string) => identity.startsWith('avflow-');

function VideoStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  ).filter((t) => !isBot(t.participant.identity));

  if (tracks.length === 0) {
    return (
      <div className="grid h-64 place-items-center rounded-xl border border-line bg-ink text-sm text-muted">
        No camera or screen share yet.
      </div>
    );
  }

  return (
    <div className="h-[26rem] overflow-hidden rounded-xl border border-line bg-ink">
      <GridLayout tracks={tracks}>
        <ParticipantTile />
      </GridLayout>
    </div>
  );
}

export function RoomPanel({
  room,
  identity,
  displayName,
  video = true,
  audio = true,
  children,
}: {
  room: string;
  identity: string;
  displayName?: string;
  video?: boolean;
  audio?: boolean;
  children?: ReactNode;
}) {
  const [creds, setCreds] = useState<{ token: string; serverUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const join = useCallback(async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, identity, name: displayName ?? identity }),
      });
      const body = (await res.json()) as { token?: string; serverUrl?: string; error?: string };
      if (!res.ok || !body.token || !body.serverUrl) {
        setError(body.error ?? `Could not get a token (${res.status})`);
        return;
      }
      setCreds({ token: body.token, serverUrl: body.serverUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get a token');
    } finally {
      setJoining(false);
    }
  }, [room, identity, displayName]);

  if (!creds) {
    return (
      <Card className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Your seat</h2>
          <p className="mt-1 text-sm text-muted">
            Join <span className="font-mono text-slate-300">{room}</span> as{' '}
            <span className="font-mono text-slate-300">{identity}</span>.
          </p>
        </div>
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        <button type="button" className={btnPrimary} onClick={() => void join()} disabled={joining}>
          {joining ? 'Joining…' : audio && !video ? 'Join with mic' : 'Join room'}
        </button>
      </Card>
    );
  }

  return (
    <LiveKitRoom
      token={creds.token}
      serverUrl={creds.serverUrl}
      connect
      audio={audio}
      video={video}
      onDisconnected={() => setCreds(null)}
      className="space-y-3"
    >
      {video ? <VideoStage /> : null}
      <RoomAudioRenderer />
      <div className="flex flex-wrap items-center gap-2">
        <ControlBar
          variation="minimal"
          controls={{
            camera: video,
            microphone: audio,
            screenShare: video,
            chat: false,
            settings: false,
            leave: false,
          }}
        />
        <button type="button" className={btnGhost} onClick={() => setCreds(null)}>
          Leave
        </button>
      </div>
      {children}
    </LiveKitRoom>
  );
}
