const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const canonical = require('../js/odp-v07-canonical.js');
const passport = require('../js/odp-v07-passport.js');
const jobs = require('../js/odp-v07-job.js');
const backup = require('../js/odp-v07-job-backup.js');
const store = require('../js/odp-v07-job-store.js');
const issue = require('../js/odp-v07-issue.js');

async function fixture() {
  const document = structuredClone(require('./vectors/passport-0.7/physical.json'));
  const bytes = new TextEncoder().encode('photo'), hash = 'sha256:' + (await canonical.sha256(bytes)).slice(2);
  document.anchors.find(a => a.type === 'photo').hash = hash;
  const wallet = '0x'+'1'.repeat(40), profile = { wallet, creatorId:'C-123-456-789-012', typePrefix:'0x43' };
  const ethers = { utils:{ isAddress:() => true, defaultAbiCoder:{ encode:() => 'data' }, keccak256:() => '0x'+'2'.repeat(64), Interface:class { encodeFunctionData() { return '0x1234'; } decodeFunctionData() { return []; } } } };
  const abi = [], options = {abi,ethers}, job = await jobs.prepare({ document, originals:[{hash,bytes}], profile, wallet, ...options });
  const db = await store.open(new IDBFactory()); await store.save(db,job,options);
  const backupBytes = await backup.exportJob(job,options), calls = [];
  const ethereum = { request:async ({method}) => { calls.push(method); if (method === 'eth_chainId') return '0x89'; if (method === 'eth_accounts') return [wallet]; if (method === 'eth_getCode') return '0x'; if (method === 'eth_getBlockByNumber') return {timestamp:'0x'+document.registeredAt.toString(16)}; if (method === 'eth_estimateGas') return '0x1234'; if (method === 'eth_sendTransaction') return '0x'+'a'.repeat(64); throw Error('unexpected'); } };
  const reader = { readMintOperation:async () => ({state:'not-finalized'}), readProfileByWallet:async () => ({profile}) };
  const input = { db, operationId:job.identity.operationId, expectedFingerprint:job.fingerprint, backupBytes, reader, ethereum, wallet, locks:{request:async (_k,_o,fn)=>fn({})}, ...options };
  return { input, job, document, calls, options };
}
test('saved backed-up job is handed off once and never silently resent', async () => {
  const f = await fixture();
  assert.equal((await issue.send(f.input)).state, 'submitted');
  assert.equal((await store.get(f.input.db,f.input.operationId,f.options)).state, 'submitted');
  assert.equal((await issue.send(f.input)).state, 'unresolved');
  assert.equal(f.calls.filter(x => x === 'eth_sendTransaction').length, 1);
  f.input.db.close();
});
test('backup mismatch and uncertain wallet result cannot create another operation', async () => {
  const f = await fixture(), bad = f.input.backupBytes.slice(); bad[bad.length-1] ^= 1;
  await assert.rejects(issue.send({...f.input,backupBytes:bad}), /hash mismatch/);
  assert.equal(f.calls.includes('eth_sendTransaction'), false);
  const prior = f.input.ethereum.request;
  f.input.ethereum.request = async args => { if (args.method === 'eth_sendTransaction') throw Error('lost'); return prior(args); };
  assert.equal((await issue.send(f.input)).state, 'unresolved');
  assert.equal((await store.get(f.input.db,f.input.operationId,f.options)).state, 'handoff');
  assert.equal((await issue.send(f.input)).state, 'unresolved'); f.input.db.close();
});
test('committed operation is recovered only after passport integrity matches', async () => {
  const f = await fixture(), p = await passport.preparePassport(f.document), m = p.mint, id = 'ODP-2026-03-000000001';
  f.input.reader.readMintOperation = async () => ({state:'committed',passportId:id});
  f.input.reader.readPassport = async () => ({ header:{...m.core,creator:f.input.wallet,objectType:'physical'}, media:m, classification:{...m.core,revoked:false,timestamp:123} });
  assert.equal((await issue.send(f.input)).state, 'minted');
  assert.equal((await store.get(f.input.db,f.input.operationId,f.options)).passportId, id);
  assert.equal(f.calls.length, 0); f.input.db.close();
});

test('restored backups cannot reset or hide a possible wallet hand-off', async () => {
  const f = await fixture(), freshDb = await store.open(new IDBFactory());
  const imported = await store.importBackup(freshDb, f.job, f.options);
  assert.equal(imported.state, 'handoff');
  assert.equal((await issue.send({...f.input,db:freshDb})).state, 'unresolved');
  assert.equal(f.calls.includes('eth_sendTransaction'), false);
  const submitted = {...f.job,state:'submitted',transactionHash:'0x'+'a'.repeat(64)};
  const upgraded = await store.importBackup(f.input.db, submitted, f.options);
  assert.equal(upgraded.state,'submitted'); assert.equal(upgraded.transactionHash,submitted.transactionHash);
  assert.equal((await store.importBackup(f.input.db,f.job,f.options)).state,'submitted');
  await assert.rejects(store.importBackup(f.input.db,{...submitted,transactionHash:'0x'+'b'.repeat(64)},f.options),/conflicts/);
  freshDb.close(); f.input.db.close();
});

test('retry requires verified failure and no pending wallet transactions', async () => {
  const f=await fixture();
  await issue.send(f.input);
  f.input.reader.verifyFailedMint=async(hash,wallet,data)=>{assert.equal(hash,'0x'+'a'.repeat(64));assert.equal(wallet,f.input.wallet);assert.equal(data,f.job.calldata);};
  const original=f.input.ethereum.request;
  let pending='0x2';
  f.input.ethereum.request=async args=>args.method==='eth_getTransactionCount'?(args.params[1]==='pending'?pending:'0x1'):original(args);
  await assert.rejects(issue.recoverFailed(f.input),/pending transactions/);
  assert.equal((await store.get(f.input.db,f.input.operationId,f.options)).state,'submitted');
  pending='0x1';
  assert.equal((await issue.recoverFailed(f.input)).state,'prepared');
  const recovered=await store.get(f.input.db,f.input.operationId,f.options);
  assert.equal(recovered.identity.operationId,f.job.identity.operationId);
  assert.equal(recovered.calldata,f.job.calldata); assert.equal(recovered.transactionHash,undefined);
  f.input.db.close();
});

test('Safe proposal survives backup and remains pending or expires without resubmission', async () => {
  const f=await fixture(), wallet=f.input.wallet, profile={wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'};
  f.options.ethers.utils._TypedDataEncoder={hash:()=> '0x'+'b'.repeat(64)};
  f.options.ethers.utils.Interface=class {encodeFunctionData(){return '0x12345678';} decodeFunctionData(){return [];}};
  const original=await jobs.prepare({document:f.document,originals:f.job.originals,profile,wallet,...f.options});
  const db=await store.open(new IDBFactory());await store.save(db,original,f.options);
  await store.transition(db,original.identity.operationId,'prepared','handoff',null,f.options);
  const deadline=Date.UTC(f.document.year,f.document.month,1)/1000;
  const info={nonce:'2',safeTxHash:'0x'+'b'.repeat(64),deadline};
  const pending=await store.transition(db,original.identity.operationId,'handoff','safe_pending',{safeProposal:info},f.options);
  const restored=await backup.restore(await backup.exportJob(pending,f.options),f.options);
  assert.equal(restored.safeProposal.safeTxHash,info.safeTxHash);assert.equal(restored.safeProposal.nonce,info.nonce);assert.equal(restored.safeProposal.deadline,info.deadline);assert.equal(restored.state,'safe_pending');
  const newDb=await store.open(new IDBFactory());
  assert.equal((await store.importBackup(newDb,restored,f.options)).state,'safe_pending');
  const input={...f.input,db:newDb,operationId:original.identity.operationId,expectedFingerprint:original.fingerprint};
  assert.equal((await issue.send(input)).state,'safe_pending');
  const request=f.input.ethereum.request;
  input.ethereum={request:async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x'+deadline.toString(16)}:request(args)};
  assert.equal((await issue.send(input)).state,'safe_expired');
  assert.equal(f.calls.includes('eth_sendTransaction'),false);
  await assert.rejects(jobs.validate({...pending,safeProposal:{...info,safeTxHash:'0x'+'c'.repeat(64)}},f.options),/hash mismatch/);
  f.input.db.close();db.close();newDb.close();
});

test('Safe submission journals before hand-off and accepts only the exact proposal hash', async () => {
  const f=await fixture(), wallet=f.input.wallet, profile={wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'};
  f.options.ethers.utils._TypedDataEncoder={hash:()=> '0x'+'b'.repeat(64)};
  f.options.ethers.utils.Interface=class {encodeFunctionData(){return '0x12345678';} decodeFunctionData(){return [];}};
  const original=await jobs.prepare({document:f.document,originals:f.job.originals,profile,wallet,...f.options});
  const db=await store.open(new IDBFactory());await store.save(db,original,f.options);
  const bytes=await backup.exportJob(original,f.options);let sends=0,returned='0x'+'b'.repeat(64);
  const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:7})},txs:{send:async request=>{sends++;assert.equal((await store.get(db,original.identity.operationId,f.options)).state,'handoff');assert.equal(request.params.safeTxGas,0);return {safeTxHash:returned};}}};
  const args={...f.input,db,operationId:original.identity.operationId,expectedFingerprint:original.fingerprint,backupBytes:bytes,sdk,reader:{...f.input.reader,readProfileByWallet:async()=>({profile})}};
  assert.equal((await issue.sendSafe(args)).state,'safe_pending');
  const saved=await store.get(db,original.identity.operationId,f.options);assert.equal(saved.safeProposal.nonce,'7');assert.equal(saved.safeProposal.safeTxHash,returned);assert.equal(saved.transactionHash,undefined);
  await assert.rejects(issue.sendSafe(args),/Invalid Safe issuance job/);assert.equal(sends,1);
  const db2=await store.open(new IDBFactory());await store.save(db2,original,f.options);returned='0x'+'c'.repeat(64);
  assert.equal((await issue.sendSafe({...args,db:db2})).state,'unresolved');assert.equal((await store.get(db2,original.identity.operationId,f.options)).state,'handoff');
  f.input.db.close();db.close();db2.close();
});

test('Safe proposal blocks a changed nonce and never treats a C profile as multisig', async () => {
  const f=await fixture(), wallet=f.input.wallet, profile={wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'};
  f.options.ethers.utils._TypedDataEncoder={hash:()=> '0x'+'b'.repeat(64)};
  f.options.ethers.utils.Interface=class {encodeFunctionData(){return '0x12345678';} decodeFunctionData(){return [];}};
  const original=await jobs.prepare({document:f.document,originals:f.job.originals,profile,wallet,...f.options}),db=await store.open(new IDBFactory());
  await store.save(db,original,f.options);const bytes=await backup.exportJob(original,f.options);let nonce=0,sends=0;
  const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:nonce++})},txs:{send:async()=>{sends++;}}};
  const args={...f.input,db,operationId:original.identity.operationId,expectedFingerprint:original.fingerprint,backupBytes:bytes,sdk,reader:{...f.input.reader,readProfileByWallet:async()=>({profile})}};
  await assert.rejects(issue.sendSafe(args),/nonce changed/);assert.equal(sends,0);assert.equal((await store.get(db,original.identity.operationId,f.options)).state,'prepared');
  const personal=await jobs.prepare({document:f.document,originals:f.job.originals,profile:{wallet,creatorId:'C-123-456-789-012',typePrefix:'0x43'},wallet,...f.options});
  const personalDb=await store.open(new IDBFactory());await store.save(personalDb,personal,f.options);
  await assert.rejects(issue.sendSafe({...args,db:personalDb,operationId:personal.identity.operationId,expectedFingerprint:personal.fingerprint}),/Invalid Safe issuance job/);
  assert.equal(sends,0);f.input.db.close();db.close();personalDb.close();
});

test('expired Safe mint proposes one same-nonce rejection and backs it up', async () => {
  const f=await fixture(),wallet=f.input.wallet,profile={wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'};
  f.options.ethers.utils._TypedDataEncoder={hash:(_domain,_types,tx)=>'0x'+(tx.data==='0x'?'c':'b').repeat(64)};
  f.options.ethers.utils.Interface=class{encodeFunctionData(){return '0x12345678';} decodeFunctionData(){return [];}};
  const job=await jobs.prepare({document:f.document,originals:f.job.originals,profile,wallet,...f.options}),db=await store.open(new IDBFactory());
  await store.save(db,job,f.options);await store.transition(db,job.identity.operationId,'prepared','handoff',null,f.options);
  const deadline=Date.UTC(f.document.year,f.document.month,1)/1000,proposal={nonce:'7',safeTxHash:'0x'+'b'.repeat(64),deadline};
  await store.transition(db,job.identity.operationId,'handoff','safe_pending',{safeProposal:proposal},f.options);
  let sends=0;const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:7})},txs:{send:async req=>{sends++;assert.equal(req.txs[0].to,wallet);assert.equal(req.txs[0].data,'0x');assert.equal((await store.get(db,job.identity.operationId,f.options)).safeRejection.state,'before-wallet');return {safeTxHash:'0x'+'c'.repeat(64)};}}};
  const old=f.input.ethereum.request,ethereum={request:async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x'+deadline.toString(16)}:old(args)};
  const args={...f.input,db,operationId:job.identity.operationId,expectedFingerprint:job.fingerprint,sdk,ethereum};
  assert.equal((await issue.rejectExpiredSafe(args)).state,'safe_rejection_pending');
  await assert.rejects(issue.rejectExpiredSafe(args),/already requested/);assert.equal(sends,1);
  const updated=await store.get(db,job.identity.operationId,f.options),restored=await backup.restore(await backup.exportJob(updated,f.options),f.options);
  assert.equal(restored.safeRejection.state,'pending');assert.equal(restored.safeRejection.safeTxHash,'0x'+'c'.repeat(64));assert.equal(restored.safeProposal.nonce,'7');
  assert.equal((await issue.send(args)).state,'safe_rejection_pending');
  f.input.db.close();db.close();
});

test('re-preparation needs finalized Safe cancellation and preserves operation and old job',async()=>{
  const f=await fixture(),wallet=f.input.wallet,profile={wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'};
  f.options.ethers.utils._TypedDataEncoder={hash:(_d,_t,tx)=>'0x'+(tx.data==='0x'?'c':'b').repeat(64)};
  f.options.ethers.utils.Interface=class{encodeFunctionData(){return '0x12345678';}decodeFunctionData(){return [];}};
  const job=await jobs.prepare({document:f.document,originals:f.job.originals,profile,wallet,...f.options}),db=await store.open(new IDBFactory());
  await store.save(db,job,f.options);await store.transition(db,job.identity.operationId,'prepared','handoff',null,f.options);
  const deadline=Date.UTC(f.document.year,f.document.month,1)/1000;
  await store.transition(db,job.identity.operationId,'handoff','safe_pending',{safeProposal:{nonce:'7',safeTxHash:'0x'+'b'.repeat(64),deadline}},f.options);
  await store.transition(db,job.identity.operationId,'safe_pending','safe_pending',{safeRejection:{state:'before-wallet',safeTxHash:'0x'+'c'.repeat(64)}},f.options);
  await store.transition(db,job.identity.operationId,'safe_pending','safe_pending',{safeRejection:{state:'pending',safeTxHash:'0x'+'c'.repeat(64)}},f.options);
  let verified=false;const reader={readMintOperation:async()=>({state:'not-finalized'}),readProfileByWallet:async()=>({profile}),verifySafeRejection:async(tx,safe,hash)=>{assert.equal(tx,'0x'+'d'.repeat(64));assert.equal(safe,wallet);assert.equal(hash,'0x'+'c'.repeat(64));verified=true;}};
  const old=f.input.ethereum.request,ethereum={request:async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x'+deadline.toString(16)}:old(args)};
  const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:8})}};
  const args={...f.input,db,operationId:job.identity.operationId,expectedFingerprint:job.fingerprint,transactionHash:'0x'+'d'.repeat(64),reader,ethereum,sdk};
  assert.equal((await issue.reprepareAfterSafeRejection(args)).state,'prepared');assert.equal(verified,true);
  const fresh=await store.get(db,job.identity.operationId,f.options);assert.equal(fresh.identity.operationId,job.identity.operationId);assert.notEqual(fresh.fingerprint,job.fingerprint);
  assert.equal(canonical.parseJSON(fresh.canonicalPassport).registeredAt,deadline);
  const archived=await new Promise((resolve,reject)=>{const tx=db.transaction('history','readonly'),r=tx.objectStore('history').get(job.identity.operationId+':'+job.fingerprint);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  assert.equal(archived.safeRejection.state,'pending');assert.equal(archived.fingerprint,job.fingerprint);
  await assert.rejects(issue.reprepareAfterSafeRejection(args),/job changed/);
  f.input.db.close();db.close();
});

test('restored unsent job requires a matching backup, EOA, empty node queue and absent operation',async()=>{
  const f=await fixture(),db=await store.open(new IDBFactory());await store.importBackup(db,f.job,f.options);
  let pending='0x2',code='0x',state='not-finalized';const previous=f.input.ethereum.request;
  const ethereum={request:async args=>args.method==='eth_getTransactionCount'?(args.params[1]==='pending'?pending:'0x1'):args.method==='eth_getCode'?code:previous(args)};
  const reader={...f.input.reader,readMintOperation:async()=>({state})},args={...f.input,db,ethereum,reader};
  await assert.rejects(issue.recoverUnsent(args),/pending transaction/);pending='0x1';code='0x1234';
  await assert.rejects(issue.recoverUnsent(args),/pending transaction/);code='0x';state='committed';
  await assert.rejects(issue.recoverUnsent(args),/pending transaction/);state='not-finalized';
  const bad=f.input.backupBytes.slice();bad[bad.length-1]^=1;await assert.rejects(issue.recoverUnsent({...args,backupBytes:bad}));
  assert.equal((await issue.recoverUnsent(args)).state,'prepared');
  const recovered=await store.get(db,f.input.operationId,f.options);assert.equal(recovered.identity.operationId,f.job.identity.operationId);assert.equal(recovered.fingerprint,f.job.fingerprint);
  assert.equal(f.calls.includes('eth_sendTransaction'),false);f.input.db.close();db.close();
});
