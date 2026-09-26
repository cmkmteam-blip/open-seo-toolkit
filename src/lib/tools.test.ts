import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toCsv } from './csv';
import { buildHreflang, normalizeCode, urlFromPattern, validateEntries } from './hreflang';
import { countCombinations, mixKeywords, parseList } from './keyword-mixer';
import { promoUrl } from './promo';
import { bulkSlugify, slugify } from './slug';
import { parseIdeas } from './ai';
import { rateLimit } from './rate-limit';

test('parseList trims, drops blanks and case-insensitive duplicates', () => {
  assert.deepEqual(parseList(' plumber \n\nPlumber\r\nroofer  '), ['plumber', 'roofer']);
});

test('mixKeywords builds the cartesian product in order, skipping empty lists', () => {
  const lists = [['plumber', 'roofer'], [], ['London', 'Leeds']];
  assert.equal(countCombinations(lists), 4);
  assert.deepEqual(mixKeywords(lists), ['plumber London', 'plumber Leeds', 'roofer London', 'roofer Leeds']);
  assert.deepEqual(mixKeywords([['a'], ['b']], { separator: '-' }), ['a-b']);
  assert.deepEqual(mixKeywords([[], []]), []);
});

test('mixKeywords respects the limit', () => {
  const big = Array.from({ length: 100 }, (_, i) => `w${i}`);
  assert.equal(mixKeywords([big, big], { limit: 250 }).length, 250);
});

test('slugify handles accents and Turkish letters', () => {
  assert.equal(slugify('Café & Crêpes: Brunch Menü'), 'cafe-and-crepes-brunch-menu');
  assert.equal(slugify('İstanbul’da En İyi Çiğ Köfte Şişli'), 'istanbul-da-en-iyi-cig-kofte-sisli');
  assert.equal(slugify('IŞIK ığdır'), 'isik-igdir');
  assert.equal(slugify('Straße in Köln'), 'strasse-in-koln');
});

test('slugify transliterates Arabic and Cyrillic in ASCII mode', () => {
  assert.match(slugify('أفضل مطاعم دبي'), /^[a-z0-9-]+$/);
  assert.equal(slugify('مطعم ٢٤ ساعة'), 'mtam-24-saaa');
  assert.equal(slugify('Лучшие рестораны Москвы'), 'luchshie-restorany-moskvy');
});

test('slugify keeps native script in unicode mode', () => {
  assert.equal(slugify('أفضل مطاعم دبي', { mode: 'unicode' }), 'أفضل-مطاعم-دبي');
  assert.equal(slugify('مَطْعَم', { mode: 'unicode' }), 'مطعم');
  assert.equal(slugify('Café Menü', { mode: 'unicode' }), 'cafe-menu');
});

test('slugify options: separator, stop words, max length at a word boundary', () => {
  assert.equal(slugify('The Best of London', { separator: '_', removeStopWords: true }), 'best_london');
  const s = slugify('one two three four five six seven', { maxLength: 15 });
  assert.equal(s, 'one-two-three');
  assert.ok(s.length <= 15);
});

test('bulkSlugify makes duplicates unique', () => {
  assert.deepEqual(bulkSlugify(['Hello World', 'hello world!', 'Hello-World', '???']), ['hello-world', 'hello-world-2', 'hello-world-3', 'untitled']);
});

test('hreflang codes are normalized and validated', () => {
  assert.equal(normalizeCode('EN_gb'), 'en-GB');
  assert.equal(normalizeCode('zh-hant'), 'zh-Hant');
  assert.equal(normalizeCode('english'), null);
  assert.deepEqual(validateEntries([{ code: 'en', url: 'https://a.com/en/' }]), []);
  const problems = validateEntries([{ code: 'en-UK', url: 'https://a.com/' }, { code: 'de', url: '/de/' }]);
  assert.ok(problems.some((p) => p.includes('en-GB')));
  assert.ok(problems.some((p) => p.includes('absolute')));
  assert.equal(urlFromPattern('https://a.com/{lang}/x', 'en-GB'), 'https://a.com/en-gb/x');
});

test('hreflang output is exactly the requested tags: no comments, no promotion', () => {
  const entries = [{ code: 'en', url: 'https://example.com/en/' }, { code: 'de', url: 'https://example.com/de/?a=1&b=2' }];
  const html = buildHreflang(entries, 'html', 'https://example.com/en/');
  assert.equal(
    html,
    [
      '<link rel="alternate" hreflang="en" href="https://example.com/en/" />',
      '<link rel="alternate" hreflang="de" href="https://example.com/de/?a=1&amp;b=2" />',
      '<link rel="alternate" hreflang="x-default" href="https://example.com/en/" />',
    ].join('\n'),
  );
  for (const format of ['html', 'xml', 'header'] as const) {
    const out = buildHreflang(entries, format, 'https://example.com/');
    assert.ok(!out.includes('<!--'), `${format} contains a comment`);
    assert.ok(!/wizard|pseo|utm_/i.test(out), `${format} contains promotion`);
  }
  const xml = buildHreflang(entries, 'xml');
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.equal((xml.match(/<xhtml:link/g) ?? []).length, 4);
  assert.ok(xml.startsWith('<?xml'));
  assert.equal(buildHreflang(entries, 'header'), 'Link: <https://example.com/en/>; rel="alternate"; hreflang="en", <https://example.com/de/?a=1&b=2>; rel="alternate"; hreflang="de"');
  assert.equal(buildHreflang([], 'html'), '');
});

test('toCsv escapes cells, guards formulas and adds only data rows', () => {
  const csv = toCsv(['A', 'B'], [['x,y', 'say "hi"'], ['=SUM(1)', -5], [null, 'line\nbreak']]);
  assert.equal(csv, 'A,B\r\n"x,y","say ""hi"""\r\n\'=SUM(1),-5\r\n,"line\nbreak"\r\n');
  assert.ok(!/wizard|pseo|utm_/i.test(csv));
});

test('promo links go only to the public site with UTM tags', () => {
  assert.equal(promoUrl('keyword-mixer'), 'https://wizardseo.co/?utm_source=github&utm_medium=open-seo-toolkit&utm_campaign=keyword-mixer');
});

test('parseIdeas reads JSON and de-duplicates', () => {
  assert.deepEqual(parseIdeas('{"ideas":["a b","A B"," c ",3]}', 10), ['a b', 'c']);
  assert.deepEqual(parseIdeas('```json\n["x","y","z"]\n```', 2), ['x', 'y']);
  assert.deepEqual(parseIdeas('not json', 5), []);
});

test('rateLimit allows max hits per window', () => {
  const key = `t-${Math.random()}`;
  assert.equal(rateLimit(key, 2, 1000, 0), true);
  assert.equal(rateLimit(key, 2, 1000, 10), true);
  assert.equal(rateLimit(key, 2, 1000, 20), false);
  assert.equal(rateLimit(key, 2, 1000, 1500), true);
});
