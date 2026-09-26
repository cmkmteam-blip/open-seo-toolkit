'use client';

import { useState } from 'react';
import { AlertTriangle, Download, Plus, X } from 'lucide-react';
import { CtaCard } from '@/components/CtaCard';
import { CopyButton, ToolHeader } from '@/components/ui';
import { downloadText } from '@/lib/csv';
import { buildHreflang, COMMON_LANGUAGES, normalizeCode, urlFromPattern, validateEntries, type HreflangEntry, type HreflangFormat } from '@/lib/hreflang';
import { TOOLS } from '@/lib/tools';

const tool = TOOLS.find((t) => t.slug === 'hreflang-generator')!;
const FORMATS: { id: HreflangFormat; label: string }[] = [
  { id: 'html', label: 'HTML <link> tags' },
  { id: 'xml', label: 'XML sitemap' },
  { id: 'header', label: 'HTTP Link header' },
];

export function HreflangGenerator() {
  const [pattern, setPattern] = useState('https://example.com/{lang}/');
  const [entries, setEntries] = useState<HreflangEntry[]>([
    { code: 'en', url: 'https://example.com/en/' },
    { code: 'de', url: 'https://example.com/de/' },
  ]);
  const [xDefault, setXDefault] = useState<string>('en');
  const [customXDefault, setCustomXDefault] = useState('');
  const [format, setFormat] = useState<HreflangFormat>('html');
  const [customCode, setCustomCode] = useState('');

  const xDefaultUrl = xDefault === 'custom' ? customXDefault : entries.find((e) => e.code === xDefault)?.url ?? '';
  const problems = validateEntries(entries, xDefault === 'custom' ? customXDefault : undefined);
  const output = buildHreflang(entries, format, xDefaultUrl);

  const addLanguage = (raw: string) => {
    const code = normalizeCode(raw);
    if (!code || code === 'x-default' || entries.some((e) => e.code === code)) return;
    setEntries([...entries, { code, url: urlFromPattern(pattern, code) }]);
  };
  const removeLanguage = (code: string) => {
    setEntries(entries.filter((e) => e.code !== code));
    if (xDefault === code) setXDefault('');
  };
  const applyPattern = () => setEntries(entries.map((e) => ({ ...e, url: urlFromPattern(pattern, e.code) })));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolHeader title={tool.name} description={tool.description} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel min-w-0">
          <label className="label" htmlFor="pattern">URL pattern</label>
          <div className="flex gap-2">
            <input id="pattern" className="field min-w-0 font-mono" value={pattern} onChange={(e) => setPattern(e.target.value)} />
            <button type="button" className="btn-ghost shrink-0" onClick={applyPattern}>Apply to all</button>
          </div>
          <p className="hint mt-1">
            <code>{'{lang}'}</code> becomes the lowercase code (en-gb), <code>{'{LANG}'}</code> keeps its case (en-GB). You can also edit each URL below.
          </p>

          <p className="label mt-5">Add languages</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_LANGUAGES.filter((l) => !entries.some((e) => e.code === l.code)).map((l) => (
              <button key={l.code} type="button" onClick={() => addLanguage(l.code)} className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs hover:border-accent hover:text-accent" title={l.name}>
                + {l.code}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addLanguage(customCode);
              setCustomCode('');
            }}
          >
            <input className="field w-40 font-mono" placeholder="e.g. fr-CA" value={customCode} onChange={(e) => setCustomCode(e.target.value)} aria-label="Custom language code" />
            <button type="submit" className="btn-ghost" disabled={!normalizeCode(customCode)}>
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          </form>

          <p className="label mt-5">Language versions</p>
          <ul className="space-y-2">
            {entries.map((e, i) => (
              <li key={e.code} className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-sm font-semibold">{e.code}</span>
                <input
                  className="field min-w-0 font-mono"
                  value={e.url}
                  aria-label={`URL for ${e.code}`}
                  onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))}
                />
                <button type="button" className="rounded p-1 text-muted hover:text-bad" onClick={() => removeLanguage(e.code)} aria-label={`Remove ${e.code}`}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <label className="label mt-5" htmlFor="xdefault">x-default (fallback for other languages)</label>
          <select id="xdefault" className="field" value={xDefault} onChange={(e) => setXDefault(e.target.value)}>
            <option value="">None</option>
            {entries.map((e) => (
              <option key={e.code} value={e.code}>{e.code}: {e.url}</option>
            ))}
            <option value="custom">Custom URL (e.g. a language picker)</option>
          </select>
          {xDefault === 'custom' && (
            <input className="field mt-2 font-mono" placeholder="https://example.com/" value={customXDefault} onChange={(e) => setCustomXDefault(e.target.value)} aria-label="Custom x-default URL" />
          )}
        </div>

        <div className="panel flex min-w-0 flex-col">
          <div role="tablist" className="flex flex-wrap gap-1 rounded-lg bg-paper p-1">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={format === f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${format === f.id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {problems.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm text-warn">
              {problems.map((p) => (
                <li key={p} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{p}</li>
              ))}
            </ul>
          )}

          <pre className="mt-4 min-h-48 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-paper">{output || 'Add at least one language with a URL.'}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton text={output} label="Copy output" />
            {format === 'xml' && (
              <button type="button" className="btn-ghost" disabled={!output} onClick={() => downloadText('sitemap-hreflang.xml', output + '\n', 'application/xml;charset=utf-8')}>
                <Download className="h-4 w-4" aria-hidden /> sitemap.xml
              </button>
            )}
          </div>
          <p className="hint mt-2">
            {format === 'html' && 'Put the same set of tags in the <head> of every language version, including the page itself.'}
            {format === 'xml' && 'Each language version gets its own <url> entry listing all alternates.'}
            {format === 'header' && 'Useful for PDFs and other non-HTML files. Send the same header on every version.'}
          </p>
        </div>
      </div>

      {output && (
        <CtaCard
          tool="hreflang-generator"
          title={`Need content for all ${entries.length} language versions?`}
          body="pSEO Wizard writes landing pages in the language of each market, with lang and dir attributes set correctly."
        />
      )}
    </div>
  );
}
