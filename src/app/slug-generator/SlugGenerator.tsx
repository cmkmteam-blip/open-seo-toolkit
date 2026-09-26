'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { CtaCard } from '@/components/CtaCard';
import { CopyButton, ToolHeader } from '@/components/ui';
import { downloadText, toCsv } from '@/lib/csv';
import { bulkSlugify, type SlugMode } from '@/lib/slug';
import { TOOLS } from '@/lib/tools';

const tool = TOOLS.find((t) => t.slug === 'slug-generator')!;
const EXAMPLE = 'Best Coffee Shops in İstanbul\nCafé & Crêpes: Brunch Menü\nأفضل مطاعم دبي\nЛучшие рестораны Москвы';

export function SlugGenerator() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<SlugMode>('ascii');
  const [separator, setSeparator] = useState<'-' | '_'>('-');
  const [maxLength, setMaxLength] = useState(80);
  const [removeStopWords, setRemoveStopWords] = useState(false);

  const titles = useMemo(() => input.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), [input]);
  const slugs = useMemo(() => bulkSlugify(titles, { mode, separator, maxLength, removeStopWords }), [titles, mode, separator, maxLength, removeStopWords]);
  const output = slugs.join('\n');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolHeader title={tool.name} description={tool.description} />

      <div className="panel">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="label" htmlFor="mode">Characters</label>
            <select id="mode" className="field w-auto" value={mode} onChange={(e) => setMode(e.target.value as SlugMode)}>
              <option value="ascii">ASCII only (transliterate)</option>
              <option value="unicode">Keep native script (Arabic, Cyrillic…)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sep">Separator</label>
            <select id="sep" className="field w-auto" value={separator} onChange={(e) => setSeparator(e.target.value as '-' | '_')}>
              <option value="-">Hyphen (-)</option>
              <option value="_">Underscore (_)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="max">Max length</label>
            <input id="max" type="number" min={0} max={200} className="field w-24" value={maxLength} onChange={(e) => setMaxLength(Math.max(0, Number(e.target.value) || 0))} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="accent-accent" checked={removeStopWords} onChange={(e) => setRemoveStopWords(e.target.checked)} />
            Remove English stop words
          </label>
        </div>
        <p className="hint mt-2">Google handles UTF-8 URLs, so native-script slugs are fine for Arabic or Russian sites. Duplicates get -2, -3…</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="titles">Titles (one per line)</label>
              {!input && (
                <button type="button" className="mb-1.5 text-xs font-medium text-accent hover:underline" onClick={() => setInput(EXAMPLE)}>
                  Try an example
                </button>
              )}
            </div>
            <textarea id="titles" className="field h-72 font-mono" placeholder="Best CRM Tools for Startups" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="slugs">Slugs</label>
            <textarea id="slugs" readOnly className="field h-72 font-mono text-accent-dark" value={output} placeholder="best-crm-tools-for-startups" />
          </div>
        </div>

        {slugs.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-sm text-muted">{slugs.length.toLocaleString('en')} slugs</span>
            <CopyButton text={output} label="Copy slugs" />
            <button type="button" className="btn-ghost" onClick={() => downloadText('slugs.csv', toCsv(['Title', 'Slug'], titles.map((t, i) => [t, slugs[i]])))}>
              <Download className="h-4 w-4" aria-hidden /> CSV
            </button>
          </div>
        )}
      </div>

      {slugs.length > 0 && (
        <CtaCard
          tool="slug-generator"
          title={`Need real pages behind these ${slugs.length.toLocaleString('en')} slugs?`}
          body="pSEO Wizard generates a complete landing page for each one, with title, meta description, schema and internal links."
        />
      )}
    </div>
  );
}
