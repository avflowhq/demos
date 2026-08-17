import 'server-only';

/**
 * Findings the moderation server has posted, newest first.
 *
 * In memory and per process, which is the honest shape for a demo: the real
 * version of this is a queue, and the UI reads from whatever the consumer wrote
 * to. Restarting the dev server clears it.
 */

export type Finding = {
  identity: string;
  at: string;
  verdict: 'ok' | 'review' | 'violation';
  reason: string;
  text?: string;
  seconds?: number;
  level?: number;
};

const MAX = 50;
const findings: Finding[] = [];

function verdictOf(value: unknown): Finding['verdict'] {
  return value === 'violation' || value === 'review' ? value : 'ok';
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function recordFinding(raw: Record<string, unknown>): void {
  findings.unshift({
    identity: str(raw.identity) ?? 'unknown',
    at: str(raw.at) ?? new Date().toISOString(),
    verdict: verdictOf(raw.verdict),
    reason: str(raw.reason) ?? '',
    text: str(raw.text),
    seconds: num(raw.seconds),
    level: num(raw.level),
  });
  findings.length = Math.min(findings.length, MAX);
}

export function recentFindings(): Finding[] {
  return findings;
}
