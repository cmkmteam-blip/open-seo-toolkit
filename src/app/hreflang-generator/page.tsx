import type { Metadata } from 'next';
import { HreflangGenerator } from './HreflangGenerator';

export const metadata: Metadata = {
  title: 'Hreflang Generator: tags, sitemap and header',
  description: 'Free hreflang tag generator. Validated output as HTML link tags, XML sitemap entries or an HTTP Link header, with x-default.',
};

export default function Page() {
  return <HreflangGenerator />;
}
