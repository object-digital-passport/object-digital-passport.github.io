const { test } = require('node:test');
const assert = require('node:assert/strict');
const canonical = require('../js/odp-v07-canonical.js');
const bundle = require('../js/odp-v07-bundle.js');
const passportTools = require('../js/odp-v07-passport.js');
const zip = require('../js/odp-v07-zip.js');
const enc = new TextEncoder();

async function fixture() {
  const bytes = enc.encode('original'), hash = 'sha256:' + (await canonical.sha256(bytes)).slice(2), path = 'files/' + hash.slice(7);
  const generation = structuredClone(require('../config/odp-0.7/generation.json'));
  const passport = structuredClone(require('./vectors/passport-0.7/physical.json'));
  passport.anchors.find(a => a.type === 'photo').hash = hash;
  const docs = {
    passport,
    generation,
    receipt: { format: 'odp-bundle-receipt-0.7', generationId: generation.generationId, chainId: generation.chainId, registry: generation.registry, passportId: 'ODP-2026-09-000000001', transactionHash: '0x' + '1'.repeat(64), blockNumber: '1', blockHash: '0x' + '2'.repeat(64), operationId: '0x' + '3'.repeat(64) },
    manifest: { format: 'odp-bundle-manifest-0.7', passportFile: 'passport.json', generationFile: 'generation.json', receiptFile: 'receipt.json', files: [{ path, sha256: hash, byteLength: String(bytes.length) }] },
  };
  const entries = Object.entries(docs).map(([name, value]) => ({ name: name + '.json', bytes: enc.encode(canonical.canonicalize(value)) }));
  entries.push({ name: path, bytes });
  return { entries, generation, path };
}
test('checks payload hashes and pinned deployment without asserting schema or chain verification', async () => {
  const f = await fixture(), result = await bundle.inspectEntries(f.entries, f.generation);
  assert.equal(result.payloadsPresent, true); assert.equal(result.deploymentMatches, true);
  assert.equal(result.passportSchema, 'valid'); assert.equal(result.passportSemantics, 'unverified'); assert.equal(result.chainEvidence, 'unverified');
  const changed = f.entries.map(e => e.name === f.path ? { ...e, bytes: enc.encode('modified') } : e);
  await assert.rejects(bundle.inspectEntries(changed, f.generation), /Payload missing or changed/);
  await assert.rejects(bundle.inspectEntries(f.entries, { ...f.generation, registry: 'other' }), /Untrusted generation/);
  await assert.rejects(bundle.inspectEntries([...f.entries, f.entries[0]], f.generation), /duplicate/);
  await assert.rejects(bundle.inspectEntries(f.entries.filter(e => e.name !== f.path), f.generation), /Payload missing/);
});

test('chain confirmation requires matching passport data and authenticated receipt', async () => {
  const f = await fixture(), inspected = await bundle.inspectEntries(f.entries, f.generation);
  const doc = inspected.documents.passport, prepared = await passportTools.preparePassport(doc), m = prepared.mint;
  const record = { header: { ...m.core, objectType: doc.objectType, creator: '0x' + '1'.repeat(40) }, media: m, classification: { ...m.core, revoked: false, timestamp: 123 } };
  const client = { readPassport: async () => record, verifyReceipt: async () => ({ blockNumber: 1 }), readMintOperation: async () => ({ state: 'committed', passportId: inspected.documents.receipt.passportId }) };
  const ethers = { utils: { isAddress: () => true, defaultAbiCoder: { encode: () => 'encoded' }, keccak256: () => '0x' + '1'.repeat(64) } };
  const result = await bundle.verifyEntries(f.entries, f.generation, client, ethers);
  assert.equal(result.chainEvidence, 'verified');
  assert.equal(result.passportSemantics, 'verified-against-registry');
  client.verifyReceipt = async () => { throw new Error('unfinalized'); };
  await assert.rejects(bundle.verifyEntries(f.entries, f.generation, client, ethers), /unfinalized/);
  client.verifyReceipt = async () => ({}); record.header.title = 'changed';
  await assert.rejects(bundle.verifyEntries(f.entries, f.generation, client, ethers), /Card mismatch/);
  record.header.title = m.core.title;
  client.readMintOperation = async () => ({ state: 'conflict', passportId: inspected.documents.receipt.passportId });
  await assert.rejects(bundle.verifyEntries(f.entries, f.generation, client, ethers), /not confirmed/);
});

test('a stored ZIP is extracted and validated before any chain assertion', async () => {
  const f = await fixture(), locals = [], central = []; let offset = 0;
  for (const item of f.entries) {
    const name = Buffer.from(item.name), bytes = Buffer.from(item.bytes); let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30 + name.length + bytes.length), entry = Buffer.alloc(46 + name.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30); bytes.copy(local, 30 + name.length);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24); entry.writeUInt16LE(name.length, 28); entry.writeUInt32LE(offset, 42); name.copy(entry, 46);
    locals.push(local); central.push(entry); offset += local.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(f.entries.length, 8); end.writeUInt16LE(f.entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  const entries = await zip.extract(Buffer.concat([...locals, directory, end]));
  const inspected = await bundle.inspectEntries(entries, f.generation);
  assert.equal(inspected.payloadsPresent, true);
  assert.equal(inspected.chainEvidence, 'unverified');
});

test('edition bundle binds its public list and namespace to the pinned generation', async () => {
  const f = await fixture(), generation = f.generation;
  const doc = structuredClone(require('./vectors/passport-0.7/edition.json'));
  const vector = require('./vectors/edition-units.json');
  const list = enc.encode(vector.units.map(u => u.unitAddress.toLowerCase()).join('\n') + '\n');
  const listHash = 'sha256:' + (await canonical.sha256(list)).slice(2), path = 'files/' + listHash.slice(7);
  const photo = f.entries.find(e => e.name === f.path);
  doc.anchors.find(a => a.type === 'photo').hash = 'sha256:' + f.path.slice(6);
  const a = doc.anchors.find(a => a.type === 'unit_key_set').data;
  a.registry = generation.registry; a.satellite = generation.satellites.find(s => s.role === 'edition-units').address;
  a.chainId = generation.chainId; a.addressListHash = listHash; a.merkleRoot = 'sha256:' + vector.merkleRoot.slice(2);
  const manifest = canonical.parseJSONBytes(f.entries.find(e => e.name === 'manifest.json').bytes);
  manifest.files.push({ path, sha256: listHash, byteLength: String(list.length) });
  const entries = f.entries.map(e => e.name === 'passport.json' ? { ...e, bytes: enc.encode(canonical.canonicalize(doc)) } : e.name === 'manifest.json' ? { ...e, bytes: enc.encode(canonical.canonicalize(manifest)) } : e);
  entries.push({ name: path, bytes: list });
  assert.ok(photo);
  assert.equal((await bundle.inspectEntries(entries, generation)).editionAddressList, 'verified');
  a.registry = '0x' + '1'.repeat(40);
  const altered = entries.map(e => e.name === 'passport.json' ? { ...e, bytes: enc.encode(canonical.canonicalize(doc)) } : e);
  await assert.rejects(bundle.inspectEntries(altered, generation), /namespace/);
});
