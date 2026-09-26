/**
 * RFC 4180 CSV. The output is exactly one header row plus one row per record:
 * nothing else is added (no credits, no ad rows, no blank lines).
 */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

function cell(value: string | number | boolean | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  // Stop spreadsheet apps from running text that starts like a formula.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Triggers a browser download (client-side only). A UTF-8 BOM makes Excel read accents and Arabic correctly. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
