const { test } = require('node:test');
const assert = require('node:assert/strict');
const { queryPassportId } = require('../js/odp-v07-locator.js');

test('accepts only one public passport locator with no unrelated data', () => {
  const id='ODP-2026-09-000000027';
  assert.equal(queryPassportId('?id='+id,''),id);
  assert.equal(queryPassportId('?odp=odp%3A%2F%2F'+id.toLowerCase(),''),id);
  for (const [query,hash] of [['?id='+id+'&secret=hidden',''],['?id='+id+'&id='+id,''],['?odp='+id+'&id='+id,''],['?id='+id,'#secret'],['?odp=ODP-2026-13-000000027',''],['?other='+id,'']]) {
    assert.equal(queryPassportId(query,hash),null);
  }
});
