import type { Metadata } from 'next';
import { crawlLimits } from '@/lib/crawler/limits';
import { SiteCrawler } from './SiteCrawler';

export const metadata: Metadata = {
  title: 'Site Crawler: find SEO issues and broken links',
  description: 'Free self-hosted SEO crawler. Finds missing titles, meta descriptions, H1s, image alt text and broken links. CSV export.',
};

export const dynamic = 'force-dynamic';

export default function Page() {
  const { maxPages, minDelayMs } = crawlLimits();
  return <SiteCrawler maxPagesLimit={maxPages} minDelayMs={minDelayMs} />;
}
