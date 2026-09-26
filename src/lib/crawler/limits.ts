/** Crawl limits for this deployment. Override with CRAWL_MAX_PAGES / CRAWL_MIN_DELAY_MS. */
export function crawlLimits(): { maxPages: number; minDelayMs: number } {
  const maxPages = Number(process.env.CRAWL_MAX_PAGES) || 100;
  const minDelayMs = Number(process.env.CRAWL_MIN_DELAY_MS);
  return {
    maxPages: Math.min(Math.max(maxPages, 1), 2000),
    minDelayMs: Number.isFinite(minDelayMs) && process.env.CRAWL_MIN_DELAY_MS ? Math.max(minDelayMs, 0) : 500,
  };
}
