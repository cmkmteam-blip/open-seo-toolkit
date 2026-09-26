# Free open-source SEO tools for Next.js

**Open SEO Toolkit** is a free, self-hosted set of SEO tools built with Next.js and Tailwind CSS: a **keyword mixer**, a **bulk slug generator**, a **hreflang tag generator** and a **site crawler** that finds missing titles, meta descriptions, H1s, image alt text and broken links.

No sign-up, no tracking and no API keys. Deploy your own copy to Vercel in one click.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcmkmteam-blip%2Fopen-seo-toolkit&project-name=open-seo-toolkit&repository-name=open-seo-toolkit)

## Features

| Tool | What it does | Runs |
|---|---|---|
| **Keyword Mixer** | Combines up to 4 lists (services × cities × modifiers) into every long-tail keyword, de-duplicated. Copy, CSV or TXT. | In your browser |
| **Bulk Slug Generator** | Turns titles into URL slugs. Handles Turkish (`İ ı ğ ş`), German (`ß`), accents, Arabic and Cyrillic. ASCII transliteration or native-script (UTF-8) slugs, `-` or `_`, max length, stop words, unique suffixes. | In your browser |
| **Hreflang Generator** | Builds validated hreflang as HTML `<link>` tags, an XML sitemap or an HTTP `Link` header, with `x-default`. Catches common mistakes (`en-UK`, relative URLs, duplicates). The copied output is only the tags. | In your browser |
| **Site Crawler** | Crawls a site from **your own deployment** and reports missing titles, meta descriptions, H1s, multiple H1s, images without `alt`, `noindex`, and broken internal (and optionally external) links with the pages that link to them. Live progress, filters, CSV export. | Next.js API route |
| **AI keyword ideas** *(optional)* | Suggests keyword ideas for a seed term in the Keyword Mixer. Only appears when `GEMINI_API_KEY` is set on your deployment. | Next.js API route |

## Deploy

### One click

Click **Deploy with Vercel** above. No environment variables are required.

### Run locally

```bash
git clone https://github.com/cmkmteam-blip/open-seo-toolkit.git
cd open-seo-toolkit
npm install
npm run dev
```

Open http://localhost:3000.

### Configuration (all optional)

Copy `.env.example` to `.env.local` and fill in what you need:

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | *(empty)* | Turns on **AI keyword ideas**. Without it the feature is hidden and its API route returns 404. Get a key at [Google AI Studio](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | `gemini-flash-latest` | Model used for keyword ideas. |
| `CRAWL_MAX_PAGES` | `100` | Highest page limit a visitor can choose (max 2000). |
| `CRAWL_MIN_DELAY_MS` | `500` | Minimum delay between crawler requests. |
| `ALLOW_PRIVATE_HOSTS` | `false` | Set to `true` **only locally** to crawl `localhost` or LAN sites. |

## How the crawler behaves

- Stays on the start URL's site (`www.` and bare domain count as the same site).
- Requests one page at a time with a politeness delay. If `robots.txt` sets a longer `Crawl-delay`, that wins (capped at 10 s).
- Respects `robots.txt` by default. Its user agent includes `OpenSEOToolkit`, so site owners can target it.
- Blocks private, loopback and cloud-metadata addresses (SSRF protection), re-checks every redirect, allows only ports 80/443 and reads at most 3 MB per page.
- Stops by itself before the serverless time limit (`maxDuration = 300` s) and returns what it found.
- Rate-limited to 5 crawls per IP per 10 minutes on each server instance.
- `alt=""` counts as valid (decorative images). Only images with no `alt` attribute are reported.

Please crawl only sites you own or are allowed to audit.

## Development

```bash
npm test        # unit tests (Node test runner): mixer, slugs, hreflang, CSV, robots.txt, SSRF guard, crawler
npm run lint    # type check
npm run build   # production build
```

Project layout:

```
src/lib/keyword-mixer.ts   combination logic
src/lib/slug.ts            slugify + transliteration tables
src/lib/hreflang.ts        hreflang validation and output
src/lib/csv.ts             RFC 4180 CSV
src/lib/crawler/           safe fetch, robots.txt, HTML analysis, crawl loop, CSV reports
src/app/api/crawl          streaming crawl endpoint (NDJSON)
src/app/api/ai-keywords    optional Gemini endpoint
```

## Made by pSEO Wizard

This toolkit is built and maintained by [pSEO Wizard](https://wizardseo.co/?utm_source=github&utm_medium=open-seo-toolkit&utm_campaign=readme), a programmatic SEO tool that turns keyword lists into unique landing pages and publishes them to WordPress, Webflow, Shopify and more.

We keep the promotion out of your work, in plain sight:

- After a result, each tool shows a clearly labelled card that links to pSEO Wizard.
- The footer says "Built by pSEO Wizard", and the browser console shows one friendly message.
- Nothing is ever added to what you copy or download: hreflang output, slugs, keywords and CSV files contain only your data. The tests check this.

The links live in `src/lib/promo.ts` and `src/components/CtaCard.tsx`.

## License

[MIT](LICENSE)
