const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const jobTools = require('../js/odp-v07-job.js');
const store = require('../js/odp-v07-job-store.js');
const canonical = require('../js/odp-v07-canonical.js');

test('stores and revalidates a whole job, rejects replacement and detects tampering', async () => {
  const document = structuredClone(require('./vectors/passport-0.7/physical.json'));
  const bytes = new TextEncoder().encode('photo'), hash = 'sha256:' + (await canonical.sha256(bytes)).slice(2);
  document.anchors.find(a => a.type === 'photo').hash = hash;
  const wallet = '0x'+'1'.repeat(40), profile = { wallet, creatorId:'C-123-456-789-012', typePrefix:'0x43' };
  const ethers = { utils:{ isAddress:() => true, defaultAbiCoder:{ encode:() => 'data' }, keccak256:() => '0x'+'2'.repeat(64), Interface:class { encodeFunctionData() { return '0x1234'; } } } };
  const options = { abi:[], ethers }, job = await jobTools.prepare({ document, originals:[{hash,bytes}], profile, wallet, ...options });
  const db = await store.open(new IDBFactory());
  const saved = await store.save(db, job, options), id = saved.identity.operationId;
  const transitions = await Promise.allSettled([store.transition(db,id,'prepared','handoff',null,options), store.transition(db,id,'prepared','handoff',null,options)]);
  assert.equal(transitions.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await store.get(db,id,options)).state, 'handoff');
  await store.transition(db,id,'handoff','submitted',{transactionHash:'0x'+'a'.repeat(64)},options);
  assert.equal((await store.get(db,id,options)).state, 'submitted');
  await assert.rejects(store.transition(db,id,'submitted','handoff',null,options), /Invalid job state transition/);
  job.originals[0].bytes[0] ^= 1;
  assert.equal((await store.get(db, id, options)).originals[0].bytes[0], bytes[0]);
  await assert.rejects(store.save(db, saved, options));
  await new Promise((resolve, reject) => { const tx = db.transaction('jobs','readwrite'); saved.calldata='0xdead'; tx.objectStore('jobs').put(saved,id); tx.oncomplete=resolve; tx.onabort=()=>reject(tx.error); });
  await assert.rejects(store.get(db,id,options), /changed/);
  db.close();
});
