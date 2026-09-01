// Locale selection and the English fallback, exercised without a browser.
//
// The fallback is the property that makes a partial translation usable, and it is easy to break
// while generalising the loader: a missing key, an empty string, or a missing FILE must all show
// the English string rather than blank. The last case is what lets someone add a language one
// page at a time.
//
// Run: node frontend/test/odp-i18n.test.mjs   (from the repository root)

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const src = readFileSync('frontend/js/odp-i18n.js', 'utf8');

function load({ stored, navLang, files }) {
  const store = { getItem: (k) => (k === 'odp_locale' ? stored ?? null : null), setItem() {} };
  const html = { classList: { add(){}, remove(){} }, lang: '', setAttribute(){} };
  const g = {
    localStorage: store,
    navigator: { language: navLang || 'en-US' },
    location: { href: 'https://example.test/verify.html' },
    document: {
      documentElement: html,
      body: { querySelectorAll: () => [] },
      querySelectorAll: () => [],
      getElementById: () => null,
      title: '',
      createElement: () => ({ style:{}, classList:{add(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }),
    },
    console, URL, Promise, setTimeout, clearTimeout,
    fetch: async (url) => {
      const m = String(url).match(/([a-z-]+)\/([a-z]+)\.json/);
      const key = m ? `${m[1]}/${m[2]}.json` : String(url);
      if (files && key in files) return { ok: true, json: async () => files[key] };
      return { ok: false, status: 404 };
    },
  };
  g.window = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(src, g);
  return g;
}

// 1. Unknown stored locale is ignored; browser language selects a known one.
let g = load({ stored: 'de', navLang: 'ru-RU' });
assert.equal(g.odpGetLocale(), 'ru', 'browser ru wins when stored value is unknown');

// 2. Stored known locale wins over the browser.
g = load({ stored: 'en', navLang: 'ru-RU' });
assert.equal(g.odpGetLocale(), 'en', 'stored en wins');

// 3. Unknown browser language falls back to the base locale.
g = load({ stored: null, navLang: 'de-DE' });
assert.equal(g.odpGetLocale(), 'en', 'unknown browser language falls back to en');

// 4. A locale file that 404s falls back to English rather than blanking the UI.
g = load({
  stored: 'ru', navLang: 'ru',
  files: {
    'en/common.json': { a: 'A-en', b: 'B-en' },
    'en/verify.json': { c: 'C-en' },
    'ru/common.json': { a: 'A-ru' },
    // ru/verify.json deliberately missing
  },
});
await g.odpInitI18n({ page: 'verify' });
assert.equal(g.odpT('a'), 'A-ru', 'translated key comes from ru');
assert.equal(g.odpT('b'), 'B-en', 'missing key falls back to en');
assert.equal(g.odpT('c'), 'C-en', 'missing FILE falls back to en');
assert.equal(g.document.documentElement.lang, 'ru', 'html lang is the selected locale');

// 5. An empty string in the translation does not override English.
g = load({
  stored: 'ru', navLang: 'ru',
  files: {
    'en/common.json': { a: 'A-en' }, 'en/verify.json': {},
    'ru/common.json': { a: '' }, 'ru/verify.json': {},
  },
});
await g.odpInitI18n({ page: 'verify' });
assert.equal(g.odpT('a'), 'A-en', 'empty translation keeps the English string');

// 6. A third locale added to the table alone loads from its own folder.
const src3 = src.replace(
  '{ code: "ru", emoji: "🇷🇺", abbr: "RU", label: "Русский"',
  '{ code: "de", emoji: "🇩🇪", abbr: "DE", label: "Deutsch", readmeUrl: "https://x/README.de.md" },\n    { code: "ru", emoji: "🇷🇺", abbr: "RU", label: "Русский"',
);
{
  const store = { getItem: () => 'de', setItem() {} };
  const html = { classList: { add(){}, remove(){} }, lang: '' };
  const g3 = {
    localStorage: store, navigator: { language: 'en' },
    location: { href: 'https://example.test/verify.html' },
    document: { documentElement: html, body: { querySelectorAll: () => [] }, querySelectorAll: () => [],
      getElementById: () => null, title: '',
      createElement: () => ({ style:{}, classList:{add(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }) },
    console, URL, Promise, setTimeout, clearTimeout,
    fetch: async (url) => {
      const m = String(url).match(/([a-z-]+)\/([a-z]+)\.json/);
      const key = m ? `${m[1]}/${m[2]}.json` : '';
      const files = { 'en/common.json': { a: 'A-en' }, 'en/verify.json': { c: 'C-en' },
                      'de/common.json': { a: 'A-de' }, 'de/verify.json': { c: 'C-de' } };
      return key in files ? { ok: true, json: async () => files[key] } : { ok: false, status: 404 };
    },
  };
  g3.window = g3; g3.globalThis = g3;
  vm.createContext(g3); vm.runInContext(src3, g3);
  await g3.odpInitI18n({ page: 'verify' });
  assert.equal(g3.odpGetLocale(), 'de', 'third locale resolves');
  assert.equal(g3.odpT('a'), 'A-de', 'third locale loads its own common.json');
  assert.equal(g3.odpT('c'), 'C-de', 'third locale loads its own page file');
  assert.equal(g3.document.documentElement.lang, 'de', 'html lang follows the third locale');
}

console.log('odp-i18n: 13 assertions passed — a third language needs one table row and a folder');
