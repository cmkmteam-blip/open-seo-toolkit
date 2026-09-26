export interface HreflangEntry {
  /** Language, optionally with region: `en`, `en-GB`, `pt-BR`, `zh-Hant`. */
  code: string;
  url: string;
}

export type HreflangFormat = 'html' | 'xml' | 'header';

export const COMMON_LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'zh-Hant', name: 'Chinese (Traditional)' },
];

// ISO 3166 codes people often get wrong.
const REGION_FIXES: Record<string, string> = { UK: 'GB', EN: '', EU: '' };

/** Normalizes case (`EN-gb` → `en-GB`, `zh-hant` → `zh-Hant`). Returns null if it isn't a valid hreflang value. */
export function normalizeCode(raw: string): string | null {
  const code = raw.trim().replace(/_/g, '-');
  if (code.toLowerCase() === 'x-default') return 'x-default';
  const m = /^([a-zA-Z]{2,3})(?:-([a-zA-Z]{4}))?(?:-([a-zA-Z]{2}|\d{3}))?$/.exec(code);
  if (!m) return null;
  const [, lang, script, region] = m;
  let out = lang.toLowerCase();
  if (script) out += '-' + script[0].toUpperCase() + script.slice(1).toLowerCase();
  if (region) out += '-' + region.toUpperCase();
  return out;
}

/** Human-readable problems with a set of entries. Empty array = valid. */
export function validateEntries(entries: HreflangEntry[], xDefaultUrl?: string): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const { code, url } of entries) {
    const norm = normalizeCode(code);
    if (!norm) {
      problems.push(`"${code}" is not a valid language code (use ISO 639-1, e.g. "en" or "en-GB").`);
      continue;
    }
    const region = norm.split('-').find((p) => p.length === 2 && p === p.toUpperCase());
    if (region && region in REGION_FIXES) {
      problems.push(REGION_FIXES[region] ? `"${norm}": use "${norm.replace(region, REGION_FIXES[region])}" ("${region}" isn't an ISO 3166 region).` : `"${norm}": "${region}" isn't a valid region code.`);
    }
    if (seen.has(norm)) problems.push(`"${norm}" is listed twice.`);
    seen.add(norm);
    if (!isAbsoluteUrl(url)) problems.push(`"${norm}": the URL must be absolute (https://…).`);
  }
  if (xDefaultUrl && !isAbsoluteUrl(xDefaultUrl)) problems.push('x-default: the URL must be absolute (https://…).');
  return problems;
}

function isAbsoluteUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Fills a URL pattern: `https://example.com/{lang}/pricing`. `{lang}` is the lowercase code (`en-gb`), `{LANG}` keeps case. */
export function urlFromPattern(pattern: string, code: string): string {
  return pattern.replaceAll('{lang}', code.toLowerCase()).replaceAll('{LANG}', code);
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Builds the hreflang markup. The output contains ONLY the tags the user asked for:
 * no comments, no credits, no extra whitespace lines.
 */
export function buildHreflang(entries: HreflangEntry[], format: HreflangFormat, xDefaultUrl?: string): string {
  const all = entries
    .map((e) => ({ code: normalizeCode(e.code), url: e.url.trim() }))
    .filter((e): e is { code: string; url: string } => !!e.code && !!e.url && e.code !== 'x-default');
  if (xDefaultUrl?.trim()) all.push({ code: 'x-default', url: xDefaultUrl.trim() });
  if (all.length === 0) return '';

  if (format === 'html') {
    return all.map((e) => `<link rel="alternate" hreflang="${e.code}" href="${escapeAttr(e.url)}" />`).join('\n');
  }

  if (format === 'header') {
    return 'Link: ' + all.map((e) => `<${e.url}>; rel="alternate"; hreflang="${e.code}"`).join(', ');
  }

  // XML sitemap: every language version gets its own <url>, each listing all alternates (incl. itself).
  const alternates = all.map((e) => `    <xhtml:link rel="alternate" hreflang="${e.code}" href="${escapeAttr(e.url)}" />`).join('\n');
  const urls = all
    .filter((e) => e.code !== 'x-default')
    .map((e) => `  <url>\n    <loc>${escapeAttr(e.url)}</loc>\n${alternates}\n  </url>`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urls,
    '</urlset>',
  ].join('\n');
}
