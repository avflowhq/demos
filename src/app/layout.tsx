import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: 'AVFlow demos',
  description:
    'Runnable AVFlow demos: meeting recording with AI notes, a vertical co-host switcher, a captioned voice room, live interpretation, and an AI voice agent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
          <div className="page-shell flex h-16 items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              AVFlow <span className="text-muted">demos</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm text-muted">
              <a className="hover:text-body" href="https://avflow.dev/use-cases/">
                Use cases
              </a>
              <a className="hover:text-body" href="https://avflow.dev/introduction/">
                Docs
              </a>
              <a className="hover:text-body" href="https://console.avflow.dev">
                Console
              </a>
            </nav>
          </div>
        </header>
        <main className="page-shell py-10">{children}</main>
        <footer className="border-t border-line py-8 text-sm text-muted">
          <div className="page-shell">
            Built on <a className="text-accent hover:underline" href="https://avflow.dev">AVFlow</a>.
            Demo code, not production code — read the security notes in the README before deploying.
          </div>
        </footer>
      </body>
    </html>
  );
}
