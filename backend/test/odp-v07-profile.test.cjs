const { test } = require('node:test');
const assert = require('node:assert/strict');
const { prepareRegistration, register } = require('../js/odp-v07-profile.js');
const { REGISTRY } = require('../js/odp-v07-reader.js');

test('registration encodes all four roles for the pinned registry', () => {
  let actual;
  const ethers = { utils: { Interface: class { encodeFunctionData(name, args) { actual = { name, args }; return 'calldata'; } } } };
  for (const role of ['C', 'B', 'P', 'M']) {
    const plan = prepareRegistration(role, [], ethers);
    assert.equal(plan.to, REGISTRY); assert.equal(plan.chainId, 137);
    assert.deepEqual(actual, { name: 'registerCreator', args: ['0x' + role.charCodeAt(0).toString(16)] });
  }
  assert.throws(() => prepareRegistration('X', [], ethers), /Invalid/);
});

function setup() {
  const wallet = '0x' + '1'.repeat(40), journal = new Map(), requests = [];
  const storage = { getItem: k => journal.has(k) ? journal.get(k) : null, setItem: (k,v) => journal.set(k,v), removeItem: k => journal.delete(k) };
  const locks = { request: async (_key, _options, fn) => fn({}) };
  const ethers = { utils: { isAddress: a => a === wallet, Interface: class { encodeFunctionData() { return '0x1234'; } } } };
  const ethereum = { request: async ({ method }) => { requests.push(method); if (method === 'eth_chainId') return '0x89'; if (method === 'eth_accounts') return [wallet]; if (method === 'eth_getCode') return '0x'; if (method === 'eth_estimateGas') return '0x1234'; if (method === 'eth_sendTransaction') return '0x' + 'a'.repeat(64); throw Error('unexpected'); } };
  const input = { role: 'C', wallet, ethereum, reader: { readProfileByWallet: async () => ({ profile: null }) }, storage, locks, abi: [], ethers };
  return { input, journal, requests };
}
test('journals before wallet hand-off and blocks a second uncertain registration', async () => {
  const { input, journal, requests } = setup();
  const send = input.ethereum.request;
  input.ethereum.request = async args => { if (args.method === 'eth_sendTransaction') assert.equal(journal.size, 1); return send(args); };
  assert.equal((await register(input)).state, 'submitted');
  assert.equal((await register(input)).state, 'unresolved');
  assert.equal(requests.filter(x => x === 'eth_sendTransaction').length, 1);
});
test('preflight or journal failures never prompt a transaction; unknown outcome stays blocked', async () => {
  const f = setup(); f.input.storage.setItem = () => { throw Error('disk'); };
  await assert.rejects(register(f.input), /journal unavailable/);
  assert.equal(f.requests.includes('eth_sendTransaction'), false);
  const g = setup(), prior = g.input.ethereum.request;
  g.input.ethereum.request = async args => { if (args.method === 'eth_sendTransaction') throw Error('connection lost'); return prior(args); };
  assert.equal((await register(g.input)).state, 'unresolved');
  assert.equal(g.journal.size, 1);
  assert.equal((await register(g.input)).state, 'unresolved');
});
test('explicit rejection clears journal; wrong chain or occupied lock never sends', async () => {
  const f = setup(), prior = f.input.ethereum.request;
  f.input.ethereum.request = async args => { if (args.method === 'eth_sendTransaction') throw Object.assign(Error('rejected'), { code: 4001 }); return prior(args); };
  assert.equal((await register(f.input)).state, 'rejected'); assert.equal(f.journal.size, 0);
  const g = setup(); g.input.locks.request = async (_key, _options, fn) => fn(null);
  await assert.rejects(register(g.input), /already in progress/);
  const h = setup(); h.input.ethereum.request = async ({ method }) => method === 'eth_chainId' ? '0x1' : [h.input.wallet];
  await assert.rejects(register(h.input), /network changed/);
  const i = setup(), previous = i.input.ethereum.request;
  i.input.ethereum.request = async args => args.method === 'eth_getCode' ? '0x1234' : previous(args);
  await assert.rejects(register(i.input), /externally owned/);
  assert.equal(i.requests.includes('eth_sendTransaction'), false);
});

test('Safe registration journals proposal and does not submit C or duplicate B', async () => {
  const f=setup(),wallet=f.input.wallet,hash='0x'+'b'.repeat(64);let sent=0;
  f.input.role='B';f.input.ethers.utils.Interface=class{encodeFunctionData(){return '0x12345678';}};f.input.ethers.utils._TypedDataEncoder={hash:()=>hash};
  const prior=f.input.ethereum.request;f.input.ethereum.request=async args=>args.method==='eth_getBlockByNumber'?{timestamp:'0x3e8'}:prior(args);
  f.input.sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:3})},txs:{send:async()=>{sent++;assert.equal(f.journal.size,1);return {safeTxHash:hash};}}};
  const registerSafe=require('../js/odp-v07-profile.js').registerSafe;
  await assert.rejects(registerSafe({...f.input,role:'C'}),/Invalid Safe/);
  assert.equal((await registerSafe(f.input)).state,'safe_pending');
  assert.equal((await registerSafe(f.input)).state,'safe_pending');assert.equal(sent,1);
});
