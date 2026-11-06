/* Public address-list validation from SPEC 0.7 section 20. No possession claim. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'));
  else root.ODPV07Edition = factory(root.ODPV07Canonical);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical) {
  'use strict';
  const hash = async bytes => new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  async function batches(count, fn) {
    const result = new Array(count);
    for (let offset = 0; offset < count; offset += 128) {
      const end = Math.min(offset + 128, count), batch = [];
      for (let i = offset; i < end; i++) batch.push(fn(i));
      const values = await Promise.all(batch);
      for (let i = offset; i < end; i++) result[i] = values[i - offset];
    }
    return result;
  }
  async function verifyAddressList(bytes, context) {
    const { addressListHash, unitCount, merkleRoot } = context || {};
    if (!(bytes instanceof Uint8Array) || !/^sha256:[0-9a-f]{64}$/.test(addressListHash || '') ||
        !/^sha256:(?!0{64}$)[0-9a-f]{64}$/.test(merkleRoot || '') || !Number.isInteger(unitCount) || unitCount < 1 || unitCount > 1048576) throw new Error('Invalid address list input');
    if (bytes.length !== unitCount * 43) throw new Error('Address list length/count mismatch');
    if (await canonical.sha256(bytes) !== '0x' + addressListHash.slice(7)) throw new Error('Address list hash mismatch');
    const text = canonical.decodeUTF8(bytes);
    const addresses = text.slice(0, -1).split('\n');
    if (!text.endsWith('\n') || addresses.length !== unitCount || addresses.some(a => !/^0x[0-9a-f]{40}$/.test(a) || /^0x0{40}$/.test(a))) throw new Error('Invalid address list');
    if (new Set(addresses).size !== addresses.length) throw new Error('Duplicate unit address');
    let level = await batches(unitCount, i => {
      const value = new Uint8Array(24); new DataView(value.buffer).setUint32(0, i, false);
      for (let j = 0; j < 20; j++) value[j + 4] = parseInt(addresses[i].slice(2 + 2*j, 4 + 2*j), 16);
      return hash(value);
    });
    while (level.length > 1) {
      const prior = level;
      level = await batches(Math.ceil(prior.length / 2), i => {
        const value = new Uint8Array(64); value.set(prior[2*i]); value.set(prior[2*i+1] || prior[2*i], 32); return hash(value);
      });
    }
    if (hex(level[0]) !== merkleRoot.slice(7)) throw new Error('Address list Merkle root mismatch');
    return { unitCount, merkleRoot, integrity: 'verified' };
  }
  return Object.freeze({ verifyAddressList });
});
