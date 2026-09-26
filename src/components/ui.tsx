'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function ToolHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{description}</p>
    </div>
  );
}

/** Copies exactly `text` to the clipboard, nothing added. */
export function CopyButton({ text, label = 'Copy', disabled }: { text: string; label?: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      disabled={disabled || !text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-good" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  );
}
