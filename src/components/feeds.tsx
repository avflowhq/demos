'use client';

import { useDataChannel } from '@livekit/components-react';
import { useState } from 'react';

import { Card } from '@/components/ui';
import { TOPIC, decodeAgentLine, decodeCaption, mergeCaption, type Caption } from '@/lib/captions';

/**
 * Live captions as they arrive in the room.
 *
 * The `asr` node has no direct path to a browser — a `livekit` sink publishes
 * its output on the `avflow.asrText` topic, and this is a normal room
 * participant reading that data channel.
 */
export function CaptionFeed({ title = 'Live captions' }: { title?: string }) {
  const [lines, setLines] = useState<Caption[]>([]);

  useDataChannel(TOPIC.asr, (msg) => {
    const caption = decodeCaption(msg.payload);
    if (caption) setLines((prev) => mergeCaption(prev, caption));
  });

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing yet. Captions appear once the job is running and someone speaks.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto text-sm">
          {lines.map((line, i) => (
            <li key={`${line.startMs}-${i}`} className={line.isFinal ? '' : 'opacity-60'}>
              {line.speaker ? (
                <span className="mr-2 font-semibold text-accent">{line.speaker}</span>
              ) : null}
              <span className="text-slate-200">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AgentTranscript() {
  const [lines, setLines] = useState<{ text: string; role: string }[]>([]);

  useDataChannel(TOPIC.voiceAgent, (msg) => {
    const line = decodeAgentLine(msg.payload);
    if (line) setLines((prev) => [...prev, line].slice(-40));
  });

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        Agent conversation
      </h2>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">
          The agent greets the room once the job reaches <span className="font-mono">running</span>.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto text-sm">
          {lines.map((line, i) => (
            <li key={i}>
              <span
                className={`mr-2 font-semibold ${
                  line.role === 'assistant' ? 'text-accent' : 'text-slate-400'
                }`}
              >
                {line.role === 'assistant' ? 'Agent' : 'Room'}
              </span>
              <span className="text-slate-200">{line.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TranslationFeed({ language }: { language: string }) {
  const [lines, setLines] = useState<Caption[]>([]);

  useDataChannel(TOPIC.translate, (msg) => {
    const caption = decodeCaption(msg.payload);
    if (caption) setLines((prev) => mergeCaption(prev, caption));
  });

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
        Interpretation ({language})
      </h2>
      <p className="text-xs text-muted">
        The translated voice arrives as an extra audio track — unmute it in the room, or read along
        here.
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted">Nothing translated yet.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-auto text-sm text-slate-200">
          {lines.map((line, i) => (
            <li key={`${line.startMs}-${i}`}>{line.text}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
