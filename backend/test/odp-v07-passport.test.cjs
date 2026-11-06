const { test } = require('node:test');
const assert = require('node:assert/strict');
const passport = require('../js/odp-v07-passport.js');

test('published unique passport hashes match canonical protocol vectors', async () => {
  for (const name of ['physical', 'physical-preview', 'digital', 'mixed']) {
    const doc = require('./vectors/passport-canonical/' + name + '.passport.json');
    const expected = require('./vectors/passport-canonical/' + name + '.expected.json');
    const prepared = await passport.preparePassport(doc, { issuerType: 'C' });
    assert.equal(prepared.mint.dataHash, expected.dataHash, name);
    assert.equal(prepared.mint.anchorsHash, expected.anchorsHash, name);
    if (expected.previewHash) assert.equal(prepared.mint.previewHash, expected.previewHash);
  }
});
test('card, classification and media must match the on-chain record', async () => {
  const doc = require('./vectors/passport-canonical/physical.passport.json');
  const p = await passport.preparePassport(doc), m = p.mint;
  const header = { ...m.core, objectType: doc.objectType, creator: '0x' + '1'.repeat(40) };
  const classification = { ...m.core, revoked: false, timestamp: 123 };
  assert.equal((await passport.verifyPassport(doc, header, m, classification)).integrity, true);
  await assert.rejects(passport.verifyPassport(doc, { ...header, title: 'other' }, m, classification), /Card mismatch/);
  await assert.rejects(passport.verifyPassport(doc, header, { ...m, dataHash: '0x' + '0'.repeat(64) }, classification), /Hash mismatch/);
  await assert.rejects(passport.verifyPassport(doc, header, m, { ...classification, editionModel: 2 }), /Classification mismatch/);
});
