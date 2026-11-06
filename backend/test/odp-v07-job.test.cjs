const { test } = require('node:test');
const assert = require('node:assert/strict');
const job = require('../js/odp-v07-job.js');
const canonical = require('../js/odp-v07-canonical.js');

async function fixture(type) {
  const document = structuredClone(require('./vectors/passport-0.7/' + type + '.json'));
  const bytes = new TextEncoder().encode('local original'), hash = 'sha256:' + (await canonical.sha256(bytes)).slice(2);
  const relevant = document.anchors.find(a => a.type === (type === 'digital' ? 'file_hash' : 'photo'));
  relevant.hash = hash;
  if (type === 'digital' || type === 'mixed') {
    document.anchors.find(a => a.type === 'file_hash').hash = hash;
    document.digital.fileHash = hash; document.digital.fileSize = bytes.length;
  }
  const wallet = '0x'+'1'.repeat(40), profile = { wallet, creatorId:'C-123-456-789-012', typePrefix:'0x43' };
  const ethers = { utils:{ isAddress:() => true, defaultAbiCoder:{ encode:() => 'data' }, keccak256:() => '0x'+'2'.repeat(64), Interface:class { encodeFunctionData() { return '0x1234'; } } } };
  return { document, originals:[{hash,bytes}], profile, wallet, abi:[], ethers };
}
test('job snapshots canonical data and verified originals before signing', async () => {
  for (const type of ['physical','digital','mixed']) {
    const f = await fixture(type), result = await job.prepare(f);
    assert.equal(result.state, 'prepared'); assert.equal(result.identity.creatorId, f.profile.creatorId);
    assert.match(result.identity.operationId, /^0x[0-9a-f]{64}$/);
    assert.match(result.fingerprint, /^0x[0-9a-f]{64}$/);
    assert.equal((await job.validate(result, f)).fingerprint, result.fingerprint);
    await assert.rejects(job.validate({ ...result, calldata:'0xdead' }, f), /changed/);
    f.originals[0].bytes[0] ^= 1;
    assert.notEqual(f.originals[0].bytes[0], result.originals[0].bytes[0]);
  }
});
test('job refuses missing or modified originals, wrong issuer and inconsistent file size', async () => {
  const f = await fixture('digital');
  await assert.rejects(job.prepare({ ...f, originals:[] }), /Required original missing/);
  await assert.rejects(job.prepare({ ...f, profile:{ ...f.profile, wallet:'0x'+'2'.repeat(40) } }), /issuer profile/);
  f.document.digital.fileSize++;
  await assert.rejects(job.prepare(f), /file size/);
  f.document.digital.fileSize--; f.originals[0].bytes[0] ^= 1;
  await assert.rejects(job.prepare(f), /hash mismatch/);
});
