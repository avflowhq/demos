import type { ReactNode } from 'react';

export const btn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

export const btnPrimary = `${btn} bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-500/20 hover:brightness-110`;

export const btnGhost = `${btn} border border-line bg-surface/60 text-body hover:border-slate-500`;

export const btnDanger = `${btn} border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20`;

export const inputClass =
  'w-full rounded-lg border border-line bg-ink-raised px-3 py-2 text-sm text-body outline-none placeholder:text-slate-500 focus:border-accent/60';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface/60 p-5 ${className}`}>{children}</div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const STATUS_TONE: Record<string, string> = {
  running: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  starting: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  pending: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  stopping: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  stopped: 'border-line bg-ink-raised text-muted',
  absent: 'border-line bg-ink-raised text-muted',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'border-line bg-ink-raised text-muted';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-ink-raised px-2.5 py-1 font-mono text-xs text-muted">
      {children}
    </span>
  );
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-ink p-4 font-mono text-xs leading-relaxed text-slate-300">
      {children}
    </pre>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn';
  title?: string;
  children: ReactNode;
}) {
  const styles =
    tone === 'warn'
      ? 'border-amber-500/30 bg-amber-500/5 text-amber-100'
      : 'border-sky-500/30 bg-sky-500/5 text-sky-100';
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${styles}`}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-slate-300">{children}</div>
    </div>
  );
}
