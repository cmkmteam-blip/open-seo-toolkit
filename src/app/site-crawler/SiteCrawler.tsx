'use client';

import { useRef, useState } from 'react';
import { Download, Loader2, Search, Square } from 'lucide-react';
import { CtaCard } from '@/components/CtaCard';
import { ToolHeader } from '@/components/ui';
import { downloadText } from '@/lib/csv';
import type { BrokenLink, CrawlEvent, CrawlSummary, PageReport } from '@/lib/crawler/crawl';
import { brokenLinksToCsv, pagesToCsv } from '@/lib/crawler/report';
import { TOOLS } from '@/lib/tools';

const tool = TOOLS.find((t) => t.slug === 'site-crawler')!;

type Filter = 'all' | 'issues' | 'title' | 'meta' | 'h1' | 'alt' | 'errors';
const FILTERS: { id: Filter; label: string; test: (p: PageReport) => boolean }[] = [
  { id: 'all', label: 'All pages', test: () => true },
  { id: 'issues', label: 'With issues', test: (p) => p.issues.length > 0 },
  { id: 'title', label: 'Title', test: (p) => p.issues.some((i) => i.includes('title') || i.includes('Title')) },
  { id: 'meta', label: 'Meta description', test: (p) => p.issues.some((i) => i.includes('eta description')) },
  { id: 'h1', label: 'H1', test: (p) => p.issues.some((i) => i.includes('H1')) },
  { id: 'alt', label: 'Alt text', test: (p) => p.imagesMissingAlt > 0 },
  { id: 'errors', label: 'Errors (4xx/5xx)', test: (p) => p.status === 0 || p.status >= 400 },
];

const STOP_REASONS: Record<CrawlSummary['stoppedReason'], string> = {
  done: 'Crawl complete: every page found was checked.',
  'page-limit': 'Stopped at the page limit. Raise it to crawl more.',
  'time-limit': 'Stopped at the server time limit. Results so far are below.',
  aborted: 'Crawl stopped.',
};

export function SiteCrawler({ maxPagesLimit, minDelayMs }: { maxPagesLimit: number; minDelayMs: number }) {
  const [url, setUrl] = useState('');
  const [maxPages, setMaxPages] = useState(Math.min(50, maxPagesLimit));
  const [delayMs, setDelayMs] = useState(Math.max(1000, minDelayMs));
  const [respectRobots, setRespectRobots] = useState(true);
  const [checkExternal, setCheckExternal] = useState(false);

  const [running, setRunning] = useState(false);
  const [pages, setPages] = useState<PageReport[]>([]);
  const [broken, setBroken] = useState<BrokenLink[]>([]);
  const [summary, setSummary] = useState<CrawlSummary | null>(null);
  const [effectiveDelay, setEffectiveDelay] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const abortRef = useRef<AbortController | null>(null);

  const start = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setPages([]);
    setBroken([]);
    setSummary(null);
    setError('');
    setEffectiveDelay(null);

    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, maxPages, delayMs, respectRobots, checkExternal }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (HTTP ${res.status})`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as CrawlEvent;
          if (event.type === 'start') setEffectiveDelay(event.delayMs);
          else if (event.type === 'page') setPages((prev) => [...prev, event.page]);
          else if (event.type === 'done') {
            setSummary(event.summary);
            setBroken(event.brokenLinks);
          } else if (event.type === 'error') setError(event.message);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'The crawl failed.');
    } finally {
      setRunning(false);
    }
  };

  const shown = pages.filter(FILTERS.find((f) => f.id === filter)!.test);
  const live = summaryFromPages(pages);
  const stats = [
    { label: 'Pages crawled', value: pages.length },
    { label: 'Missing title', value: live.missingTitles, bad: true },
    { label: 'Missing meta description', value: live.missingMeta, bad: true },
    { label: 'Missing H1', value: live.missingH1, bad: true },
    { label: 'Images without alt', value: live.imagesMissingAlt, bad: true },
    { label: 'Broken links', value: summary ? summary.brokenLinks : live.errors, bad: true },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolHeader title={tool.name} description={tool.description} />

      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !running) start();
        }}
      >
        <label className="label" htmlFor="url">Website URL</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="url" className="field font-mono" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} disabled={running} />
          {running ? (
            <button type="button" className="btn-ghost shrink-0" onClick={() => abortRef.current?.abort()}>
              <Square className="h-4 w-4" aria-hidden /> Stop
            </button>
          ) : (
            <button type="submit" className="btn-primary shrink-0" disabled={!url.trim()}>
              <Search className="h-4 w-4" aria-hidden /> Start crawl
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <label className="label" htmlFor="max">Max pages (up to {maxPagesLimit})</label>
            <input id="max" type="number" min={1} max={maxPagesLimit} className="field w-28" value={maxPages} disabled={running}
              onChange={(e) => setMaxPages(Math.min(maxPagesLimit, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className="label" htmlFor="delay">Delay between requests (ms)</label>
            <input id="delay" type="number" min={minDelayMs} max={10000} step={100} className="field w-28" value={delayMs} disabled={running}
              onChange={(e) => setDelayMs(Math.min(10000, Math.max(minDelayMs, Number(e.target.value) || minDelayMs)))} />
          </div>
          <div className="flex flex-col justify-end gap-1.5 pb-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-accent" checked={respectRobots} disabled={running} onChange={(e) => setRespectRobots(e.target.checked)} />
              Respect robots.txt
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-accent" checked={checkExternal} disabled={running} onChange={(e) => setCheckExternal(e.target.checked)} />
              Also check external links (first 50)
            </label>
          </div>
        </div>
        <p className="hint mt-3">
          The crawl runs on this deployment&apos;s server, one request at a time, and only follows links on the same site. Only crawl sites you own or have permission to audit.
        </p>
      </form>

      {error && <p className="mt-4 rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm text-bad">{error}</p>}

      {(running || pages.length > 0) && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-card p-4">
                <p className={`font-display text-2xl font-bold ${s.bad && s.value > 0 ? 'text-accent' : ''}`}>{s.value.toLocaleString('en')}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="flex items-center gap-2 text-muted">
              {running && <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />}
              {running
                ? `Crawling… ${pages.length} of up to ${maxPages} pages${effectiveDelay ? `, ${effectiveDelay} ms apart` : ''}`
                : summary
                  ? STOP_REASONS[summary.stoppedReason] + (summary.skippedByRobots ? ` ${summary.skippedByRobots} URL(s) skipped because robots.txt disallows them.` : '')
                  : 'Crawl stopped.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" disabled={pages.length === 0} onClick={() => downloadText('crawl-pages.csv', pagesToCsv(pages))}>
                <Download className="h-4 w-4" aria-hidden /> Pages CSV
              </button>
              <button type="button" className="btn-ghost" disabled={broken.length === 0} onClick={() => downloadText('crawl-broken-links.csv', brokenLinksToCsv(broken))}>
                <Download className="h-4 w-4" aria-hidden /> Broken links CSV
              </button>
            </div>
          </div>

          <div className="panel mt-4 !p-0">
            <div className="flex flex-wrap gap-1 border-b border-line p-3">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f.id ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink'}`}>
                  {f.label} ({pages.filter(f.test).length})
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2 font-medium">URL</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Meta</th>
                    <th className="px-3 py-2 font-medium">H1</th>
                    <th className="px-3 py-2 font-medium">No alt</th>
                    <th className="px-3 py-2 font-medium">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.url} className="border-b border-line/60 align-top last:border-0">
                      <td className="max-w-xs px-3 py-2">
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-mono text-xs hover:text-accent">{p.url}</a>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                      <td className="max-w-xs px-3 py-2">
                        {p.title ? <span>{p.title} <span className="text-xs text-muted">({p.title.length})</span></span> : <span className="text-muted">–</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{p.metaDescription ? `${p.metaDescription.length} chars` : '–'}</td>
                      <td className="px-3 py-2">{p.h1Count}</td>
                      <td className="px-3 py-2">{p.imagesMissingAlt || ''}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {p.issues.map((i) => (
                            <span key={i} className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent-dark">{i}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No pages match this filter.</p>}
            </div>
          </div>

          {broken.length > 0 && (
            <div className="panel mt-6">
              <h2 className="text-lg font-bold">Broken links ({broken.length})</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {broken.map((b) => (
                  <li key={b.url}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-muted">{b.internal ? 'internal' : 'external'}</span>
                      <span className="break-all font-mono text-xs">{b.url}</span>
                    </div>
                    {b.foundOn.length > 0 && (
                      <p className="mt-1 break-all text-xs text-muted">
                        Linked from: {b.foundOn.slice(0, 5).join(', ')}{b.foundOn.length > 5 ? ` and ${b.foundOn.length - 5} more` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {summary && pages.length > 0 && (
        <CtaCard
          tool="site-crawler"
          title={`Crawled ${pages.length} pages. Want pages for the keywords you don't rank for yet?`}
          body="pSEO Wizard generates new landing pages at scale, each with a title under 60 characters, a meta description, one H1 and schema markup."
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const cls = status >= 200 && status < 300 ? 'bg-good/10 text-good' : status >= 300 && status < 400 ? 'bg-warn/10 text-warn' : 'bg-bad/10 text-bad';
  return <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${cls}`}>{status === 0 ? 'ERR' : status}</span>;
}

function summaryFromPages(pages: PageReport[]) {
  const ok = pages.filter((p) => p.status >= 200 && p.status < 400 && p.contentType.includes('html'));
  return {
    missingTitles: ok.filter((p) => !p.title).length,
    missingMeta: ok.filter((p) => !p.metaDescription).length,
    missingH1: ok.filter((p) => p.h1Count === 0).length,
    imagesMissingAlt: ok.reduce((n, p) => n + p.imagesMissingAlt, 0),
    errors: pages.filter((p) => p.status === 0 || p.status >= 400).length,
  };
}
