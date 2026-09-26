import Link from 'next/link';
import { ArrowRight, Globe2, Link2, Search, Shuffle } from 'lucide-react';
import { TOOLS } from '@/lib/tools';

const ICONS = { 'keyword-mixer': Shuffle, 'slug-generator': Link2, 'hreflang-generator': Globe2, 'site-crawler': Search } as const;

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Free · Open source · Self-hosted</p>
        <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">Free SEO tools you can run on your own Next.js deployment</h1>
        <p className="mt-4 text-lg text-muted">
          Mix keywords, generate slugs in any language, build hreflang tags and crawl your site for SEO issues. No sign-up, no API keys and no tracking.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => {
          const Icon = ICONS[t.slug as keyof typeof ICONS];
          return (
            <Link key={t.slug} href={`/${t.slug}`} className="group panel transition-colors hover:border-ink/30">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="flex items-center gap-1 text-lg font-bold">
                    {t.name}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </h2>
                  <p className="mt-1 text-sm text-muted">{t.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
