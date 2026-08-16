export type TranscriptLine = {
  startMs: number;
  endMs: number;
  speaker?: string;
  text: string;
};

const TIMING = /^(\d{2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(\d{2}:)?\d{2}:\d{2}[.,]\d{3}/;

/**
 * Parses the WebVTT rendition a `segment` sink produces.
 *
 * With `caption.showSpeaker` enabled, cue text is prefixed with the speaker as
 * `<v Name>` or `Name: `, so both forms are split out.
 */
export function parseVtt(vtt: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  const blocks = vtt.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const block of blocks) {
    const rows = block.split('\n').filter((r) => r.trim() && r.trim() !== 'WEBVTT');
    const timingIndex = rows.findIndex((r) => TIMING.test(r.trim()));
    if (timingIndex === -1) continue;

    const [rawStart, rawEnd] = rows[timingIndex].split('-->').map((s) => s.trim());
    const body = rows
      .slice(timingIndex + 1)
      .join(' ')
      .trim();
    if (!body) continue;

    const { speaker, text } = splitSpeaker(body);
    if (!text) continue;

    lines.push({
      startMs: parseTimestamp(rawStart),
      endMs: parseTimestamp(rawEnd.split(/\s+/)[0]),
      speaker,
      text,
    });
  }
  return dedupe(lines);
}

function splitSpeaker(body: string): { speaker?: string; text: string } {
  const voiceTag = body.match(/^<v\s+([^>]+)>\s*(.*)$/s);
  if (voiceTag) return { speaker: voiceTag[1].trim(), text: stripTags(voiceTag[2]) };

  const colon = body.match(/^([\w .'-]{1,40}):\s+(.*)$/s);
  if (colon) return { speaker: colon[1].trim(), text: stripTags(colon[2]) };

  return { text: stripTags(body) };
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function parseTimestamp(stamp: string): number {
  const parts = stamp.replace(',', '.').split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0] ?? 0, parts[1] ?? 0];
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

/**
 * Streaming ASR emits a cue per interim update, so the same sentence appears
 * several times with a growing tail. Keeping the longest text per speaker run
 * gives a readable transcript.
 */
function dedupe(lines: TranscriptLine[]): TranscriptLine[] {
  const out: TranscriptLine[] = [];
  for (const line of lines) {
    const prev = out.at(-1);
    if (prev && prev.speaker === line.speaker) {
      const a = prev.text.toLowerCase();
      const b = line.text.toLowerCase();
      if (b.startsWith(a)) {
        out[out.length - 1] = { ...prev, text: line.text, endMs: line.endMs };
        continue;
      }
      if (a.startsWith(b)) {
        out[out.length - 1] = { ...prev, endMs: line.endMs };
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

export function formatTranscript(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${formatClock(l.startMs)}] ${l.speaker ? `${l.speaker}: ` : ''}${l.text}`)
    .join('\n');
}

export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
