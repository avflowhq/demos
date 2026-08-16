import { AvflowError, getJob, stopJob } from '@/lib/avflow/client';
import { errorResponse } from '@/lib/http';

type Params = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const job = await getJob(name);
    return Response.json({
      name,
      status: job.status ?? 'unknown',
      error: job.error,
      componentStatus: job.componentStatus,
      usage: job.usage,
      updatedAt: job.updatedAt,
    });
  } catch (err) {
    // A job that was never submitted, or already reaped, is a normal state for
    // the UI rather than an error.
    if (err instanceof AvflowError && err.status === 404) {
      return Response.json({ name, status: 'absent' });
    }
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { name } = await params;
  try {
    const job = await stopJob(name);
    return Response.json({ name, status: job.status ?? 'stopping' });
  } catch (err) {
    if (err instanceof AvflowError && err.status === 404) {
      return Response.json({ name, status: 'absent' });
    }
    return errorResponse(err);
  }
}
