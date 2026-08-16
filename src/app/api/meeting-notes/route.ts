import OpenAI from 'openai';

import { serverEnv } from '@/lib/env';
import { errorResponse, jsonError, requiredString } from '@/lib/http';
import { jobName } from '@/lib/jobs/shared';
import { findTranscriptKey, readTextObject } from '@/lib/s3';
import { formatTranscript, parseVtt } from '@/lib/vtt';

const SYSTEM_PROMPT = [
  'You turn raw meeting transcripts into concise notes.',
  'Reply in the dominant language of the transcript.',
  'Use exactly these sections: Summary, Decisions, Action items, Open questions.',
  'Under Action items, name the owner when the transcript makes it clear.',
  'Omit a section entirely when the transcript has nothing for it.',
  'Never invent details that are not in the transcript.',
].join(' ');

/**
 * Reads the transcript AVFlow wrote alongside the recording, then summarises it.
 *
 * The summarising step is deliberately outside AVFlow: the platform produces
 * the WebVTT rendition, and turning that into notes is ordinary application
 * work an LLM handles.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const room = requiredString(body.room, 'room');
    const prefix = [serverEnv.s3().pathPrefix, `meetings/${jobName('meeting', room)}`]
      .filter(Boolean)
      .join('/');

    const key = await findTranscriptKey(prefix);
    if (!key) {
      return jsonError(
        404,
        `No transcript under s3://${serverEnv.s3().bucket}/${prefix}. Recordings finalise their WebVTT when the job stops — wait for status "stopped" and try again.`,
      );
    }

    const lines = parseVtt(await readTextObject(key));
    if (lines.length === 0) {
      return jsonError(422, 'The transcript is empty — was anyone speaking during the recording?');
    }

    const transcript = formatTranscript(lines);
    const client = new OpenAI({ apiKey: serverEnv.openaiKey() });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript.slice(0, 120_000) },
      ],
    });

    return Response.json({
      transcriptKey: key,
      lineCount: lines.length,
      transcript,
      notes: completion.choices[0]?.message?.content ?? '',
    });
  } catch (err) {
    return errorResponse(err);
  }
}
