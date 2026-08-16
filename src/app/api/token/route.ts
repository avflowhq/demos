import { serverEnv } from '@/lib/env';
import { errorResponse, requiredString } from '@/lib/http';
import { createJoinToken } from '@/lib/livekit';

/**
 * Mints a LiveKit token for a browser participant.
 *
 * This is deliberately unauthenticated so the demos run with nothing but a
 * `.env.local`. A real deployment must gate this behind your own auth — anyone
 * who can reach it can join any room.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const room = requiredString(body.room, 'room');
    const identity = requiredString(body.identity, 'identity');

    const token = await createJoinToken({
      room,
      identity,
      name: typeof body.name === 'string' ? body.name : identity,
      canPublish: body.canPublish !== false,
    });

    return Response.json({ token, serverUrl: serverEnv.livekit().url });
  } catch (err) {
    return errorResponse(err);
  }
}
