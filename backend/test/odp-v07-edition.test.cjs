const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyAddressList } = require('../js/odp-v07-edition.js');
const canonical = require('../js/odp-v07-canonical.js');
const vectors = require('./vectors/edition-units.json');
const { createHash } = require('node:crypto');

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

test('incremental tree matches independent Merkle roots across chunk boundaries', async () => {
  const sha = bytes => createHash('sha256').update(bytes).digest();
  for (const count of [1,2,3,5,7,63,127,128,129,255,256,257,1025,4095,4096,4097,8193]) {
    const addresses=Array.from({length:count},(_,i)=>'0x'+(i+1).toString(16).padStart(40,'0'));
    const bytes=new TextEncoder().encode(addresses.join('\n')+'\n');
    let level=addresses.map((address,index)=>{const leaf=Buffer.alloc(24);leaf.writeUInt32BE(index);Buffer.from(address.slice(2),'hex').copy(leaf,4);return sha(leaf);});
    while(level.length>1){const next=[];for(let i=0;i<level.length;i+=2)next.push(sha(Buffer.concat([level[i],level[i+1]||level[i]])));level=next;}
    const context={addressListHash:'sha256:'+sha(bytes).toString('hex'),unitCount:count,merkleRoot:'sha256:'+level[0].toString('hex')};
    assert.equal((await verifyAddressList(bytes,context)).integrity,'verified',`count ${count}`);
  }
});

test('rejects an address duplicated in a later processing block', async () => {
  const addresses=Array.from({length:257},(_,i)=>'0x'+(i+1).toString(16).padStart(40,'0'));
  addresses[256]=addresses[0];
  const bytes=new TextEncoder().encode(addresses.join('\n')+'\n');
  const context={addressListHash:'sha256:'+(await canonical.sha256(bytes)).slice(2),unitCount:addresses.length,merkleRoot:'sha256:'+'1'.repeat(64)};
  await assert.rejects(verifyAddressList(bytes,context),/Duplicate unit address/);
});
