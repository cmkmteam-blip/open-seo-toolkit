'use client';

import { useMemo, useState } from 'react';
import { Download, Loader2, Shuffle, Sparkles } from 'lucide-react';
import { CtaCard } from '@/components/CtaCard';
import { CopyButton, ToolHeader } from '@/components/ui';
import { downloadText, toCsv } from '@/lib/csv';
import { countCombinations, MAX_COMBINATIONS, mixKeywords, parseList } from '@/lib/keyword-mixer';
import { TOOLS } from '@/lib/tools';

const COLUMNS = [
  { label: 'List A', example: 'e.g. services', placeholder: 'plumber\nelectrician\nroofer' },
  { label: 'List B', example: 'e.g. cities', placeholder: 'London\nManchester\nLeeds' },
  { label: 'List C', example: 'optional', placeholder: 'near me\nprices\n24/7' },
  { label: 'List D', example: 'optional', placeholder: '' },
];

const tool = TOOLS.find((t) => t.slug === 'keyword-mixer')!;

export function KeywordMixer({ aiEnabled }: { aiEnabled: boolean }) {
  const [inputs, setInputs] = useState(['', '', '', '']);
  const [separator, setSeparator] = useState(' ');
  const [results, setResults] = useState<string[]>([]);

  const lists = useMemo(() => inputs.map(parseList), [inputs]);
  const total = countCombinations(lists);
  const output = results.join('\n');

  const setInput = (i: number, value: string) => setInputs((prev) => prev.map((v, j) => (j === i ? value : v)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolHeader title={tool.name} description={tool.description} />

      <div className="panel">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col, i) => (
            <div key={col.label}>
              <label className="label" htmlFor={`list-${i}`}>
                {col.label} <span className="font-normal text-muted">({col.example})</span>
              </label>
              <textarea
                id={`list-${i}`}
                className="field h-44 resize-y font-mono"
                placeholder={col.placeholder}
                value={inputs[i]}
                onChange={(e) => setInput(i, e.target.value)}
              />
              <p className="hint mt-1">{lists[i].length} item{lists[i].length === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="label" htmlFor="separator">Join with</label>
            <select id="separator" className="field w-auto" value={separator} onChange={(e) => setSeparator(e.target.value)}>
              <option value=" ">Space</option>
              <option value="-">Hyphen (-)</option>
              <option value=", ">Comma</option>
              <option value="">Nothing</option>
            </select>
          </div>
          <button type="button" className="btn-primary" disabled={total === 0} onClick={() => setResults(mixKeywords(lists, { separator }))}>
            <Shuffle className="h-4 w-4" aria-hidden /> Mix {total > 0 ? total.toLocaleString('en') : ''} keywords
          </button>
          {total > MAX_COMBINATIONS && (
            <p className="text-sm text-warn">Only the first {MAX_COMBINATIONS.toLocaleString('en')} combinations will be generated.</p>
          )}
        </div>
      </div>

      {aiEnabled && <AiIdeas onAdd={(i, ideas) => setInput(i, [inputs[i].trim(), ...ideas].filter(Boolean).join('\n'))} />}

      {results.length > 0 && (
        <>
          <div className="panel mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{results.length.toLocaleString('en')} keywords</h2>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={output} label="Copy all" />
                <button type="button" className="btn-ghost" onClick={() => downloadText('keywords.csv', toCsv(['Keyword'], results.map((k) => [k])))}>
                  <Download className="h-4 w-4" aria-hidden /> CSV
                </button>
                <button type="button" className="btn-ghost" onClick={() => downloadText('keywords.txt', output + '\n', 'text/plain;charset=utf-8')}>
                  <Download className="h-4 w-4" aria-hidden /> TXT
                </button>
              </div>
            </div>
            <textarea readOnly aria-label="Generated keywords" className="field h-72 font-mono" value={output} />
          </div>

          <CtaCard
            tool="keyword-mixer"
            title={`Turn these ${results.length.toLocaleString('en')} keywords into ${results.length.toLocaleString('en')} real landing pages`}
            body="pSEO Wizard writes a unique landing page for every keyword combination and exports or publishes them to WordPress, Webflow, Shopify and more."
            cta="pSEO Wizard"
          />
        </>
      )}
    </div>
  );
}

function AiIdeas({ onAdd }: { onAdd: (column: number, ideas: string[]) => void }) {
  const [seed, setSeed] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai-keywords', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setIdeas(data.ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel mt-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden /> AI keyword ideas
      </h2>
      <p className="hint mt-1">Uses the Gemini API key configured on this deployment.</p>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (seed.trim()) run();
        }}
      >
        <input className="field max-w-sm" placeholder="Seed keyword, e.g. dog grooming" value={seed} onChange={(e) => setSeed(e.target.value)} maxLength={100} />
        <button type="submit" className="btn-primary" disabled={loading || !seed.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />} Suggest
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      {ideas.length > 0 && (
        <div className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {ideas.map((idea) => (
              <li key={idea} className="rounded-full border border-line bg-paper px-3 py-1 text-sm">{idea}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {COLUMNS.map((c, i) => (
              <button key={c.label} type="button" className="btn-ghost" onClick={() => onAdd(i, ideas)}>
                Add to {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
