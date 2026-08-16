import { AvflowError } from '@/lib/avflow/client';

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * Surface AVFlow validation errors verbatim — they name the offending component
 * and rule, which is the most useful thing to show while learning the Job model.
 */
export function errorResponse(err: unknown) {
  if (err instanceof AvflowError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return Response.json({ error: message }, { status: 500 });
}

export function requiredString(value: unknown, field: string): string {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) throw new Error(`\`${field}\` is required`);
  return str;
}
