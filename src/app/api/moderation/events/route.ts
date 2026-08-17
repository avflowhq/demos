import { errorResponse } from '@/lib/http';
import { recentFindings, recordFinding } from '@/lib/moderationFindings';

export const dynamic = 'force-dynamic';

/** Called by the moderation server after it reviews a window of one participant's audio. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    recordFinding(body);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export function GET() {
  return Response.json({ items: recentFindings() });
}
