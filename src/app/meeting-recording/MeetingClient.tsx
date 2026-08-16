'use client';

import { useCallback, useState } from 'react';

import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, btnPrimary, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';

type Notes = { notes: string; transcript: string; transcriptKey: string; lineCount: number };

export function MeetingClient({ ready }: { ready: { s3: boolean; openai: boolean } }) {
  const [room, setRoom] = useState('avflow-standup');
  const [identity, setIdentity] = useState('you');
  const job = useJob('meeting-recording');

  const [notes, setNotes] = useState<Notes | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);

  const start = useCallback(() => {
    void job.submit({ room, language: 'multi' });
  }, [job, room]);

  const generateNotes = useCallback(async () => {
    setNotesBusy(true);
    setNotesError(null);
    setNotes(null);
    try {
      const res = await fetch('/api/meeting-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      });
      const body = (await res.json()) as Notes & { error?: string };
      if (!res.ok) {
        setNotesError(body.error ?? `Failed (${res.status})`);
        return;
      }
      setNotes(body);
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setNotesBusy(false);
    }
  }, [room]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <RoomPanel room={room} identity={identity} displayName={identity} />
        <Callout title="How the layout behaves">
          <code className="text-slate-200">video_mixer</code> runs in{' '}
          <code className="text-slate-200">speaker</code> mode with{' '}
          <code className="text-slate-200">
            mainPriority: [&quot;screen_share&quot;, &quot;active_speaker&quot;]
          </code>
          , so sharing your screen promotes it to the main region; otherwise the loudest speaker
          holds it. Everyone else drops into the thumbnail rail.
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
        </Card>

        <JobConsole
          job={job}
          onStart={start}
          startLabel="Start recording"
          disabled={!ready.s3}
          disabledReason="Recording writes HLS to object storage, so S3_BUCKET and its credentials must be set."
        />

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Meeting notes</h2>
          <p className="text-sm text-muted">
            AVFlow writes the transcript as a WebVTT rendition beside the recording. HLS finalises it
            when the job stops, so stop the job first, then summarise.
          </p>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => void generateNotes()}
            disabled={notesBusy || !ready.s3 || !ready.openai}
          >
            {notesBusy ? 'Reading transcript…' : 'Generate notes'}
          </button>
          {!ready.openai ? (
            <p className="text-xs text-amber-200">
              Set OPENAI_API_KEY to enable summarising. The transcript itself needs no extra keys.
            </p>
          ) : null}
          {notesError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
              {notesError}
            </p>
          ) : null}
          {notes ? (
            <div className="space-y-3">
              <p className="font-mono text-xs text-muted">
                {notes.transcriptKey} · {notes.lineCount} lines
              </p>
              <div className="rounded-xl border border-line bg-ink p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-200">
                {notes.notes}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted hover:text-body">
                  Raw transcript
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-line bg-ink p-4 font-mono text-xs whitespace-pre-wrap text-slate-400">
                  {notes.transcript}
                </pre>
              </details>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
