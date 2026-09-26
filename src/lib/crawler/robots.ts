interface Rule {
  allow: boolean;
  path: string;
}

export interface Robots {
  isAllowed(pathWithQuery: string): boolean;
  /** Crawl-delay in ms for our group, if set. */
  crawlDelayMs?: number;
}

const ALLOW_ALL: Robots = { isAllowed: () => true };

/**
 * Minimal robots.txt parser (RFC 9309): picks the group for our user agent token, else `*`,
 * and applies the longest matching Allow/Disallow rule (`*` and `$` wildcards supported).
 */
export function parseRobots(text: string, agentToken = 'openseotoolkit'): Robots {
  const groups: { agents: string[]; rules: Rule[]; delay?: number }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const m = /^([a-zA-Z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();

    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value) current.rules.push({ allow: key === 'allow', path: value });
      else if (key === 'disallow') current.rules.push({ allow: true, path: '/' });
    } else if (key === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.delay = n * 1000;
    }
  }

  const group = groups.find((g) => g.agents.some((a) => a === agentToken)) ?? groups.find((g) => g.agents.includes('*'));
  if (!group) return ALLOW_ALL;

  const rules = group.rules.map((r) => ({ ...r, re: patternToRegExp(r.path) }));
  return {
    crawlDelayMs: group.delay,
    isAllowed(path) {
      let best: { allow: boolean; len: number } | null = null;
      for (const r of rules) {
        if (!r.re.test(path)) continue;
        const len = r.path.length;
        // Longest match wins; on a tie, Allow wins.
        if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
      }
      return best ? best.allow : true;
    },
  };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + body + (anchored ? '$' : ''));
}

export { ALLOW_ALL };
