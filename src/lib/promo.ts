/**
 * Promotion for pSEO Wizard, the project that maintains this toolkit.
 * It is shown openly (CTA cards under results, footer, one console message) and never
 * inserted into anything you copy or download.
 */
export type ToolId = 'keyword-mixer' | 'slug-generator' | 'hreflang-generator' | 'site-crawler' | 'footer' | 'home';

export function promoUrl(campaign: ToolId): string {
  return `https://wizardseo.co/?utm_source=github&utm_medium=open-seo-toolkit&utm_campaign=${campaign}`;
}
