import { toCsv } from '../csv';
import type { BrokenLink, PageReport } from './crawl';

export const PAGE_CSV_HEADER = [
  'URL', 'Status', 'Redirected to', 'Title', 'Title length', 'Meta description', 'Meta description length',
  'H1 count', 'H1', 'Canonical', 'Noindex', 'Images', 'Images without alt', 'Internal links', 'External links',
  'Size (KB)', 'Response time (ms)', 'Issues',
];

/** One header row, then exactly one row per crawled page. */
export function pagesToCsv(pages: PageReport[]): string {
  return toCsv(PAGE_CSV_HEADER, pages.map((p) => [
    p.url, p.status, p.redirectedTo ?? '', p.title, p.title.length, p.metaDescription, p.metaDescription.length,
    p.h1Count, p.h1, p.canonical, p.noindex ? 'yes' : 'no', p.images, p.imagesMissingAlt, p.internalLinks, p.externalLinks,
    Math.round(p.bytes / 102.4) / 10, p.ms, p.issues.join('; '),
  ]));
}

export const BROKEN_CSV_HEADER = ['Broken URL', 'Status', 'Type', 'Found on'];

/** One header row, then exactly one row per broken link. */
export function brokenLinksToCsv(links: BrokenLink[]): string {
  return toCsv(BROKEN_CSV_HEADER, links.map((l) => [
    l.url, l.status === 0 ? 'network error' : l.status, l.internal ? 'internal' : 'external', l.foundOn.join(' '),
  ]));
}
