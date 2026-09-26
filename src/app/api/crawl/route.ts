import { crawl, type CrawlEvent } from '@/lib/crawler/crawl';
import { crawlLimits } from '@/lib/crawler/limits';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel Hobby allows up to 300 s with Fluid compute; the crawl stops itself ~20 s before this.
export const maxDuration = 300;

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`crawl:${ip}`, 5, 10 * 60_000)) {
    return Response.json({ error: 'Too many crawls from your address. Wait a few minutes.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const limits = crawlLimits();
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!url) return Response.json({ error: 'Enter a URL to crawl.' }, { status: 400 });

  const maxPages = clamp(Number(body?.maxPages) || 50, 1, limits.maxPages);
  const delayMs = clamp(Number(body?.delayMs) || limits.minDelayMs, limits.minDelayMs, 10_000);

  const encoder = new TextEncoder();
  const events = crawl({
    startUrl: url,
    maxPages,
    delayMs,
    respectRobots: body?.respectRobots !== false,
    checkExternal: body?.checkExternal === true,
    maxExternalChecks: 50,
    timeBudgetMs: (maxDuration - 20) * 1000,
    signal: request.signal,
  });

  // Newline-delimited JSON so the browser can show pages as they are crawled.
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(JSON.stringify(value satisfies CrawlEvent) + '\n'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The crawl failed.';
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message } satisfies CrawlEvent) + '\n'));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(n), min), max);
}
