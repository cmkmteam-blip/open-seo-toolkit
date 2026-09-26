import { analyzeHtml, pageIssues, sameSite } from './analyze';
import { ALLOW_ALL, parseRobots, type Robots } from './robots';
import { safeFetch, type FetchResult } from './safe-fetch';

export interface PageReport {
  url: string;
  status: number;
  redirectedTo?: string;
  contentType: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  h1: string;
  canonical: string;
  noindex: boolean;
  images: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  bytes: number;
  ms: number;
  issues: string[];
}

export interface BrokenLink {
  url: string;
  /** 0 = network error / timeout. */
  status: number;
  internal: boolean;
  foundOn: string[];
}

export interface CrawlSummary {
  pagesCrawled: number;
  missingTitles: number;
  missingMeta: number;
  missingH1: number;
  imagesMissingAlt: number;
  brokenLinks: number;
  skippedByRobots: number;
  stoppedReason: 'done' | 'page-limit' | 'time-limit' | 'aborted';
}

export type CrawlEvent =
  | { type: 'start'; url: string; maxPages: number; delayMs: number }
  | { type: 'page'; page: PageReport }
  | { type: 'done'; summary: CrawlSummary; brokenLinks: BrokenLink[] }
  | { type: 'error'; message: string };

export interface CrawlOptions {
  startUrl: string;
  maxPages: number;
  /** Politeness delay between requests to the site (robots.txt Crawl-delay wins if larger, capped at 10 s). */
  delayMs: number;
  respectRobots?: boolean;
  /** Also check up to `maxExternalChecks` external links (HEAD, falling back to GET). */
  checkExternal?: boolean;
  maxExternalChecks?: number;
  /** Stop gracefully after this many ms (keeps under serverless time limits). */
  timeBudgetMs?: number;
  signal?: AbortSignal;
  /** Injected for tests. */
  fetcher?: (url: string, opts?: { method?: 'GET' | 'HEAD'; asText?: boolean }) => Promise<FetchResult>;
  sleep?: (ms: number) => Promise<void>;
}

const NON_HTML_EXT = /\.(jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|gz|rar|7z|mp3|mp4|webm|mov|avi|woff2?|ttf|eot|css|js|json|xml|txt|csv|xlsx?|docx?|pptx?)$/i;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function* crawl(opts: CrawlOptions): AsyncGenerator<CrawlEvent> {
  const fetcher = opts.fetcher ?? safeFetch;
  const sleep = opts.sleep ?? defaultSleep;
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? Infinity;

  let start: URL;
  try {
    start = new URL(/^https?:\/\//i.test(opts.startUrl) ? opts.startUrl : `https://${opts.startUrl}`);
  } catch {
    yield { type: 'error', message: 'Please enter a valid URL.' };
    return;
  }

  let robots: Robots = ALLOW_ALL;
  if (opts.respectRobots !== false) {
    const res = await fetcher(new URL('/robots.txt', start).href, { asText: true }).catch(() => null);
    if (res && res.status === 200 && res.body) robots = parseRobots(res.body);
  }
  const delayMs = Math.min(Math.max(opts.delayMs, robots.crawlDelayMs ?? 0), 10_000);
  yield { type: 'start', url: start.href, maxPages: opts.maxPages, delayMs };

  const queue: string[] = [start.href];
  const queued = new Set(queue);
  const crawled = new Set<string>();
  const referrers = new Map<string, Set<string>>();
  const externalRefs = new Map<string, Set<string>>();
  const broken: BrokenLink[] = [];
  const summary: CrawlSummary = { pagesCrawled: 0, missingTitles: 0, missingMeta: 0, missingH1: 0, imagesMissingAlt: 0, brokenLinks: 0, skippedByRobots: 0, stoppedReason: 'done' };

  const addRef = (map: Map<string, Set<string>>, url: string, from: string) => {
    if (!map.has(url)) map.set(url, new Set());
    map.get(url)!.add(from);
  };

  let first = true;
  while (queue.length > 0) {
    if (opts.signal?.aborted) { summary.stoppedReason = 'aborted'; break; }
    if (summary.pagesCrawled >= opts.maxPages) { summary.stoppedReason = 'page-limit'; break; }
    if (Date.now() - started > budget) { summary.stoppedReason = 'time-limit'; break; }

    const url = queue.shift()!;
    const u = new URL(url);
    if (!robots.isAllowed(u.pathname + u.search)) {
      summary.skippedByRobots++;
      continue;
    }

    if (!first) await sleep(delayMs);
    first = false;

    let res: FetchResult;
    try {
      res = await fetcher(url, { method: NON_HTML_EXT.test(u.pathname) ? 'HEAD' : 'GET' });
    } catch (err) {
      if (url === start.href) {
        yield { type: 'error', message: err instanceof Error ? err.message : 'Could not fetch this URL.' };
        return;
      }
      continue;
    }
    summary.pagesCrawled++;

    if (res.status === 0 || res.status >= 400) {
      broken.push({ url, status: res.status, internal: true, foundOn: [...(referrers.get(url) ?? [])] });
    }

    const redirectedTo = res.url !== url ? res.url : undefined;
    if (redirectedTo) {
      // Don't crawl the redirect target a second time.
      const pending = queue.indexOf(redirectedTo);
      if (pending >= 0) queue.splice(pending, 1);
      const alreadyCrawled = crawled.has(redirectedTo);
      crawled.add(redirectedTo);
      queued.add(redirectedTo);
      if (alreadyCrawled) {
        yield { type: 'page', page: { ...emptyReport(url, res, redirectedTo), issues: ['Redirects to a crawled page'] } };
        continue;
      }
    }
    crawled.add(url);
    const isHtml = !!res.body && res.contentType.includes('html');
    // Only analyze pages that are on the site (a redirect may leave it).
    if (!isHtml || !sameSite(new URL(res.url), start)) {
      if (!NON_HTML_EXT.test(u.pathname) || res.status >= 400 || res.status === 0) {
        yield { type: 'page', page: emptyReport(url, res, redirectedTo) };
      }
      continue;
    }

    const a = analyzeHtml(res.body!, res.url);
    const issues = pageIssues(a, res.status);
    const page: PageReport = {
      url, status: res.status, redirectedTo, contentType: res.contentType,
      title: a.title, metaDescription: a.metaDescription, h1Count: a.h1Count, h1: a.h1,
      canonical: a.canonical, noindex: a.noindex, images: a.images, imagesMissingAlt: a.imagesMissingAlt,
      internalLinks: a.internalLinks.length, externalLinks: a.externalLinks.length,
      bytes: res.bytes, ms: res.ms, issues,
    };
    if (res.status < 400) {
      if (!a.title) summary.missingTitles++;
      if (!a.metaDescription) summary.missingMeta++;
      if (a.h1Count === 0) summary.missingH1++;
      summary.imagesMissingAlt += a.imagesMissingAlt;
    }
    yield { type: 'page', page };

    for (const link of a.internalLinks) {
      addRef(referrers, link, url);
      if (!queued.has(link)) {
        queued.add(link);
        queue.push(link);
      }
    }
    for (const link of a.externalLinks) addRef(externalRefs, link, url);
  }

  // Referrers found after a broken page was fetched.
  for (const b of broken) b.foundOn = [...(referrers.get(b.url) ?? [])];

  if (opts.checkExternal && summary.stoppedReason !== 'aborted') {
    const targets = [...externalRefs.keys()].slice(0, opts.maxExternalChecks ?? 50);
    for (let i = 0; i < targets.length; i += 4) {
      if (Date.now() - started > budget || opts.signal?.aborted) break;
      const batch = targets.slice(i, i + 4);
      const results = await Promise.all(batch.map((t) => checkExternal(fetcher, t)));
      results.forEach((status, j) => {
        if (status === 0 || status >= 400) broken.push({ url: batch[j], status, internal: false, foundOn: [...externalRefs.get(batch[j])!] });
      });
    }
  }

  summary.brokenLinks = broken.length;
  yield { type: 'done', summary, brokenLinks: broken };
}

/** HEAD first; some servers answer HEAD with 403/405, so retry those with GET. */
async function checkExternal(fetcher: NonNullable<CrawlOptions['fetcher']>, url: string): Promise<number> {
  try {
    const head = await fetcher(url, { method: 'HEAD' });
    if (head.status !== 0 && head.status !== 403 && head.status !== 405 && head.status !== 501) return head.status;
    return (await fetcher(url, { method: 'GET' })).status;
  } catch {
    // Blocked by SSRF rules (e.g. a link to a private host): not something we can check.
    return -1;
  }
}

function emptyReport(url: string, res: FetchResult, redirectedTo?: string): PageReport {
  return {
    url, status: res.status, redirectedTo, contentType: res.contentType,
    title: '', metaDescription: '', h1Count: 0, h1: '', canonical: '', noindex: false,
    images: 0, imagesMissingAlt: 0, internalLinks: 0, externalLinks: 0, bytes: res.bytes, ms: res.ms,
    issues: res.status === 0 ? ['Network error'] : res.status >= 400 ? [`HTTP ${res.status}`] : ['Not HTML'],
  };
}
