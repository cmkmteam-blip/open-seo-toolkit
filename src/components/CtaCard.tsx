import { ArrowRight } from 'lucide-react';
import { promoUrl, type ToolId } from '@/lib/promo';

/** A clearly labelled promotion shown under a tool's result. Never part of the result itself. */
export function CtaCard({ tool, title, body, cta = 'Try pSEO Wizard' }: { tool: ToolId; title: string; body: string; cta?: string }) {
  return (
    <aside aria-label="From the makers of this toolkit" className="mt-8 rounded-2xl border border-accent/25 bg-accent-soft p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">From the makers of this toolkit</p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{body}</p>
        </div>
        <a href={promoUrl(tool)} target="_blank" rel="noopener" className="btn-accent shrink-0">
          {cta} <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </div>
    </aside>
  );
}
