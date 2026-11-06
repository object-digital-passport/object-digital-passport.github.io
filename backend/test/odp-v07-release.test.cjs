const { test } = require('node:test');
const assert = require('node:assert/strict');
const release = require('../js/odp-v07-release.js');
const { REGISTRY } = require('../js/odp-v07-reader.js');
function fixture() {
  const wallet = '0x' + '1'.repeat(40), passportId = 'ODP-2026-09-000000001', journal = new Map(), calls = [];
  const record = { chainId:137, registry:REGISTRY, blockTimestamp:1000, blockNumber:100, header:{ passportId, creator:wallet }, classification:{ revoked:false }, release:{ printFinalizedAt:0, revocationDeadline:1100 } };
  const ethers = { utils:{ isAddress:x => x === wallet, Interface:class { encodeFunctionData(method,args) { calls.push([method,args]); return '0x1234'; } } } };
  const ethereum = { request:async ({method}) => { calls.push(method); if (method === 'eth_chainId') return '0x89'; if (method === 'eth_accounts') return [wallet]; if (method === 'eth_estimateGas') return '0x1234'; if (method === 'eth_sendTransaction') { assert.equal(journal.size,1); return '0x'+'a'.repeat(64); } throw Error('unexpected'); } };
  const storage = { getItem:k => journal.has(k) ? journal.get(k) : null, setItem:(k,v) => journal.set(k,v), removeItem:k => journal.delete(k) };
  return { record, calls, journal, input:{ action:'revoke', passportId, reasonHash:'0x'+'1'.repeat(64), wallet, reader:{ readPassport:async()=>record }, ethereum, storage, locks:{ request:async (_k,_o,fn)=>fn({}) }, abi:[], ethers } };
}
test('preflight enforces issuer, status, deadline and nonzero reason', () => {
  const f = fixture(), args = { ...f.input, record:f.record };
  assert.equal(release.prepare(args).state, 'ready');
  assert.equal(f.calls[0][0], 'revokePassport');
  assert.throws(() => release.prepare({ ...args, wallet:'0x'+'2'.repeat(40) }), /Invalid release context/);
  assert.throws(() => release.prepare({ ...args, reasonHash:'0x'+'0'.repeat(64) }), /reason/);
  f.record.blockTimestamp = 1101; assert.equal(release.prepare(args).state, 'expired');
  f.record.blockTimestamp = 1000; f.record.release.printFinalizedAt = 100; assert.equal(release.prepare(args).state, 'finalized');
  assert.equal(release.prepare({ ...args, action:'finalize' }).state, 'completed');
  f.record.classification.revoked = true; assert.equal(release.prepare({ ...args, action:'finalize' }).state, 'revoked');
});
test('journal serializes revocation and finalization across uncertain hand-off', async () => {
  const f = fixture();
  assert.equal((await release.send(f.input)).state, 'submitted');
  assert.equal((await release.send({ ...f.input, action:'finalize' })).state, 'unresolved');
  assert.equal(f.calls.filter(x => x === 'eth_sendTransaction').length, 1);
  f.record.classification.revoked = true;
  assert.equal((await release.send(f.input)).state, 'completed');
});

test('Safe release distinguishes awaiting signatures from expired revocation', async () => {
  const f=fixture(),wallet=f.input.wallet,hash='0x'+'b'.repeat(64);let sent=0;
  f.record.header.creatorId='B-123-456-789-012';
  f.input.ethers.utils.Interface=class{encodeFunctionData(){return '0x12345678';}};f.input.ethers.utils._TypedDataEncoder={hash:()=>hash};
  const prior=f.input.ethereum.request;f.input.ethereum.request=async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x3e8'}:prior(args);
  f.input.sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:8})},txs:{send:async()=>{sent++;return {safeTxHash:hash};}}};
  assert.equal((await release.sendSafe(f.input)).state,'safe_pending');
  assert.equal((await release.sendSafe(f.input)).state,'safe_pending');
  f.record.blockTimestamp=1101;assert.equal((await release.sendSafe(f.input)).state,'safe_expired');assert.equal(sent,1);
});

test('expired Safe revocation can propose a same-nonce rejection only once', async () => {
  const f=fixture(),wallet=f.input.wallet,mintHash='0x'+'b'.repeat(64),rejectHash='0x'+'c'.repeat(64);let sent=0,now=1000;
  f.record.header.creatorId='B-123-456-789-012';
  f.input.ethers.utils.Interface=class{encodeFunctionData(){return '0x12345678';}decodeFunctionData(){return [f.input.passportId,f.input.reasonHash];}};
  f.input.ethers.utils._TypedDataEncoder={hash:(_domain,_types,tx)=>tx.data==='0x'?rejectHash:mintHash};
  const prior=f.input.ethereum.request;f.input.ethereum.request=async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x'+now.toString(16)}:prior(args);
  f.input.sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:8})},txs:{send:async req=>{sent++;return {safeTxHash:req.txs[0].data==='0x'?rejectHash:mintHash};}}};
  assert.equal((await release.sendSafe(f.input)).state,'safe_pending');assert.equal((await release.safeStatus(f.input)).state,'safe_pending');
  await assert.rejects(release.rejectExpiredSafe(f.input),/not eligible/);
  now=1101;assert.equal((await release.safeStatus(f.input)).state,'safe_expired');
  assert.equal((await release.rejectExpiredSafe(f.input)).state,'safe_rejection_pending');
  assert.equal((await release.safeStatus(f.input)).state,'safe_rejection_pending');
  await assert.rejects(release.rejectExpiredSafe(f.input),/not eligible/);assert.equal(sent,2);
});
