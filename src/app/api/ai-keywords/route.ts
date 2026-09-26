import { NextResponse } from 'next/server';
import { aiEnabled, keywordIdeas } from '@/lib/ai';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Protects the deployment owner's AI quota from being drained by strangers.
  if (!rateLimit(`ai:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Wait a minute and try again.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { seed?: unknown } | null;
  const seed = typeof body?.seed === 'string' ? body.seed.trim().slice(0, 100) : '';
  if (!seed) return NextResponse.json({ error: 'Enter a seed keyword.' }, { status: 400 });

  try {
    return NextResponse.json({ ideas: await keywordIdeas(seed) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'The AI request failed.' }, { status: 502 });
  }
}

function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}
