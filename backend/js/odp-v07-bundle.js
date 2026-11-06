/* Validates extracted bundle entries. ZIP envelope must be validated separately. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'), require('./odp-v07-schemas.bundle.js'), require('./odp-v07-passport.js'), require('./odp-v07-mint.js'), require('./odp-v07-edition.js'));
  else root.ODPV07Bundle = factory(root.ODPV07Canonical, root.ODPV07Schemas, root.ODPV07Passport, root.ODPV07Mint, root.ODPV07Edition);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, schemas, passportTools, mintTools, editionTools) {
  'use strict';
  const roots = ['passport.json', 'generation.json', 'receipt.json', 'manifest.json'];
  const keys = (o, expected) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join('|') === [...expected].sort().join('|');
  async function inspectEntries(entries, trustedGeneration) {
    if (!canonical || !schemas || !Array.isArray(entries) || entries.length < 4 || entries.length > 256 || !trustedGeneration) throw new Error('Invalid bundle entries');
    const files = new Map(); let total = 0;
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string' || !(entry.bytes instanceof Uint8Array) ||
          (!roots.includes(entry.name) && !/^files\/[0-9a-f]{64}$/.test(entry.name)) || files.has(entry.name)) throw new Error('Invalid or duplicate bundle path');
      if (entry.bytes.length > 50 * 1048576 || (total += entry.bytes.length) > 128 * 1048576) throw new Error('Bundle size limit exceeded');
      if (roots.includes(entry.name) && entry.bytes.length > 1048576) throw new Error('Bundle metadata too large');
      files.set(entry.name, entry.bytes);
    }
    const docs = {};
    for (const name of roots) {
      if (!files.has(name)) throw new Error('Missing ' + name);
      docs[name.slice(0, -5)] = canonical.parseJSONBytes(files.get(name));
    }
    const { passport, generation, receipt, manifest } = docs;
    for (const name of ['passport', 'generation', 'receipt', 'manifest']) {
      if (typeof schemas[name] !== 'function' || !schemas[name](docs[name])) throw new Error('Invalid ' + name + ' schema');
    }
    if (canonical.decodeUTF8(files.get('passport.json')) !== canonical.canonicalize(passport)) throw new Error('Passport is not canonical');
    if (canonical.canonicalize(generation) !== canonical.canonicalize(trustedGeneration)) throw new Error('Untrusted generation');
    if (!keys(receipt, ['format','generationId','chainId','registry','passportId','transactionHash','blockNumber','blockHash','operationId']) ||
        receipt.format !== 'odp-bundle-receipt-0.7' || ['generationId','chainId','registry'].some(k => receipt[k] !== generation[k])) throw new Error('Invalid receipt');
    if (!keys(manifest, ['format','passportFile','generationFile','receiptFile','files']) || manifest.format !== 'odp-bundle-manifest-0.7' ||
        manifest.passportFile !== 'passport.json' || manifest.generationFile !== 'generation.json' || manifest.receiptFile !== 'receipt.json' || !Array.isArray(manifest.files)) throw new Error('Invalid manifest');
    const listed = new Set();
    for (const item of manifest.files) {
      if (!keys(item, ['path','sha256','byteLength']) || !/^sha256:[0-9a-f]{64}$/.test(item.sha256 || '') || item.path !== 'files/' + item.sha256.slice(7) ||
          !/^(0|[1-9][0-9]*)$/.test(item.byteLength || '') || listed.has(item.path)) throw new Error('Invalid manifest entry');
      listed.add(item.path);
      const bytes = files.get(item.path);
      if (!bytes || String(bytes.length) !== item.byteLength || (await canonical.sha256(bytes)).slice(2) !== item.sha256.slice(7)) throw new Error('Payload missing or changed');
    }
    for (const name of files.keys()) if (!roots.includes(name) && !listed.has(name)) throw new Error('Unlisted payload');
    if (!passport || !Array.isArray(passport.anchors)) throw new Error('Invalid passport anchors');
    const required = [];
    for (const a of passport.anchors) {
      if (a && ['photo','file_hash'].includes(a.type)) required.push(a.hash);
      if (a && a.type === 'unit_key_set') required.push(a.data && a.data.addressListHash);
    }
    if (passport.digital) required.push(passport.digital.fileHash);
    for (const hash of required) if (typeof hash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(hash) || !listed.has('files/' + hash.slice(7))) throw new Error('Required original missing');
    for (const a of passport.anchors) if (a && a.type === 'photo' && a.data && a.data.role === 'preview' && files.get('files/' + a.hash.slice(7)).length > 1048576) throw new Error('Preview too large');
    const unitSets = passport.anchors.filter(a => a.type === 'unit_key_set');
    if (unitSets.length > 1 || (unitSets.length && !editionTools)) throw new Error('Invalid edition key sets');
    for (const anchor of unitSets) {
      const satellite = generation.satellites.find(s => s.role === 'edition-units'), data = anchor.data;
      if (!satellite || data.keyDerivation !== 'odp-unit-v2' || data.registry.toLowerCase() !== generation.registry || data.satellite.toLowerCase() !== satellite.address || String(data.chainId) !== generation.chainId) throw new Error('Edition namespace mismatch');
      await editionTools.verifyAddressList(files.get('files/' + data.addressListHash.slice(7)), data);
    }
    return { documents: docs, payloadsPresent: true, deploymentMatches: true, passportSchema: 'valid', passportSemantics: 'unverified', chainEvidence: 'unverified', editionAddressList: unitSets.length ? 'verified' : 'not-applicable', editionProof: 'unverified' };
  }
  /** Client must be opened against the independently pinned 0.7 deployment. */
  async function verifyEntries(entries, trustedGeneration, client, ethers, editionAbi) {
    if (!passportTools || !mintTools || !client || typeof client.readPassport !== 'function' || typeof client.verifyReceipt !== 'function' || typeof client.readMintOperation !== 'function') throw new Error('Registry verification unavailable');
    const result = await inspectEntries(entries, trustedGeneration);
    const receipt = result.documents.receipt;
    const record = await client.readPassport(receipt.passportId);
    const passportReport = await passportTools.verifyPassport(result.documents.passport, record.header, record.media, record.classification, ethers);
    const chainReceipt = await client.verifyReceipt(receipt);
    const prepared = await passportTools.preparePassport(result.documents.passport, { issuer: record.header.creator, ethers });
    const digest = mintTools.digest(record.header.creator, result.documents.passport.objectType, prepared.mint, ethers);
    const operation = await client.readMintOperation(record.header.creator, receipt.operationId, digest);
    if (operation.state !== 'committed' || operation.passportId !== receipt.passportId) throw new Error('Mint operation is not confirmed');
    const anchor = result.documents.passport.anchors.find(a => a.type === 'unit_key_set');
    let edition = null;
    if (anchor) {
      if (!Array.isArray(editionAbi) || typeof client.readEdition !== 'function') throw new Error('Edition registry unavailable');
      edition = await client.readEdition(receipt.passportId, editionAbi);
      if (edition.edition.open) {
        const a = anchor.data, e = edition.edition, signer = a.labelSignerKey || '0x' + '0'.repeat(40);
        if (e.merkleRoot.toLowerCase() !== '0x' + a.merkleRoot.slice(7) || Number(e.unitCount) !== a.unitCount ||
            e.editionNonce.toLowerCase() !== a.editionNonce.toLowerCase() || e.labelSigner.toLowerCase() !== signer.toLowerCase()) throw new Error('Opened edition does not match passport');
      }
    }
    return { ...result, passportSemantics: 'verified-against-registry', chainEvidence: 'verified', passportReport, record, chainReceipt, operation, edition };
  }
  return Object.freeze({ inspectEntries, verifyEntries });
});
