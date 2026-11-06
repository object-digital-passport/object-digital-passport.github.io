const { test } = require('node:test');
const assert = require('node:assert/strict');
const canonical = require('../js/odp-v07-canonical.js');
const vectors = require('./vectors/canonical-v07.json');

test('published canonical JSON vectors and SHA-256 match', async () => {
  for (const v of vectors) {
    const parsed = canonical.parseJSON(v.input);
    assert.equal(canonical.canonicalize(parsed), v.canonical);
    assert.equal(await canonical.canonicalHash(parsed), v.sha256);
  }
});

test('untrusted JSON rejects duplicate keys, collisions, invalid UTF-8 and BOM', () => {
  assert.throws(() => canonical.parseJSON('{"a":1,"a":2}'), /Duplicate/);
  assert.throws(() => canonical.parseJSON('{"é":1,"e\\u0301":2}'), /Duplicate/);
  assert.throws(() => canonical.parseJSON('{"x":"\\ud800"}'), /surrogate/);
  assert.throws(() => canonical.parseJSONBytes(Uint8Array.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), /BOM/);
  assert.throws(() => canonical.parseJSONBytes(Uint8Array.from([0x7b, 0xff, 0x7d])));
  assert.throws(() => canonical.parseJSON('{"x":1} trailing'), /Trailing/);
});
