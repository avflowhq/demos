import { serverEnv } from '@/lib/env';
import { errorResponse, requiredString } from '@/lib/http';
import { jobName } from '@/lib/naming';
import { latestFramePerIdentity, signedFrameUrl } from '@/lib/s3';

export const dynamic = 'force-dynamic';

/**
 * The newest snapshot the image sink wrote for each participant.
 *
 * A real service would react to a bucket event instead of polling, but the image
 * sink has no webhook: it uploads and nothing else, so something has to go
 * looking. That also means the freshest frame here is up to `intervalSec` old.
 */
export async function GET(request: Request) {
  try {
    const room = requiredString(
      new URL(request.url).searchParams.get('room'),
      'room',
    );
    const s3 = serverEnv.s3();
    const prefix = [s3.pathPrefix, `moderation/${jobName('moderation', room)}`]
      .filter(Boolean)
      .join('/');

    const frames = await latestFramePerIdentity(prefix);
    const items = await Promise.all(
      frames.map(async (frame) => ({
        identity: frame.identity,
        at: frame.at,
        url: await signedFrameUrl(frame.key),
      })),
    );

    return Response.json({ items });
  } catch (err) {
    return errorResponse(err);
  }
}
