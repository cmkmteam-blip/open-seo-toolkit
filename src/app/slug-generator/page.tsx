import type { Metadata } from 'next';
import { SlugGenerator } from './SlugGenerator';

export const metadata: Metadata = {
  title: 'Bulk Slug Generator: titles to URL slugs',
  description: 'Free bulk slug generator. Converts titles to clean URL slugs and handles Turkish, Arabic, Cyrillic and accented characters.',
};

export default function Page() {
  return <SlugGenerator />;
}
