import type { Metadata } from 'next';
import { aiEnabled } from '@/lib/ai';
import { KeywordMixer } from './KeywordMixer';

export const metadata: Metadata = {
  title: 'Keyword Mixer: combine keyword lists',
  description: 'Free keyword mixer: combine services, cities and modifiers into every long-tail keyword combination. Runs in your browser.',
};

// Reads env at request time so the AI panel follows the deployment's own GEMINI_API_KEY.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <KeywordMixer aiEnabled={aiEnabled()} />;
}
