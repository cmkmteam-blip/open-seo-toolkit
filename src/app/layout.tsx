import type { Metadata } from 'next';
import Link from 'next/link';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import { ConsoleHello } from '@/components/ConsoleHello';
import { promoUrl } from '@/lib/promo';
import { TOOLS } from '@/lib/tools';
import './globals.css';

const body = Geist({ subsets: ['latin'], variable: '--font-body' });
const heading = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading' });
const code = Geist_Mono({ subsets: ['latin'], variable: '--font-code' });

export const metadata: Metadata = {
  title: { default: 'Open SEO Toolkit: free open-source SEO tools', template: '%s | Open SEO Toolkit' },
  description: 'Free, self-hosted SEO tools: keyword mixer, bulk slug generator, hreflang generator and site crawler. No API keys, no tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} ${code.variable}`}>
      <body>
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-ink text-sm text-paper">◆</span>
              Open SEO Toolkit
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {TOOLS.map((t) => (
                <Link key={t.slug} href={`/${t.slug}`} className="hover:text-ink">{t.name}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>Open SEO Toolkit is free and open source (MIT). No tracking, no accounts.</p>
            <p>
              Built by{' '}
              <a href={promoUrl('footer')} target="_blank" rel="noopener" className="font-semibold text-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent">
                pSEO Wizard
              </a>
            </p>
          </div>
        </footer>
        <ConsoleHello />
      </body>
    </html>
  );
}
