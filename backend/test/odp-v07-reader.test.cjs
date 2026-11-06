const assert = require('node:assert/strict');
const { test } = require('node:test');
const reader = require('../js/odp-v07-reader.js');
const generation = require('../config/odp-0.7/generation.json');
const registryABI = require('../config/odp-0.7/ObjectDigitalPassport.json');

test('bundled registry and ABI match the pinned generation', () => {
  assert.equal(generation.chainId, String(reader.CHAIN_ID));
  assert.equal(generation.registry, reader.REGISTRY);
  assert.equal(generation.registryRuntimeCodeHash, reader.RUNTIME_HASH);
  assert.equal(generation.abiGeneration, '0.7-redesign-8');
  assert.equal(generation.satellites.length, 9);
  assert.ok(generation.satellites.every(s => s.abiGeneration === generation.abiGeneration));
  const event = registryABI.find(x => x.type === 'event' && x.name === 'PassportMinted');
  assert.deepEqual(event.inputs.filter(x => x.indexed).map(x => x.name), ['passportId', 'creator']);
  assert.equal(event.inputs.at(-1).name, 'operationId');
  for (const name of ['getPassportHeader', 'getPassportClassification', 'getPassportMedia', 'getPassportReleaseState']) {
    assert.ok(registryABI.some(x => x.type === 'function' && x.name === name));
  }
});

function fixture() {
  const calls = [];
  let network = 137, hash = reader.RUNTIME_HASH, responseId = 'C-1';
  const blockHash = '0x' + 'd'.repeat(64);
  const provider = { getNetwork: async () => ({ chainId: network }),
    send: async () => ({ number: '0x64', hash: blockHash }),
    getBlock: async number => ({ number, hash: blockHash, timestamp: 1000 }),
    getCode: async (address, block) => { calls.push(['code', address, block]); return '0x1234'; } };
  const ethers = { utils: { keccak256: () => hash }, Contract: class {
    async CONTRACT_VERSION() { return 7; }
    async getPassportHeader(id, opt) { calls.push(['header', id, opt.blockTag]); return { passportId: responseId, contractVersion: 7 }; }
    async getPassportClassification(id, opt) { calls.push(['classification', id, opt.blockTag]); return { revoked: false }; }
    async getPassportMedia(id, opt) { calls.push(['media', id, opt.blockTag]); return {}; }
    async getPassportReleaseState(id, opt) { calls.push(['release', id, opt.blockTag]); return {}; }
  } };
  return { provider, ethers, calls, setNetwork: v => network = v, setHash: v => hash = v, setId: v => responseId = v };
}

test('pins network and deployed bytecode', async () => {
  const f = fixture();
  f.setNetwork(1);
  await assert.rejects(reader.open(f.provider, [], f.ethers), /Wrong network/);
  f.setNetwork(137); f.setHash('0x00');
  await assert.rejects(reader.open(f.provider, [], f.ethers), /code does not match/);
});

test('refuses an unavailable or inconsistent finalized snapshot', async () => {
  const f = fixture();
  f.provider.send = async () => null;
  await assert.rejects(reader.open(f.provider, [], f.ethers), /Finalized block unavailable/);
  f.provider.send = async () => ({ number: '0x64', hash: '0x' + 'd'.repeat(64) });
  f.provider.getBlock = async () => ({ number: 100, hash: '0x' + 'e'.repeat(64) });
  await assert.rejects(reader.open(f.provider, [], f.ethers), /Finalized block changed/);
});

test('reads a consistent snapshot and rejects a mismatched record', async () => {
  const f = fixture(), client = await reader.open(f.provider, [], f.ethers);
  const result = await client.readPassport(' C-1 ');
  assert.equal(result.blockNumber, 100);
  assert.deepEqual(f.calls.slice(1).map(x => x[2]), [100, 100, 100, 100]);
  assert.equal(result.registry, reader.REGISTRY);
  f.setId('other');
  await assert.rejects(client.readPassport('C-1'), /Invalid passport response/);
  await assert.rejects(client.readPassport(' '), /required/);
});

test('edition reads are bound to the approved satellite and finalized snapshot', async () => {
  const f = fixture(), satellite = generation.satellites.find(x => x.role === 'edition-units');
  const Original = f.ethers.Contract;
  f.provider.getCode = async address => address === reader.REGISTRY ? 'registry-code' : 'edition-code';
  f.ethers.utils.keccak256 = code => code === 'registry-code' ? reader.RUNTIME_HASH : satellite.runtimeCodeHash;
  f.ethers.Contract = class extends Original {
    constructor(address) {
      super();
      if (address === satellite.address) return {
        odpRegistry: async () => reader.REGISTRY,
        getEdition: async (_id, options) => { assert.equal(options.blockTag, 100); return { open: true, unitCount: 2 }; },
        getActivation: async (_id, index, options) => { assert.equal(options.blockTag, 100); return { timestamp: 42, unitAddress: String(index) }; },
      };
    }
    async getPassportClassification() { return { editionModel: 2 }; }
    async getPassportMedia() { return { anchorTypesMask: 4096 }; }
  };
  const client = await reader.open(f.provider, [], f.ethers);
  const result = await client.readEdition('C-1', [], 1);
  assert.equal(result.activation.timestamp, 42);
  await assert.rejects(client.readEdition('C-1', [], 2), /outside/);
  await assert.rejects(client.readEdition('C-1', [], -1), /Invalid unit index/);
  f.ethers.utils.keccak256 = code => code === 'registry-code' ? reader.RUNTIME_HASH : '0x00';
  await assert.rejects(client.readEdition('C-1', [], 0), /code does not match/);
});

test('mint reconciliation distinguishes absent, committed and conflicting operations', async () => {
  const f = fixture(), issuer = '0x' + '1'.repeat(40), op = '0x' + '2'.repeat(64), digest = '0x' + '3'.repeat(64);
  let result = { digest: '0x' + '0'.repeat(64), passportId: '' };
  f.ethers.utils.isAddress = x => x === issuer;
  const Original = f.ethers.Contract;
  f.ethers.Contract = class extends Original {
    async getMintOperation(address, operation, options) {
      assert.equal(address, issuer); assert.equal(operation, op); assert.equal(options.blockTag, 100); return result;
    }
  };
  const client = await reader.open(f.provider, [], f.ethers);
  assert.equal((await client.readMintOperation(issuer, op, digest)).state, 'not-finalized');
  result = { digest, passportId: 'ODP-2026-09-000000001' };
  assert.equal((await client.readMintOperation(issuer, op, digest)).state, 'committed');
  result = { ...result, digest: '0x' + '4'.repeat(64) };
  assert.equal((await client.readMintOperation(issuer, op, digest)).state, 'conflict');
  result = { digest, passportId: '' };
  await assert.rejects(client.readMintOperation(issuer, op, digest), /Invalid mint operation response/);
  await assert.rejects(client.readMintOperation(issuer, '0x' + '0'.repeat(64), digest), /Invalid mint operation identity/);
});

test('profile lookup distinguishes absence and validates role and wallet at one block', async () => {
  const f = fixture(), wallet = '0x' + '1'.repeat(40), id = 'B-123-456-789-012';
  let profileId = '', profile = { creatorId: id, wallet, typePrefix: '0x42', timestamp: 12 };
  f.ethers.utils.isAddress = x => x === wallet;
  const Original = f.ethers.Contract;
  f.ethers.Contract = class extends Original {
    async getCreatorByWallet(address, options) { assert.equal(address, wallet); assert.equal(options.blockTag, 100); return profileId; }
    async getCreator(requested, options) { assert.equal(requested, id); assert.equal(options.blockTag, 100); return profile; }
  };
  const client = await reader.open(f.provider, [], f.ethers);
  assert.equal((await client.readProfileByWallet(wallet)).profile, null);
  profileId = id;
  assert.equal((await client.readProfileByWallet(wallet)).profile.creatorId, id);
  profile = { ...profile, typePrefix: '0x43' };
  await assert.rejects(client.readProfileByWallet(wallet), /Profile record mismatch/);
  profileId = 'B-incorrect';
  await assert.rejects(client.readProfileByWallet(wallet), /Invalid profile ID/);
});

test('receipt must match a finalized canonical block and the exact mint event', async () => {
  const f = fixture(), id = 'ODP-2026-09-000000027', hash = '0x' + 'a'.repeat(64);
  const blockHash = '0x' + 'b'.repeat(64), op = '0x' + 'c'.repeat(64), creator = '0x' + '1'.repeat(40);
  const h = { passportId: id, creator, creatorId: 'C-1', title: 'A', authorName: 'B', domain: 'art', objectType: 'physical', year: 2026, month: 9 };
  const c = { contentClass: 1, timestamp: 123 }, m = { dataHash: hash, anchorsHash: hash, anchorTypesMask: 0 };
  const claim = { format: 'odp-bundle-receipt-0.7', generationId: 'odp-0.7-redesign-8-polygon-20260925', chainId: '137', registry: reader.REGISTRY, passportId: id, transactionHash: hash, blockNumber: '10', blockHash, operationId: op };
  const args = { ...h, ...c, ...m, passportIdText: id, operationId: op };
  f.ethers.utils.id = () => 'id-topic'; f.ethers.utils.hexZeroPad = () => 'creator-topic';
  const Original = f.ethers.Contract;
  f.ethers.Contract = class extends Original {
    constructor() { super(); this.interface = { parseLog: () => ({ name: 'PassportMinted', args }) }; }
    async getPassportHeader() { return { ...h, contractVersion: 7 }; }
    async getPassportClassification() { return c; }
    async getPassportMedia() { return m; }
  };
  f.provider.getTransaction = async () => ({ hash, blockHash, blockNumber: 10 });
  f.provider.getTransactionReceipt = async () => ({ transactionHash: hash, blockHash, blockNumber: 10, status: 1, logs: [{ address: reader.REGISTRY, topics: ['signature', 'id-topic', 'creator-topic'] }] });
  const snapshotHash = '0x' + 'd'.repeat(64);
  f.provider.getBlock = async tag => tag === 100 ? { number: 100, hash: snapshotHash, timestamp: 1000 } : { number: 10, hash: blockHash };
  const client = await reader.open(f.provider, [], f.ethers);
  assert.equal((await client.verifyReceipt(claim)).blockNumber, 10);
  args.title = 'Changed';
  await assert.rejects(client.verifyReceipt(claim), /differs/);
  args.title = 'A';
  let finalizedCalls = 0;
  f.provider.send = async () => ++finalizedCalls === 1 ? { number: '0x64', hash: snapshotHash } : { number: '0x09', hash: snapshotHash };
  await assert.rejects(client.verifyReceipt(claim), /finalized/);
  await assert.rejects(client.verifyReceipt({ ...claim, registry: creator }), /Invalid receipt claim/);
});

test('failed mint recovery accepts only the matching finalized direct EOA transaction', async () => {
  const f=fixture(), wallet='0x'+'1'.repeat(40), txHash='0x'+'a'.repeat(64), blockHash='0x'+'b'.repeat(64), calldata='0x1234';
  f.ethers.utils.isAddress=x=>x===wallet;
  f.provider.getTransaction=async()=>({hash:txHash,from:wallet,to:reader.REGISTRY,data:calldata,value:0n,blockNumber:10,blockHash});
  f.provider.getTransactionReceipt=async()=>({transactionHash:txHash,status:0,blockNumber:10,blockHash});
  f.provider.getBlock=async n=>n===10?{number:10,hash:blockHash}:{number:100,hash:'0x'+'d'.repeat(64),timestamp:1000};
  f.provider.getCode=async address=>address===wallet?'0x':'0x1234';
  const client=await reader.open(f.provider,[],f.ethers);
  assert.equal((await client.verifyFailedMint(txHash,wallet,calldata)).blockNumber,10);
  await assert.rejects(client.verifyFailedMint(txHash,wallet,'0xbeef'),/matching/);
  f.provider.getTransactionReceipt=async()=>({transactionHash:txHash,status:1,blockNumber:10,blockHash});
  await assert.rejects(client.verifyFailedMint(txHash,wallet,calldata),/matching/);
  f.provider.getTransactionReceipt=async()=>({transactionHash:txHash,status:0,blockNumber:10,blockHash});
  f.provider.getCode=async()=> '0x1234';
  await assert.rejects(client.verifyFailedMint(txHash,wallet,calldata),/issuer type/);
});

test('Safe rejection requires its own finalized successful execution event',async()=>{
  const f=fixture(),safe='0x'+'1'.repeat(40),txHash='0x'+'a'.repeat(64),proposalHash='0x'+'b'.repeat(64),blockHash='0x'+'c'.repeat(64),finalHash='0x'+'d'.repeat(64);
  f.ethers.utils.isAddress=x=>x===safe;f.ethers.utils.id=()=> '0x'+'e'.repeat(64);
  f.provider.getTransaction=async()=>({hash:txHash,blockNumber:10,blockHash});
  let logs=[{address:safe,topics:['0x'+'e'.repeat(64),proposalHash]}];
  f.provider.getTransactionReceipt=async()=>({transactionHash:txHash,status:1,blockNumber:10,blockHash,logs});
  f.provider.getBlock=async n=>n===10?{number:10,hash:blockHash}:{number:100,hash:finalHash,timestamp:1000};
  const client=await reader.open(f.provider,[],f.ethers);
  assert.equal((await client.verifySafeRejection(txHash,safe,proposalHash)).blockNumber,10);
  logs=[{address:safe,topics:['0x'+'e'.repeat(64),'0x'+'f'.repeat(64)]}];
  await assert.rejects(client.verifySafeRejection(txHash,safe,proposalHash),/event not found/);
  logs=[{address:safe,topics:['0x'+'e'.repeat(64),proposalHash],removed:true}];
  await assert.rejects(client.verifySafeRejection(txHash,safe,proposalHash),/event not found/);
});

test('activation block is returned only for a matching canonical satellite event',async()=>{
  const f=fixture(),satellite=generation.satellites.find(s=>s.role==='edition-units'),unit='0x'+'1'.repeat(40),snapshotHash='0x'+'d'.repeat(64),eventHash='0x'+'e'.repeat(64),snapshot=94434900,eventBlock=94434880;
  f.provider.send=async()=>({number:'0x'+snapshot.toString(16),hash:snapshotHash});
  f.provider.getBlock=async n=>n===eventBlock?{number:n,hash:eventHash,timestamp:42}:{number:n,hash:snapshotHash,timestamp:100};
  f.provider.getCode=async addr=>addr===reader.REGISTRY?'registry':'edition';
  f.ethers.utils.keccak256=code=>code==='registry'?reader.RUNTIME_HASH:satellite.runtimeCodeHash;
  Object.assign(f.ethers.utils,{isAddress:x=>x===unit,id:()=> '0x'+'a'.repeat(64),hexlify:x=>'0x'+x.toString(16),hexZeroPad:x=>x});
  let eventPassport='ODP-2026-09-000000001';
  const Original=f.ethers.Contract;f.ethers.Contract=class extends Original{constructor(addr){super();if(addr===satellite.address)return {odpRegistry:async()=>reader.REGISTRY,getEdition:async()=>({open:true,unitCount:2}),getActivation:async()=>({timestamp:42,unitAddress:unit}),interface:{parseLog:()=>({name:'UnitActivated',args:{editionPassportId:eventPassport,unitIndex:1,unitAddress:unit,timestamp:42}})}};}async getPassportHeader(id){return {passportId:id,contractVersion:7};}async getPassportClassification(){return {editionModel:2};}async getPassportMedia(){return {anchorTypesMask:4096};}};
  f.provider.getLogs=async filter=>{assert.equal(filter.fromBlock,94434870);assert.equal(filter.toBlock,snapshot);return [{address:satellite.address,blockNumber:eventBlock,blockHash:eventHash}];};
  const client=await reader.open(f.provider,[],f.ethers),id='ODP-2026-09-000000001';
  assert.equal((await client.readActivationBlock(id,[],1)).blockNumber,eventBlock);
  let narrowQueries=0;
  f.provider.getBlock=async n=>({number:n,hash:n===eventBlock?eventHash:snapshotHash,timestamp:n<eventBlock?41:n===eventBlock?42:43});
  f.provider.getLogs=async filter=>{if(filter.toBlock-filter.fromBlock>5)throw Error('RPC range limit');narrowQueries++;assert.equal(filter.fromBlock,eventBlock);assert.equal(filter.toBlock,eventBlock);return [{address:satellite.address,blockNumber:eventBlock,blockHash:eventHash}];};
  assert.equal((await client.readActivationBlock(id,[],1)).blockNumber,eventBlock);assert.equal(narrowQueries,1);
  eventPassport='ODP-2026-09-000000002';await assert.rejects(client.readActivationBlock(id,[],1),/not found/);
  eventPassport=id;f.provider.getBlock=async()=>({number:eventBlock,hash:'0x'+'f'.repeat(64),timestamp:42});
  await assert.rejects(client.readActivationBlock(id,[],1),/changed/);
});
