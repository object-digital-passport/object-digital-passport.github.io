const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyAddressList } = require('../js/odp-v07-edition.js');
const canonical = require('../js/odp-v07-canonical.js');
const vectors = require('./vectors/edition-units.json');

test('address list rebuilds published odd-node tree and rejects changed order', async () => {
  const enc = new TextEncoder(), addresses = vectors.units.map(u => u.unitAddress.toLowerCase());
  const bytes = enc.encode(addresses.join('\n') + '\n');
  const context = { addressListHash: 'sha256:' + (await canonical.sha256(bytes)).slice(2), unitCount: addresses.length, merkleRoot: 'sha256:' + vectors.merkleRoot.slice(2) };
  assert.equal((await verifyAddressList(bytes, context)).integrity, 'verified');
  const swapped = enc.encode([addresses[1], addresses[0], ...addresses.slice(2)].join('\n') + '\n');
  const changed = { ...context, addressListHash: 'sha256:' + (await canonical.sha256(swapped)).slice(2) };
  await assert.rejects(verifyAddressList(swapped, changed), /Merkle root mismatch/);
  await assert.rejects(verifyAddressList(bytes.subarray(0, bytes.length - 1), context), /length/);
  const duplicate = enc.encode([addresses[0], addresses[0], ...addresses.slice(2)].join('\n') + '\n');
  await assert.rejects(verifyAddressList(duplicate, { ...context, addressListHash: 'sha256:' + (await canonical.sha256(duplicate)).slice(2) }), /Duplicate/);
});
