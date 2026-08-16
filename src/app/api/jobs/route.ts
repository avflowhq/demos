import { submitJob } from '@/lib/avflow/client';
import { redactJob } from '@/lib/avflow/redact';
import { errorResponse } from '@/lib/http';
import { buildDemoJob, parseDemoId } from '@/lib/jobs';

/**
 * Builds the Job for a demo and upserts it.
 *
 * Because `POST /v1/jobs` is keyed by job name, calling this again with changed
 * parameters hot-updates the running pipeline. The co-host demo relies on that
 * to switch layouts without interrupting the RTMP output.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const demo = parseDemoId(body.demo);
    const job = await buildDemoJob(demo, body);
    const response = await submitJob(job);

    return Response.json({
      job: redactJob(job),
      status: response.status ?? 'pending',
      id: response.id,
      name: job.name,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
