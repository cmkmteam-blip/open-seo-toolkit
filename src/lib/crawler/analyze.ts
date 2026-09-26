import * as cheerio from 'cheerio';

export interface HtmlAnalysis {
  title: string;
  metaDescription: string;
  h1Count: number;
  h1: string;
  canonical: string;
  noindex: boolean;
  images: number;
  /** <img> without an alt attribute. `alt=""` is valid for decorative images and isn't counted. */
  imagesMissingAlt: number;
  internalLinks: string[];
  externalLinks: string[];
}

const SKIP_SCHEMES = /^(mailto|tel|javascript|data|sms|ftp|file):/i;

/** Treats `www.example.com` and `example.com` as the same site. */
export function sameSite(a: URL, b: URL): boolean {
  return a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '');
}

/** Normalizes a link for de-duplication: drops the #fragment and default ports. */
export function normalizeUrl(href: string, base: string): string | null {
  if (!href || SKIP_SCHEMES.test(href.trim())) return null;
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

export function analyzeHtml(html: string, pageUrl: string): HtmlAnalysis {
  const $ = cheerio.load(html);
  const page = new URL(pageUrl);
  const baseHref = $('base[href]').attr('href');
  const base = baseHref ? normalizeUrl(baseHref, pageUrl) ?? pageUrl : pageUrl;

  const internal = new Set<string>();
  const external = new Set<string>();
  $('a[href]').each((_, el) => {
    const url = normalizeUrl($(el).attr('href') ?? '', base);
    if (!url) return;
    (sameSite(new URL(url), page) ? internal : external).add(url);
  });

  const robots = $('meta[name="robots" i], meta[name="googlebot" i]').map((_, el) => $(el).attr('content') ?? '').get().join(',');
  const h1s = $('h1');
  const images = $('img');

  return {
    title: clean($('head title').first().text() || $('title').first().text()),
    metaDescription: clean($('meta[name="description" i]').attr('content') ?? ''),
    h1Count: h1s.length,
    h1: clean(h1s.first().text()),
    canonical: normalizeUrl($('link[rel="canonical" i]').attr('href') ?? '', base) ?? '',
    noindex: /noindex/i.test(robots),
    images: images.length,
    imagesMissingAlt: images.filter((_, el) => $(el).attr('alt') === undefined).length,
    internalLinks: [...internal],
    externalLinks: [...external],
  };
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export const TITLE_MAX = 60;
export const META_MAX = 160;

/** SEO issues for one crawled HTML page. */
export function pageIssues(a: HtmlAnalysis, status: number): string[] {
  const issues: string[] = [];
  if (status >= 400) issues.push(`HTTP ${status}`);
  if (!a.title) issues.push('Missing title');
  else if (a.title.length > TITLE_MAX) issues.push(`Title over ${TITLE_MAX} chars`);
  if (!a.metaDescription) issues.push('Missing meta description');
  else if (a.metaDescription.length > META_MAX) issues.push(`Meta description over ${META_MAX} chars`);
  if (a.h1Count === 0) issues.push('Missing H1');
  else if (a.h1Count > 1) issues.push(`${a.h1Count} H1 tags`);
  if (a.imagesMissingAlt > 0) issues.push(`${a.imagesMissingAlt} image${a.imagesMissingAlt > 1 ? 's' : ''} without alt`);
  if (a.noindex) issues.push('noindex');
  return issues;
}
