/* Portable issuance-job backup, separate from public .odpass files and wallet keys. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'), require('./odp-v07-job.js'));
  else root.ODPV07JobBackup = factory(root.ODPV07Canonical, root.ODPV07Job);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical, jobs) {
  'use strict';
  const MAGIC = new TextEncoder().encode('ODPJOB07\n'), MAX_META = 1048576, MAX_BYTES = 105 * 1048576;
  async function exportJob(value, options) {
    const job = structuredClone(value); if (!job) throw new Error('Invalid issuance job'); await jobs.validate(job, options);
    const metadata = { format:'odp-issuance-backup-0.7', identity:job.identity, fingerprint:job.fingerprint, canonicalPassport:job.canonicalPassport, calldata:job.calldata,
      submission:{ state:job.state, transactionHash:job.transactionHash || null, passportId:job.passportId || null } };
    if (job.safeProposal) metadata.submission.safeProposal = job.safeProposal;
    if (job.safeRejection) metadata.submission.safeRejection = job.safeRejection;
    const meta = new TextEncoder().encode(canonical.canonicalize(metadata));
    const total = MAGIC.length + 4 + meta.length + job.originals.reduce((n, f) => n + 4 + f.bytes.length, 0);
    if (meta.length > MAX_META || total > MAX_BYTES) throw new Error('Backup size limit exceeded');
    const output = new Uint8Array(total), view = new DataView(output.buffer); let offset = 0;
    output.set(MAGIC, offset); offset += MAGIC.length; view.setUint32(offset, meta.length, false); offset += 4; output.set(meta, offset); offset += meta.length;
    for (const descriptor of job.identity.originals) {
      const file = job.originals.find(f => f.hash === descriptor.hash);
      if (!file) throw new Error('Backup original missing');
      view.setUint32(offset, file.bytes.length, false); offset += 4; output.set(file.bytes, offset); offset += file.bytes.length;
    }
    return output;
  }
  async function restore(input, options) {
    if (!(input instanceof Uint8Array) || input.length > MAX_BYTES || input.length < MAGIC.length + 4 || MAGIC.some((b,i) => input[i] !== b)) throw new Error('Invalid issuance backup');
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength); let offset = MAGIC.length;
    const metaLength = view.getUint32(offset, false); offset += 4;
    if (metaLength > MAX_META || offset + metaLength > input.length) throw new Error('Invalid backup metadata');
    const metaBytes = input.subarray(offset, offset + metaLength), metadata = canonical.parseJSONBytes(metaBytes); offset += metaLength;
    const actualKeys = metadata && Object.keys(metadata).sort().join('|');
    const oldKeys = ['calldata','canonicalPassport','fingerprint','format','identity'].sort().join('|');
    const newKeys = ['calldata','canonicalPassport','fingerprint','format','identity','submission'].sort().join('|');
    if (canonical.decodeUTF8(metaBytes) !== canonical.canonicalize(metadata) || !metadata || ![oldKeys,newKeys].includes(actualKeys) ||
        metadata.format !== 'odp-issuance-backup-0.7' || !metadata.identity || !Array.isArray(metadata.identity.originals) || metadata.identity.originals.length > 1000) throw new Error('Invalid backup metadata');
    const submission = metadata.submission || { state:'prepared', transactionHash:null, passportId:null };
    const submissionKeys = submission && Object.keys(submission).sort().join('|');
    if (!submission || ![['state','transactionHash','passportId'].sort().join('|'),['state','transactionHash','passportId','safeProposal'].sort().join('|'),['state','transactionHash','passportId','safeProposal','safeRejection'].sort().join('|')].includes(submissionKeys) ||
        (submission.transactionHash !== null && typeof submission.transactionHash !== 'string') || (submission.passportId !== null && typeof submission.passportId !== 'string')) throw new Error('Invalid backup submission state');
    const originals = [];
    for (const descriptor of metadata.identity.originals) {
      if (!descriptor || !/^sha256:[0-9a-f]{64}$/.test(descriptor.hash || '') || !/^(0|[1-9][0-9]*)$/.test(descriptor.byteLength || '') || offset + 4 > input.length) throw new Error('Invalid backup original');
      const size = view.getUint32(offset, false); offset += 4;
      if (size > 50 * 1048576 || String(size) !== descriptor.byteLength || offset + size > input.length) throw new Error('Invalid backup original size');
      originals.push({ hash:descriptor.hash, bytes:input.slice(offset, offset + size) }); offset += size;
    }
    if (offset !== input.length) throw new Error('Trailing backup data');
    const job = { identity:metadata.identity, fingerprint:metadata.fingerprint, canonicalPassport:metadata.canonicalPassport, calldata:metadata.calldata, originals, state:submission.state };
    if (submission.transactionHash !== null) job.transactionHash = submission.transactionHash;
    if (submission.passportId !== null) job.passportId = submission.passportId;
    if (submission.safeProposal !== undefined) job.safeProposal = submission.safeProposal;
    if (submission.safeRejection !== undefined) job.safeRejection = submission.safeRejection;
    await jobs.validate(job, options);
    return job;
  }
  return Object.freeze({ exportJob, restore });
});
