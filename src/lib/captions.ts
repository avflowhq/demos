/** Decoding for AVFlow data messages, shared by the demo pages and the overlay. */

export const TOPIC = {
  asr: 'avflow.asrText',
  voiceAgent: 'avflow.voiceAgentText',
  translate: 'avflow.translateText',
  audioLevels: 'avflow.audioLevels',
} as const;

export type Caption = {
  text: string;
  speaker?: string;
  identity?: string;
  isFinal: boolean;
  startMs: number;
  endMs: number;
};

export type AgentLine = { text: string; role: string };

/**
 * RTC sinks publish the payload body with the event type in the topic, while
 * the SEI/WebVTT paths wrap it as `{ type, data }`. Unwrapping when an envelope
 * shows up keeps this usable against either.
 */
function decodeBody(payload: Uint8Array): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.type === 'string' && record.data && typeof record.data === 'object') {
      return record.data as Record<string, unknown>;
    }
    return record;
  } catch {
    return null;
  }
}

export function decodeCaption(payload: Uint8Array): Caption | null {
  const body = decodeBody(payload);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return null;
  return {
    text,
    speaker: typeof body?.speaker === 'string' ? body.speaker : undefined,
    identity: typeof body?.identity === 'string' ? body.identity : undefined,
    isFinal: body?.isFinal === true,
    startMs: typeof body?.startMs === 'number' ? body.startMs : 0,
    endMs: typeof body?.endMs === 'number' ? body.endMs : 0,
  };
}

export function decodeAgentLine(payload: Uint8Array): AgentLine | null {
  const body = decodeBody(payload);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return null;
  return { text, role: typeof body?.role === 'string' ? body.role : 'assistant' };
}

/**
 * Streaming ASR sends a growing interim cue before the final one. Replacing the
 * trailing non-final line from the same speaker keeps the list from filling up
 * with partial duplicates.
 */
export function mergeCaption(history: Caption[], next: Caption, limit = 60): Caption[] {
  const prev = history.at(-1);
  const merged =
    prev && !prev.isFinal && prev.speaker === next.speaker
      ? [...history.slice(0, -1), next]
      : [...history, next];
  return merged.slice(-limit);
}
