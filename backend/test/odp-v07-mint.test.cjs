const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepare } = require('../js/odp-v07-mint.js');
const word = n => '0x' + n.repeat(64);
function fixture() {
  const mint = { core: { editionModel: 1 }, dataHash: word('1'), imageHash: word('2'), previewHash: word('0'), fileHash: word('0'), anchorsHash: word('3'), anchorTypesMask: 1, editionCommitment: word('0') };
  const seen = {};
  const ethers = { utils: { isAddress: () => true, defaultAbiCoder: { encode(types, values) { seen.types = types; seen.values = values; return 'encoded'; } }, keccak256: () => word('a'), Interface: class { encodeFunctionData(method, args) { seen.method = method; seen.args = args; return 'calldata'; } } } };
  return { input: { issuer: '0x' + '1'.repeat(40), objectType: 'physical', mint, operationId: word('4'), abi: [], ethers }, seen };
}
test('mint plan binds the exact operation to chain, registry, issuer, type and calldata', () => {
  const { input, seen } = fixture(), result = prepare(input);
  assert.deepEqual(seen.values.slice(0, 5), ['ODP-MINT-OPERATION-0.7', 137, result.registry, input.issuer, 'physical']);
  assert.equal(seen.values[5], input.mint);
  assert.equal(seen.method, 'mintPhysical');
  assert.equal(seen.args[1], input.operationId);
  assert.equal(result.digest, word('a'));
});
test('rejects editions, missing media and invalid operation identities', () => {
  const { input } = fixture();
  assert.throws(() => prepare({ ...input, operationId: word('0') }), /operation ID/);
  input.mint.core.editionModel = 2;
  assert.throws(() => prepare(input), /unique/);
  input.mint.core.editionModel = 1; input.mint.imageHash = word('0');
  assert.throws(() => prepare(input), /Missing required hash/);
  input.mint.imageHash = word('2'); input.mint.previewHash = word('2');
  assert.throws(() => prepare(input), /preview/);
});
