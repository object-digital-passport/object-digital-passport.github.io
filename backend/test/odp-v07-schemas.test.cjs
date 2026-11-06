const { test } = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../js/odp-v07-schemas.bundle.js');
const generation = require('../config/odp-0.7/generation.json');

test('published passport examples and approved generation satisfy the 0.7 schemas', () => {
  for (const name of ['physical', 'digital', 'mixed', 'edition']) {
    const value = require('./vectors/passport-0.7/' + name + '.json');
    assert.equal(schemas.passport(value), true, name + ': ' + JSON.stringify(schemas.passport.errors));
  }
  assert.equal(schemas.generation(generation), true, JSON.stringify(schemas.generation.errors));
});
test('schema rejects incomplete passports and extra receipt fields', () => {
  assert.equal(schemas.passport({ version: '0.7', passportId: null }), false);
  assert.equal(schemas.receipt({ format: 'odp-bundle-receipt-0.7', extra: 1 }), false);
});
