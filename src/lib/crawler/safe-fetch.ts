import dns from 'node:dns/promises';
import net from 'node:net';

export const USER_AGENT = 'Mozilla/5.0 (compatible; OpenSEOToolkit/1.0; self-hosted site audit)';
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class BlockedUrlError extends Error {}

/** True for loopback, private, link-local, CGNAT, multicast and reserved addresses. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateIp(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}

/** Local crawling (localhost, LAN) is off by default so a public deployment can't be used to probe internal networks. */
function privateHostsAllowed(): boolean {
  return process.env.ALLOW_PRIVATE_HOSTS === 'true';
}

/** Throws BlockedUrlError unless the URL is public http(s) on a standard port. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedUrlError('Only http and https URLs can be crawled.');
  if (url.username || url.password) throw new BlockedUrlError('URLs with credentials are not allowed.');
  if (privateHostsAllowed()) return;
  if (url.port && url.port !== '80' && url.port !== '443') throw new BlockedUrlError('Only ports 80 and 443 are allowed.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) throw new BlockedUrlError('Private hosts are not allowed.');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new BlockedUrlError(`Could not resolve ${host}.`);
  if (addresses.some((a) => isPrivateIp(a.address))) throw new BlockedUrlError('Private or internal addresses are not allowed.');
}

export interface FetchResult {
  /** URL after redirects. */
  url: string;
  status: number;
  contentType: string;
  /** Body text, only for HTML responses (and robots.txt when `asText`). */
  body?: string;
  bytes: number;
  ms: number;
  redirects: string[];
}

/**
 * Fetches a URL, following up to 5 redirects and re-checking every hop against the SSRF rules.
 * Returns status 0 on network errors or timeouts.
 */
export async function safeFetch(rawUrl: string, { method = 'GET', asText = false }: { method?: 'GET' | 'HEAD'; asText?: boolean } = {}): Promise<FetchResult> {
  const started = Date.now();
  const redirects: string[] = [];
  let url = new URL(rawUrl);

  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, Accept: asText ? 'text/plain,*/*' : 'text/html,application/xhtml+xml,*/*;q=0.8' },
      });
    } catch {
      return { url: url.href, status: 0, contentType: '', bytes: 0, ms: Date.now() - started, redirects };
    }

    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location && hop < MAX_REDIRECTS) {
      await res.body?.cancel();
      redirects.push(url.href);
      url = new URL(location, url);
      continue;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const wantBody = method === 'GET' && (asText || contentType.includes('html'));
    let body: string | undefined;
    let bytes = Number(res.headers.get('content-length')) || 0;
    if (wantBody) {
      const read = await readLimited(res);
      body = read.text;
      bytes = read.bytes;
    } else {
      await res.body?.cancel();
    }
    return { url: url.href, status: res.status, contentType, body, bytes, ms: Date.now() - started, redirects };
  }
}

async function readLimited(res: Response): Promise<{ text: string; bytes: number }> {
  if (!res.body) return { text: '', bytes: 0 };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
    if (done || !value) break;
    chunks.push(value);
    bytes += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return { text: new TextDecoder().decode(Buffer.concat(chunks)), bytes };
}
