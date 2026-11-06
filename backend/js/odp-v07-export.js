/* Build and re-read a verified unique-object .odpass before offering it to save. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'), require('./odp-v07-job.js'), require('./odp-v07-bundle.js'), require('./odp-v07-zip.js'));
  else root.ODPV07Export = factory(root.ODPV07Canonical, root.ODPV07Job, root.ODPV07Bundle, root.ODPV07Zip);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, jobs, bundle, zip) {
  'use strict';
  async function make({ job:value, receipt, trustedGeneration, reader, abi, ethers }) {
    const job = structuredClone(value); await jobs.validate(job, {abi,ethers});
    if (job.state !== 'minted' || !receipt || receipt.passportId !== job.passportId || receipt.operationId !== job.identity.operationId ||
        receipt.chainId !== job.identity.chainId || receipt.registry !== job.identity.registry ||
        (job.transactionHash && receipt.transactionHash !== job.transactionHash)) throw new Error('Receipt does not match issuance job');
    if (!trustedGeneration || trustedGeneration.generationId !== 'odp-0.7-redesign-8-polygon-20260925' ||
        trustedGeneration.chainId !== job.identity.chainId || trustedGeneration.registry !== job.identity.registry ||
        trustedGeneration.registryRuntimeCodeHash !== '0x9da6429fcf47e638377081bab80189877574ef33a6d1468dd4ac466bbc5ea7ec') throw new Error('Untrusted generation');
    const files = job.identity.originals.map(item => ({ path:'files/' + item.hash.slice(7), sha256:item.hash, byteLength:item.byteLength }));
    const manifest = { format:'odp-bundle-manifest-0.7', passportFile:'passport.json', generationFile:'generation.json', receiptFile:'receipt.json', files };
    const encode = value => new TextEncoder().encode(canonical.canonicalize(value));
    const entries = [
      {name:'passport.json',bytes:new TextEncoder().encode(job.canonicalPassport)},
      {name:'generation.json',bytes:encode(trustedGeneration)},
      {name:'receipt.json',bytes:encode(receipt)},
      {name:'manifest.json',bytes:encode(manifest)},
      ...job.originals.map(f => ({name:'files/' + f.hash.slice(7),bytes:f.bytes})),
    ];
    await bundle.verifyEntries(entries, trustedGeneration, reader, ethers);
    const bytes = zip.create(entries);
    await bundle.verifyEntries(await zip.extract(bytes), trustedGeneration, reader, ethers);
    return { bytes, passportId:job.passportId, sha256:await canonical.sha256(bytes) };
  }
  return Object.freeze({ make });
});
