/* Prepare a self-contained unique-object issuance job; never opens a wallet. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'), require('./odp-v07-passport.js'), require('./odp-v07-mint.js'), require('./odp-v07-safe.js'));
  else root.ODPV07Job = factory(root.ODPV07Canonical, root.ODPV07Passport, root.ODPV07Mint, root.ODPV07Safe);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, passportTools, mintTools, safeTools) {
  'use strict';
  async function prepare({ document, originals, profile, wallet, abi, ethers, operationId: savedOperationId }) {
    if (!profile || !ethers || !ethers.utils.isAddress(wallet) || String(profile.wallet).toLowerCase() !== wallet.toLowerCase() ||
        !/^[CBPM]-(?:[0-9]{3}-){3}[0-9]{3}$/.test(profile.creatorId || '') ||
        String(profile.typePrefix).toLowerCase() !== '0x' + profile.creatorId.charCodeAt(0).toString(16) || !Array.isArray(originals)) throw new Error('Invalid issuer profile');
    const issuerType = profile.creatorId[0];
    const prepared = await passportTools.preparePassport(document, { issuer:wallet, issuerType, ethers });
    const d = prepared.document;
    if (d.edition.model !== 'unique' || (prepared.mint.anchorTypesMask & (4096 | 8192))) throw new Error('Only unique objects are supported');
    const requiredMask = d.objectType === 'physical' ? 15 : d.objectType === 'digital' ? 32 : 47;
    if ((prepared.mint.anchorTypesMask & requiredMask) !== requiredMask) throw new Error('Required anchors are missing');
    const required = new Set();
    for (const anchor of d.anchors) if (['photo','file_hash'].includes(anchor.type)) required.add(anchor.hash);
    if (d.digital) required.add(d.digital.fileHash);
    const files = [], seen = new Set(); let total = 0;
    for (const original of originals) {
      if (!original || !(original.bytes instanceof Uint8Array) || !/^sha256:[0-9a-f]{64}$/.test(original.hash || '') || seen.has(original.hash) || !required.has(original.hash)) throw new Error('Invalid original');
      if (original.bytes.length > 50 * 1048576 || (total += original.bytes.length) > 100 * 1048576) throw new Error('Original size limit exceeded');
      const bytes = original.bytes.slice();
      if ('sha256:' + (await canonical.sha256(bytes)).slice(2) !== original.hash) throw new Error('Original hash mismatch');
      files.push({ hash:original.hash, bytes }); seen.add(original.hash);
    }
    for (const expected of required) if (!seen.has(expected)) throw new Error('Required original missing');
    if (d.digital && d.digital.fileSize !== undefined && files.find(f => f.hash === d.digital.fileHash).bytes.length !== d.digital.fileSize) throw new Error('Digital file size mismatch');
    for (const a of d.anchors) if (a.type === 'photo' && a.data && a.data.role === 'preview' && files.find(f => f.hash === a.hash).bytes.length > 1048576) throw new Error('Preview too large');
    let operationId = savedOperationId;
    if (operationId === undefined) { const op = new Uint8Array(32); globalThis.crypto.getRandomValues(op); operationId = '0x' + Array.from(op, b => b.toString(16).padStart(2,'0')).join(''); }
    const plan = mintTools.prepare({ issuer:wallet, objectType:d.objectType, mint:prepared.mint, operationId, abi, ethers });
    const identity = { format:'odp-issuance-job-0.7', registry:plan.registry, chainId:'137', issuer:wallet.toLowerCase(), creatorId:profile.creatorId, operationId, digest:plan.digest, documentHash:prepared.mint.dataHash, originals:files.map(f => ({ hash:f.hash, byteLength:String(f.bytes.length) })).sort((a,b) => a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0) };
    const fingerprint = await canonical.canonicalHash(identity);
    return { identity, fingerprint, canonicalPassport:prepared.canonical, originals:files, calldata:plan.calldata, state:'prepared' };
  }
  async function validate(job, { abi, ethers }) {
    if (!job || !job.identity || typeof job.canonicalPassport !== 'string' || !Array.isArray(job.originals)) throw new Error('Invalid saved issuance job');
    if (!['prepared','handoff','submitted','safe_pending','minted'].includes(job.state)) throw new Error('Invalid issuance job state');
    if (job.state === 'submitted' && !/^0x[0-9a-f]{64}$/.test(job.transactionHash || '')) throw new Error('Invalid submitted transaction');
    if (job.state === 'minted' && !/^ODP-[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{9}$/.test(job.passportId || '')) throw new Error('Invalid minted passport ID');
    if (job.transactionHash !== undefined && !/^0x[0-9a-f]{64}$/.test(job.transactionHash)) throw new Error('Invalid transaction hash');
    const document = canonical.parseJSON(job.canonicalPassport);
    if (job.state === 'safe_pending' || job.safeProposal !== undefined) {
      const info=job.safeProposal;
      if (!['safe_pending','minted'].includes(job.state) || !safeTools || !info || Object.keys(info).sort().join('|') !== 'deadline|nonce|safeTxHash' ||
          info.deadline !== Date.UTC(document.year,document.month,1)/1000 || job.identity.creatorId[0] === 'C') throw new Error('Invalid Safe proposal metadata');
      const plan=safeTools.proposal({safe:job.identity.issuer,nonce:info.nonce,data:job.calldata,action:'mint',deadline:info.deadline,now:0,ethers});
      if (plan.safeTxHash !== info.safeTxHash) throw new Error('Safe proposal hash mismatch');
      if (job.safeRejection !== undefined) {
        const rejection=job.safeRejection;
        if (!rejection || Object.keys(rejection).sort().join('|')!=='safeTxHash|state' || !['before-wallet','pending'].includes(rejection.state) ||
            safeTools.rejection(plan,0,ethers).safeTxHash!==rejection.safeTxHash) throw new Error('Invalid Safe rejection metadata');
      }
    } else if (job.safeRejection !== undefined) {
      throw new Error('Unexpected Safe rejection metadata');
    }
    if (canonical.canonicalize(document) !== job.canonicalPassport || typeof job.identity.creatorId !== 'string' || !job.identity.creatorId.length) throw new Error('Invalid saved issuance job');
    const profile = { creatorId:job.identity.creatorId, wallet:job.identity.issuer, typePrefix:'0x' + job.identity.creatorId.charCodeAt(0).toString(16) };
    const verified = await prepare({ document, originals:job.originals, profile, wallet:job.identity.issuer, abi, ethers, operationId:job.identity.operationId });
    if (canonical.canonicalize(verified.identity) !== canonical.canonicalize(job.identity) || verified.fingerprint !== job.fingerprint || verified.calldata !== job.calldata) throw new Error('Saved issuance job changed');
    return verified;
  }
  return Object.freeze({ prepare, validate });
});
