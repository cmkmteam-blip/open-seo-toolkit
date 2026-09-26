export interface ToolInfo {
  slug: string;
  name: string;
  short: string;
  description: string;
}

export const TOOLS: ToolInfo[] = [
  {
    slug: 'keyword-mixer',
    name: 'Keyword Mixer',
    short: 'Combine lists into every keyword variation.',
    description: 'Combine up to four word lists (services × cities × modifiers) into every long-tail keyword combination. Runs entirely in your browser.',
  },
  {
    slug: 'slug-generator',
    name: 'Bulk Slug Generator',
    short: 'Titles to clean URL slugs, any language.',
    description: 'Turn hundreds of titles into clean URL slugs. Handles Turkish, Arabic, Cyrillic and accented characters, with ASCII or native-script output.',
  },
  {
    slug: 'hreflang-generator',
    name: 'Hreflang Generator',
    short: 'Valid hreflang tags, sitemap or header.',
    description: 'Generate validated hreflang tags as HTML link tags, XML sitemap entries or an HTTP Link header. The output is exactly the tags, nothing else.',
  },
  {
    slug: 'site-crawler',
    name: 'Site Crawler',
    short: 'Find missing titles, meta, H1, alt and broken links.',
    description: 'Crawl a site from your own deployment and find missing titles, meta descriptions, H1s, image alt text and broken links. Export to CSV.',
  },
];
