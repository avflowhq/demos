'use client';

import { useCallback, useState } from 'react';

import { AgentTranscript } from '@/components/feeds';
import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';

const DEFAULT_INSTRUCTIONS = [
  'You are a co-host on a live audio show.',
  'Keep replies to one or two sentences so the conversation stays quick.',
  'When the hosts talk to each other, stay quiet unless asked something.',
].join(' ');

export function AgentClient() {
  const [room, setRoom] = useState('avflow-agent');
  const [identity, setIdentity] = useState('host');
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [greeting, setGreeting] = useState('Hey everyone, I just joined. What are we talking about?');
  const [language, setLanguage] = useState('en');
  const job = useJob('voice-agent');

  const start = useCallback(() => {
    void job.submit({ room, instructions, greeting, language });
  }, [job, room, instructions, greeting, language]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <RoomPanel room={room} identity={identity} displayName={identity} video={false}>
          <AgentTranscript />
        </RoomPanel>

        <Callout title="Two guards stop the agent hearing itself">
          The <code className="text-slate-200">livekit</code> source excludes the agent&apos;s own
          identity, and the sink&apos;s token is publish-only. Without either one the agent
          transcribes its own voice and talks itself into a loop. Barge-in is on, so speaking over it
          cuts its current turn short.
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
          <Field label="Language">
            <input
              className={inputClass}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="en"
            />
          </Field>
          <Field label="Instructions">
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <Field label="Greeting" hint="Spoken once the agent joins.">
            <input
              className={inputClass}
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
            />
          </Field>
        </Card>

        <JobConsole job={job} onStart={start} startLabel="Invite the agent">
          <p className="text-xs text-muted">
            Re-submitting applies new instructions to the running agent.
          </p>
        </JobConsole>
      </div>
    </div>
  );
}
