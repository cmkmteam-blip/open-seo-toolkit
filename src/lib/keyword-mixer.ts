/** Hard cap so a huge paste can't freeze the browser tab. */
export const MAX_COMBINATIONS = 100_000;

/** Splits a textarea value into trimmed, non-empty, de-duplicated lines (order kept). */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const item = raw.trim().replace(/\s+/g, ' ');
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Number of combinations the non-empty lists produce (empty lists are skipped). */
export function countCombinations(lists: string[][]): number {
  const used = lists.filter((l) => l.length > 0);
  if (used.length === 0) return 0;
  return used.reduce((n, l) => n * l.length, 1);
}

export interface MixOptions {
  separator?: string;
  limit?: number;
}

/**
 * Cartesian product of the lists, e.g. ["plumber", "electrician"] × ["London", "Leeds"].
 * Empty lists are skipped, duplicates (case-insensitive) are removed, output is capped at `limit`.
 */
export function mixKeywords(lists: string[][], { separator = ' ', limit = MAX_COMBINATIONS }: MixOptions = {}): string[] {
  const used = lists.filter((l) => l.length > 0);
  if (used.length === 0) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const idx = new Array(used.length).fill(0);

  while (out.length < limit) {
    const combo = used.map((l, i) => l[idx[i]]).join(separator).trim();
    const key = combo.toLowerCase();
    if (combo && !seen.has(key)) {
      seen.add(key);
      out.push(combo);
    }
    // Odometer increment: the last list changes fastest.
    let pos = used.length - 1;
    while (pos >= 0) {
      idx[pos]++;
      if (idx[pos] < used[pos].length) break;
      idx[pos] = 0;
      pos--;
    }
    if (pos < 0) break;
  }
  return out;
}
