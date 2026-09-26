import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeHtml, pageIssues } from './analyze';
import { crawl, type CrawlEvent } from './crawl';
import { brokenLinksToCsv, pagesToCsv } from './report';
import { parseRobots } from './robots';
import { assertPublicUrl, BlockedUrlError, isPrivateIp, type FetchResult } from './safe-fetch';

const html = (body: string, head = '') => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

/** A fake site for crawl tests: path → [status, html]. */
function fakeSite(pages: Record<string, [number, string] | [number, string, string]>) {
  const requested: string[] = [];
  const fetcher = async (url: string, opts: { method?: 'GET' | 'HEAD' } = {}): Promise<FetchResult> => {
    requested.push(`${opts.method ?? 'GET'} ${url}`);
    const u = new URL(url);
    const page = pages[u.host === 'example.com' ? u.pathname : url];
    if (!page) return { url, status: 404, contentType: 'text/html', body: 'not found', bytes: 9, ms: 1, redirects: [] };
    const [status, body, contentType = 'text/html; charset=utf-8'] = page;
    return { url, status, contentType, body: opts.method === 'HEAD' ? undefined : body, bytes: body.length, ms: 1, redirects: [] };
  };
  return { fetcher, requested };
}

async function collect(gen: AsyncGenerator<CrawlEvent>): Promise<CrawlEvent[]> {
  const out: CrawlEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

test('analyzeHtml extracts SEO fields and classifies links', () => {
  const a = analyzeHtml(
    html(
      '<h1> Hello  world </h1><h1>Second</h1><img src="a.png"><img src="b.png" alt=""><img src="c.png" alt="c">' +
        '<a href="/about#team">About</a><a href="https://www.example.com/x">X</a><a href="https://other.com/">O</a><a href="mailto:a@b.c">mail</a>',
      '<title>My page</title><meta name="description" content="Desc"><meta name="robots" content="noindex,follow"><link rel="canonical" href="/canon">',
    ),
    'https://example.com/page',
  );
  assert.equal(a.title, 'My page');
  assert.equal(a.metaDescription, 'Desc');
  assert.equal(a.h1Count, 2);
  assert.equal(a.h1, 'Hello world');
  assert.equal(a.canonical, 'https://example.com/canon');
  assert.equal(a.noindex, true);
  assert.equal(a.images, 3);
  assert.equal(a.imagesMissingAlt, 1, 'alt="" is valid for decorative images');
  assert.deepEqual(a.internalLinks, ['https://example.com/about', 'https://www.example.com/x']);
  assert.deepEqual(a.externalLinks, ['https://other.com/']);
  assert.deepEqual(pageIssues(a, 200), ['2 H1 tags', '1 image without alt', 'noindex']);
});

test('pageIssues reports missing title, meta and H1', () => {
  const a = analyzeHtml(html('<p>nothing</p>'), 'https://example.com/');
  assert.deepEqual(pageIssues(a, 200), ['Missing title', 'Missing meta description', 'Missing H1']);
});

test('robots.txt: specific group, longest match, wildcards, crawl-delay', () => {
  const r = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$\nCrawl-delay: 2');
  assert.equal(r.isAllowed('/'), true);
  assert.equal(r.isAllowed('/private/x'), false);
  assert.equal(r.isAllowed('/private/public/page'), true);
  assert.equal(r.isAllowed('/files/a.pdf'), false);
  assert.equal(r.isAllowed('/files/a.pdf?x=1'), true);
  assert.equal(r.crawlDelayMs, 2000);
  assert.equal(parseRobots('User-agent: *\nDisallow:').isAllowed('/anything'), true);
  assert.equal(parseRobots('User-agent: OpenSEOToolkit\nDisallow: /').isAllowed('/a'), false);
});

test('SSRF guard blocks private addresses and odd URLs', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.20.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  assert.equal(isPrivateIp('93.184.216.34'), false);
  for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/latest', 'ftp://example.com/', 'https://user:pw@example.com/', 'https://example.com:8080/']) {
    await assert.rejects(assertPublicUrl(new URL(url)), BlockedUrlError, url);
  }
});

test('crawl follows internal links, reports broken links with referrers and respects limits', async () => {
  const { fetcher, requested } = fakeSite({
    '/robots.txt': [200, 'User-agent: *\nDisallow: /secret', 'text/plain'],
    '/': [200, html('<h1>Home</h1><a href="/a">A</a><a href="/secret">S</a><a href="/missing">M</a><a href="https://ext.com/">E</a>', '<title>Home</title><meta name="description" content="d">')],
    '/a': [200, html('<a href="/">home</a><img src="x.png">', '<title>A</title>')],
    'https://ext.com/': [500, 'err'],
  });
  const sleeps: number[] = [];
  const events = await collect(crawl({ startUrl: 'example.com', maxPages: 10, delayMs: 100, checkExternal: true, fetcher, sleep: async (ms) => { sleeps.push(ms); } }));

  const pages = events.filter((e) => e.type === 'page').map((e) => (e as Extract<CrawlEvent, { type: 'page' }>).page);
  assert.deepEqual(pages.map((p) => p.url), ['https://example.com/', 'https://example.com/a', 'https://example.com/missing']);
  assert.ok(!requested.some((r) => r.includes('/secret')), 'robots.txt disallowed URL was fetched');
  assert.deepEqual(sleeps, [100, 100], 'politeness delay between site requests');

  const done = events.at(-1) as Extract<CrawlEvent, { type: 'done' }>;
  assert.equal(done.type, 'done');
  assert.equal(done.summary.pagesCrawled, 3);
  assert.equal(done.summary.skippedByRobots, 1);
  assert.equal(done.summary.missingMeta, 1);
  assert.equal(done.summary.missingH1, 1);
  assert.equal(done.summary.imagesMissingAlt, 1);
  assert.deepEqual(done.brokenLinks.map((b) => [b.url, b.status, b.internal, b.foundOn]), [
    ['https://example.com/missing', 404, true, ['https://example.com/']],
    ['https://ext.com/', 500, false, ['https://example.com/']],
  ]);

  const limited = await collect(crawl({ startUrl: 'https://example.com/', maxPages: 1, delayMs: 0, fetcher, sleep: async () => {} }));
  const end = limited.at(-1) as Extract<CrawlEvent, { type: 'done' }>;
  assert.equal(end.summary.pagesCrawled, 1);
  assert.equal(end.summary.stoppedReason, 'page-limit');
});

test('a redirect target is not crawled twice', async () => {
  const { fetcher: base } = fakeSite({
    '/en': [200, html('<h1>EN</h1><a href="/en">self</a><a href="/">root</a><a href="/b">b</a>', '<title>EN</title>')],
    '/b': [200, html('<h1>B</h1><a href="/en">en</a>', '<title>B</title>')],
  });
  const requested: string[] = [];
  const fetcher = async (url: string, opts?: { method?: 'GET' | 'HEAD'; asText?: boolean }) => {
    requested.push(url);
    const res = await base(new URL(url).pathname === '/' ? 'https://example.com/en' : url, opts);
    return new URL(url).pathname === '/' ? { ...res, redirects: [url] } : res;
  };
  const events = await collect(crawl({ startUrl: 'https://example.com/', maxPages: 10, delayMs: 0, respectRobots: false, fetcher, sleep: async () => {} }));
  const pages = events.filter((e) => e.type === 'page').map((e) => (e as Extract<CrawlEvent, { type: 'page' }>).page);
  assert.deepEqual(pages.map((p) => [p.url, p.redirectedTo]), [['https://example.com/', 'https://example.com/en'], ['https://example.com/b', undefined]]);
  assert.deepEqual(requested, ['https://example.com/', 'https://example.com/b']);
});

test('robots.txt crawl-delay raises the politeness delay', async () => {
  const { fetcher } = fakeSite({
    '/robots.txt': [200, 'User-agent: *\nCrawl-delay: 3', 'text/plain'],
    '/': [200, html('<a href="/b">b</a>')],
    '/b': [200, html('')],
  });
  const sleeps: number[] = [];
  const events = await collect(crawl({ startUrl: 'https://example.com/', maxPages: 5, delayMs: 500, fetcher, sleep: async (ms) => { sleeps.push(ms); } }));
  assert.equal((events[0] as Extract<CrawlEvent, { type: 'start' }>).delayMs, 3000);
  assert.deepEqual(sleeps, [3000]);
});

test('CSV exports contain one header plus exactly one row per record, nothing else', async () => {
  const { fetcher } = fakeSite({
    '/': [200, html('<h1>H</h1><a href="/x">x</a><a href="/gone">g</a>', '<title>T, with "quotes"</title>')],
    '/x': [200, html('<h1>X</h1>')],
  });
  const events = await collect(crawl({ startUrl: 'https://example.com/', maxPages: 10, delayMs: 0, fetcher, sleep: async () => {} }));
  const pages = events.filter((e) => e.type === 'page').map((e) => (e as Extract<CrawlEvent, { type: 'page' }>).page);
  const done = events.at(-1) as Extract<CrawlEvent, { type: 'done' }>;

  const csv = pagesToCsv(pages);
  const rows = csv.trimEnd().split('\r\n');
  assert.equal(rows.length, pages.length + 1);
  assert.ok(rows[0].startsWith('URL,Status'));
  assert.ok(rows[1].includes('"T, with ""quotes"""'));
  assert.ok(!/wizard|pseo|utm_|sponsored|powered by/i.test(csv));

  const broken = brokenLinksToCsv(done.brokenLinks).trimEnd().split('\r\n');
  assert.equal(broken.length, done.brokenLinks.length + 1);
  assert.equal(broken[1], 'https://example.com/gone,404,internal,https://example.com/');
});
