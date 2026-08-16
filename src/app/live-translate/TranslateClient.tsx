'use client';

import { useCallback, useState } from 'react';

import { TranslationFeed } from '@/components/feeds';
import { JobConsole } from '@/components/JobConsole';
import { RoomPanel } from '@/components/RoomPanel';
import { Callout, Card, Field, inputClass } from '@/components/ui';
import { useJob } from '@/hooks/useJob';
import { TRANSLATE_LANGUAGES } from '@/lib/languages';

export function TranslateClient() {
  const [room, setRoom] = useState('avflow-townhall');
  const [identity, setIdentity] = useState('speaker-1');
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const job = useJob('live-translate');

  const start = useCallback(() => {
    void job.submit({ room, targetLanguage });
  }, [job, room, targetLanguage]);

  const languageLabel =
    TRANSLATE_LANGUAGES.find((l) => l.code === targetLanguage)?.label ?? targetLanguage;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <RoomPanel room={room} identity={identity} displayName={identity} video={false}>
          <TranslationFeed language={languageLabel} />
        </RoomPanel>

        <Callout title="One job per language">
          Each language is its own job with its own publisher identity, so you can run several at
          once and let listeners pick a track. The source excludes every translator identity —
          without that, one interpreter would start translating another&apos;s output.
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
          <Field
            label="Translate into"
            hint="translate is platform-managed — passing provider or providerConfig is rejected."
          >
            <select
              className={inputClass}
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              disabled={job.isLive}
            >
              {TRANSLATE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <JobConsole job={job} onStart={start} startLabel="Start interpreting" />
      </div>
    </div>
  );
}
