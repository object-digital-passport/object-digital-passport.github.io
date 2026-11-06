/* Local issuance job storage. This is not an external backup. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-job.js'));
  else root.ODPV07JobStore = factory(root.ODPV07Job);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (jobTools) {
  'use strict';
  const NAME = 'odp-v07-issuance', STORE = 'jobs', HISTORY = 'history';
  function open(indexedDB) {
    if (!indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(NAME, 2);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); if (!request.result.objectStoreNames.contains(HISTORY)) request.result.createObjectStore(HISTORY); };
      request.onerror = () => reject(request.error || new Error('Job store unavailable'));
      request.onblocked = () => reject(new Error('Job store blocked'));
      request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
    });
  }
  function transaction(db, mode, action) {
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE, mode, mode === 'readwrite' ? { durability:'strict' } : undefined); }
      catch (_) { try { tx = db.transaction(STORE, mode); } catch (error) { reject(error); return; } }
      let request;
      try { request = action(tx.objectStore(STORE)); } catch (error) { tx.abort(); reject(error); return; }
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('Job store transaction aborted'));
      tx.onerror = () => {};
    });
  }
  async function get(db, operationId, options) {
    if (!/^0x[0-9a-f]{64}$/.test(operationId || '')) throw new Error('Invalid operation ID');
    const stored = await transaction(db, 'readonly', store => store.get(operationId));
    if (stored === undefined) return null;
    await jobTools.validate(stored, options);
    return stored;
  }
  async function save(db, value, options) {
    if (!jobTools || !value) throw new Error('Invalid issuance job');
    const snapshot = structuredClone(value);
    await jobTools.validate(snapshot, options);
    await transaction(db, 'readwrite', store => store.add(snapshot, snapshot.identity.operationId));
    const saved = await get(db, snapshot.identity.operationId, options);
    if (!saved || saved.fingerprint !== snapshot.fingerprint) throw new Error('Saved job could not be verified');
    return saved;
  }
  /** Imported backups can predate a wallet hand-off. Never treat them as proof that nothing was sent. */
  async function importBackup(db, value, options) {
    const incoming = structuredClone(value);
    await jobTools.validate(incoming, options);
    const id = incoming.identity.operationId;
    let current = await get(db, id, options);
    if (current && current.fingerprint !== incoming.fingerprint) throw new Error('Backup conflicts with saved job');
    if (!current) {
      // Even a "prepared" backup may have been copied before a later submission on another device.
      const guarded = { ...incoming, state:'handoff' };
      delete guarded.transactionHash; delete guarded.passportId; delete guarded.safeProposal; delete guarded.safeRejection;
      current = await save(db, guarded, options);
    } else if (current.state === 'prepared') {
      current = await transition(db, id, 'prepared', 'handoff', null, options);
    }
    if (current.state === 'handoff' && incoming.safeProposal) {
      current = await transition(db, id, 'handoff', 'safe_pending', { safeProposal:incoming.safeProposal }, options);
    } else if (current.state === 'safe_pending' && incoming.safeProposal && current.safeProposal.safeTxHash !== incoming.safeProposal.safeTxHash) {
      throw new Error('Backup Safe proposal conflicts with saved job');
    } else if (current.state === 'handoff' && incoming.transactionHash) {
      current = await transition(db, id, 'handoff', 'submitted', { transactionHash:incoming.transactionHash }, options);
    } else if (current.state === 'submitted' && incoming.transactionHash && current.transactionHash !== incoming.transactionHash) {
      throw new Error('Backup transaction conflicts with saved job');
    }
    if (current.state === 'safe_pending' && incoming.safeRejection && !current.safeRejection)
      current = await transition(db,id,'safe_pending','safe_pending',{safeRejection:incoming.safeRejection},options);
    else if (current.state === 'safe_pending' && current.safeRejection && incoming.safeRejection && current.safeRejection.safeTxHash !== incoming.safeRejection.safeTxHash)
      throw new Error('Backup Safe rejection conflicts with saved job');
    else if (current.state === 'safe_pending' && current.safeRejection && incoming.safeRejection && current.safeRejection.state==='before-wallet' && incoming.safeRejection.state==='pending')
      current = await transition(db,id,'safe_pending','safe_pending',{safeRejection:incoming.safeRejection},options);
    return current;
  }
  /** Compare-and-swap within one read/write transaction; immutable job data cannot change. */
  async function transition(db, operationId, expected, next, details, options) {
    const allowed = { prepared:['handoff','minted'], handoff:['prepared','submitted','safe_pending','minted'], submitted:['prepared','minted'], safe_pending:['safe_pending','minted'], minted:[] };
    if (!allowed[expected] || !allowed[expected].includes(next)) throw new Error('Invalid job state transition');
    const current = await get(db, operationId, options);
    if (!current || current.state !== expected) throw new Error('Job state changed');
    const updated = { ...current, state:next };
    if (next === 'submitted') updated.transactionHash = details && details.transactionHash;
    if (next === 'safe_pending') updated.safeProposal = details && details.safeProposal;
    if (next === 'safe_pending' && expected === 'safe_pending') {
      updated.safeProposal=current.safeProposal;
      const nextRejection=details && details.safeRejection;
      if (!nextRejection || (current.safeRejection && (current.safeRejection.safeTxHash!==nextRejection.safeTxHash || current.safeRejection.state!=='before-wallet' || nextRejection.state!=='pending'))) throw new Error('Invalid Safe rejection transition');
      updated.safeRejection=nextRejection;
    }
    if (next === 'minted') updated.passportId = details && details.passportId;
    if (next === 'prepared') { delete updated.transactionHash; delete updated.passportId; }
    await jobTools.validate(updated, options);
    await new Promise((resolve, reject) => {
      let tx; try { tx = db.transaction(STORE, 'readwrite', { durability:'strict' }); } catch (_) { tx = db.transaction(STORE, 'readwrite'); }
      const store = tx.objectStore(STORE), request = store.get(operationId);
      request.onsuccess = () => {
        const row = request.result;
        if (!row || row.state !== expected || row.fingerprint !== current.fingerprint || JSON.stringify(row.safeRejection || null)!==JSON.stringify(current.safeRejection || null)) { tx.abort(); return; }
        store.put(updated, operationId);
      };
      tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('Job state changed')); tx.onerror = () => {};
    });
    return get(db, operationId, options);
  }
  async function replaceAfterCancellation(db, previous, next, options) {
    await jobTools.validate(previous,options);await jobTools.validate(next,options);
    if(previous.state!=='safe_pending'||!previous.safeRejection||previous.safeRejection.state!=='pending'||next.state!=='prepared'||
       previous.identity.operationId!==next.identity.operationId||previous.identity.issuer!==next.identity.issuer||previous.identity.creatorId!==next.identity.creatorId||
       JSON.stringify(previous.identity.originals)!==JSON.stringify(next.identity.originals))throw Error('Invalid issuance re-preparation');
    const before=JSON.parse(previous.canonicalPassport),after=JSON.parse(next.canonicalPassport);
    for(const field of ['year','month','registeredAt','registration']){delete before[field];delete after[field];}
    if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Re-preparation changed passport content');
    const id=previous.identity.operationId,historyKey=id+':'+previous.fingerprint;
    await new Promise((resolve,reject)=>{
      let tx;try{tx=db.transaction([STORE,HISTORY],'readwrite',{durability:'strict'});}catch(_){tx=db.transaction([STORE,HISTORY],'readwrite');}
      const jobs=tx.objectStore(STORE),request=jobs.get(id);
      request.onsuccess=()=>{const row=request.result;if(!row||row.state!==previous.state||row.fingerprint!==previous.fingerprint||JSON.stringify(row.safeRejection)!==JSON.stringify(previous.safeRejection)){tx.abort();return;}tx.objectStore(HISTORY).add(previous,historyKey);jobs.put(next,id);};
      tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Issuance job changed'));tx.onerror=()=>{};
    });
    return get(db,id,options);
  }
  return Object.freeze({ open, get, save, transition, importBackup, replaceAfterCancellation });
});
