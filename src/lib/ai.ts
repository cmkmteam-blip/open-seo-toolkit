/**
 * Optional AI keyword ideas. Enabled only when GEMINI_API_KEY is set in the deployment's own environment.
 * The key stays on the server; the browser only ever sees whether the feature is on.
 */
export function aiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY?.trim();
}

const DEFAULT_MODEL = 'gemini-flash-latest';

export function buildIdeasPrompt(seed: string, count: number): string {
  return [
    `Suggest ${count} search keyword ideas related to: "${seed}".`,
    'Mix modifiers (best, cheap, near me, for beginners…), long-tail questions and close variations people really search for.',
    'Write them in the same language as the seed. Lowercase unless a word is a proper noun. No numbering, no duplicates.',
    'Answer as JSON: {"ideas": ["...", "..."]}',
  ].join('\n');
}

/** Parses the model's JSON answer into a clean, de-duplicated list. */
export function parseIdeas(text: string, max: number): string[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return [];
  }
  const list = Array.isArray(data) ? data : (data as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const s = item.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      out.push(s);
    }
    if (out.length >= max) break;
  }
  return out;
}

export async function keywordIdeas(seed: string, count = 25): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('AI keyword ideas are not enabled on this deployment.');
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildIdeasPrompt(seed, count) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) throw new Error('The AI quota for this deployment is used up. Try again later.');
  if (!res.ok) throw new Error(`The AI request failed (HTTP ${res.status}).`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  return parseIdeas(text, count);
}
