/**
 * Characters that Unicode NFD normalization doesn't reduce to plain ASCII.
 * Turkish dotless/dotted i are handled here (before lowercasing) so "İstanbul" → "istanbul", not "i̇stanbul".
 */
const LATIN_MAP: Record<string, string> = {
  ı: 'i', İ: 'i', I: 'i', ğ: 'g', Ğ: 'g', ş: 's', Ş: 's', ç: 'c', Ç: 'c',
  ß: 'ss', ẞ: 'ss', æ: 'ae', Æ: 'ae', œ: 'oe', Œ: 'oe', ø: 'o', Ø: 'o',
  đ: 'd', Đ: 'd', ð: 'd', Ð: 'd', þ: 'th', Þ: 'th', ł: 'l', Ł: 'l', ħ: 'h', Ħ: 'h',
  '&': ' and ', '@': ' at ', '+': ' plus ',
};

const CYRILLIC_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  є: 'ye', і: 'i', ї: 'yi', ґ: 'g',
};

/** Simple, readable Arabic → Latin transliteration (not a scholarly one; short vowels aren't written in Arabic). */
const ARABIC_MAP: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ء: '', ؤ: 'u', ئ: 'i', ب: 'b', ت: 't', ث: 'th', ج: 'j',
  ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't',
  ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'a', پ: 'p', چ: 'ch', ژ: 'zh', گ: 'g', ک: 'k', ی: 'y',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

// Arabic harakat (short vowel marks), tatweel and Quranic marks.
const ARABIC_MARKS = /[ً-ٰٟـۖ-ۭ]/g;

export type SlugMode = 'ascii' | 'unicode';

export interface SlugOptions {
  /** `ascii`: transliterate everything to a-z0-9. `unicode`: keep letters of any script (Google supports UTF-8 URLs). */
  mode?: SlugMode;
  separator?: '-' | '_';
  /** Maximum slug length; cut at a separator when possible. 0 = no limit. */
  maxLength?: number;
  /** Drop common English stop words ("a", "the", "of"…). */
  removeStopWords?: boolean;
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'from', 'is', 'are']);

function mapChars(text: string, map: Record<string, string>): string {
  let out = '';
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

export function slugify(title: string, { mode = 'ascii', separator = '-', maxLength = 80, removeStopWords = false }: SlugOptions = {}): string {
  let s = mapChars(title.replace(ARABIC_MARKS, ''), LATIN_MAP);
  if (mode === 'ascii') {
    s = mapChars(s.toLowerCase(), { ...CYRILLIC_MAP, ...ARABIC_MAP });
    s = s.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, ' ');
  } else {
    // Keep letters and numbers of every script; drop combining accents on Latin only.
    s = s.toLowerCase().normalize('NFKD');
    s = s.replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFC');
    s = s.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ');
  }

  let words = s.trim().split(/\s+/).filter(Boolean);
  if (removeStopWords && words.length > 1) {
    const kept = words.filter((w) => !STOP_WORDS.has(w));
    if (kept.length) words = kept;
  }

  let slug = words.join(separator);
  if (maxLength > 0 && [...slug].length > maxLength) {
    const chars = [...slug].slice(0, maxLength);
    const cut = chars.lastIndexOf(separator);
    slug = (cut > maxLength / 2 ? chars.slice(0, cut) : chars).join('');
    slug = slug.replace(new RegExp(`\\${separator}+$`), '');
  }
  return slug;
}

/** Slugifies many titles and makes duplicates unique with a numeric suffix (`-2`, `-3`, …). */
export function bulkSlugify(titles: string[], options: SlugOptions = {}): string[] {
  const sep = options.separator ?? '-';
  const used = new Set<string>();
  return titles.map((title) => {
    const base = slugify(title, options) || 'untitled';
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}${sep}${n}`;
    used.add(slug);
    return slug;
  });
}
