/* Issuance hand-off and recovery for a saved unique-object job. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-job-store.js'), require('./odp-v07-job-backup.js'), require('./odp-v07-passport.js'), require('./odp-v07-canonical.js'), require('./odp-v07-safe.js'), require('./odp-v07-job.js'));
  else root.ODPV07Issue = factory(root.ODPV07JobStore, root.ODPV07JobBackup, root.ODPV07Passport, root.ODPV07Canonical, root.ODPV07Safe, root.ODPV07Job);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (store, backup, passportTools, canonical, safeTools, jobs) {
  'use strict';
  async function send({ db, operationId, expectedFingerprint, backupBytes, reader, ethereum, wallet, locks, abi, ethers }) {
    if (!db || !reader || !ethereum || !locks || typeof locks.request !== 'function' || !ethers || !ethers.utils.isAddress(wallet)) throw new Error('Issuance prerequisites unavailable');
    const options = { abi, ethers }, key = 'odp-v07-issue:' + wallet.toLowerCase() + ':' + operationId;
    return locks.request(key, { ifAvailable:true }, async lock => {
      if (!lock) throw new Error('Issuance already in progress');
      let job = await store.get(db, operationId, options);
      if (!job || job.identity.issuer !== wallet.toLowerCase() || job.fingerprint !== expectedFingerprint) throw new Error('Issuance confirmation changed');
      const operation = await reader.readMintOperation(wallet, operationId, job.identity.digest);
      if (operation.state === 'conflict') throw new Error('Issuance operation conflict');
      if (operation.state === 'committed') {
        const record = await reader.readPassport(operation.passportId);
        if (!record || !record.header || String(record.header.creator).toLowerCase() !== wallet.toLowerCase()) throw new Error('Minted issuer mismatch');
        await passportTools.verifyPassport(canonical.parseJSON(job.canonicalPassport), record.header, record.media, record.classification, ethers);
        if (job.state === 'minted' && job.passportId !== operation.passportId) throw new Error('Minted passport changed');
        if (job.state !== 'minted') job = await store.transition(db, operationId, job.state, 'minted', { passportId:operation.passportId }, options);
        return { state:'minted', passportId:job.passportId };
      }
      if (job.state === 'safe_pending') {
        if (job.safeRejection) return {state:job.safeRejection.state==='pending'?'safe_rejection_pending':'unresolved'};
        const block=await ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]});
        if (!block || !/^0x[0-9a-f]+$/i.test(block.timestamp || '') || !Number.isSafeInteger(Number(block.timestamp))) throw new Error('Chain time unavailable');
        return {state:Number(block.timestamp)>=job.safeProposal.deadline?'safe_expired':'safe_pending',safeTxHash:job.safeProposal.safeTxHash};
      }
      if (job.state !== 'prepared') return { state:'unresolved', transactionHash:job.transactionHash || null };
      const restored = await backup.restore(backupBytes, options);
      if (restored.state !== 'prepared' || restored.fingerprint !== job.fingerprint) throw new Error('Issuance backup does not match');
      const profile = await reader.readProfileByWallet(wallet);
      if (!profile.profile || profile.profile.creatorId !== job.identity.creatorId) throw new Error('Issuer profile changed');
      const doc = canonical.parseJSON(job.canonicalPassport), method = {physical:'mintPhysical',digital:'mintDigital',mixed:'mintMixed'}[doc.objectType];
      const iface = new ethers.utils.Interface(abi), decoded = iface.decodeFunctionData(method, job.calldata);
      if (iface.encodeFunctionData(method, decoded).toLowerCase() !== job.calldata.toLowerCase()) throw new Error('Issuance calldata mismatch');
      async function checkWallet() {
        const [chain, accounts, block] = await Promise.all([ethereum.request({method:'eth_chainId'}), ethereum.request({method:'eth_accounts'}), ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]})]);
        if (Number(chain) !== 137 || !Array.isArray(accounts) || accounts.length !== 1 || String(accounts[0]).toLowerCase() !== wallet.toLowerCase()) throw new Error('Wallet account or network changed');
        if (!block || !/^0x[0-9a-f]+$/i.test(block.timestamp || '')) throw new Error('Chain time unavailable');
        const time = new Date(Number(block.timestamp) * 1000);
        if (!Number.isFinite(time.getTime()) || time.getUTCFullYear() !== doc.year || time.getUTCMonth()+1 !== doc.month) throw new Error('Issuance month changed');
      }
      await checkWallet();
      if (job.identity.creatorId[0] === 'C') {
        const code = await ethereum.request({method:'eth_getCode',params:[wallet,'latest']});
        if (typeof code !== 'string' || code.toLowerCase() !== '0x') throw new Error('A personal profile requires an externally owned account');
      }
      const tx = { from:wallet, to:job.identity.registry, data:job.calldata, value:'0x0' };
      await ethereum.request({method:'eth_estimateGas',params:[tx]});
      await checkWallet();
      await store.transition(db, operationId, 'prepared', 'handoff', null, options);
      let hash;
      try { hash = await ethereum.request({method:'eth_sendTransaction',params:[tx]}); }
      catch (error) {
        if (error && error.code === 4001) { await store.transition(db, operationId, 'handoff', 'prepared', null, options); return { state:'rejected' }; }
        return { state:'unresolved', transactionHash:null };
      }
      if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) return { state:'unresolved', transactionHash:null };
      try { await store.transition(db, operationId, 'handoff', 'submitted', {transactionHash:hash.toLowerCase()}, options); }
      catch (_) { return { state:'unresolved', transactionHash:hash.toLowerCase() }; }
      return { state:'submitted', transactionHash:hash.toLowerCase() };
    });
  }
  /** Submit a Safe App proposal after persisting the same immutable job and checking the Safe nonce. */
  async function sendSafe({ db, operationId, expectedFingerprint, backupBytes, reader, ethereum, wallet, locks, abi, ethers, sdk }) {
    if (!db || !reader || !ethereum || !sdk || !sdk.safe || !sdk.txs || !safeTools || !locks || typeof locks.request !== 'function' || !ethers || !ethers.utils.isAddress(wallet)) throw new Error('Safe prerequisites unavailable');
    const normalized=wallet.toLowerCase(), options={abi,ethers}, key='odp-v07-issue:'+normalized+':'+operationId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if (!lock) throw new Error('Issuance already in progress');
      const job=await store.get(db,operationId,options);
      if (!job || job.state!=='prepared' || job.identity.issuer!==normalized || job.fingerprint!==expectedFingerprint || !['B','P','M'].includes(job.identity.creatorId[0])) throw new Error('Invalid Safe issuance job');
      const restored=await backup.restore(backupBytes,options);
      if (restored.state!=='prepared' || restored.fingerprint!==job.fingerprint) throw new Error('Issuance backup does not match');
      const op=await reader.readMintOperation(wallet,operationId,job.identity.digest);
      if (op.state!=='not-finalized') throw new Error('Operation may already be committed');
      const profile=await reader.readProfileByWallet(wallet);
      if (!profile.profile || profile.profile.creatorId!==job.identity.creatorId) throw new Error('Issuer profile changed');
      const doc=canonical.parseJSON(job.canonicalPassport), method={physical:'mintPhysical',digital:'mintDigital',mixed:'mintMixed'}[doc.objectType];
      const iface=new ethers.utils.Interface(abi), decoded=iface.decodeFunctionData(method,job.calldata);
      if (iface.encodeFunctionData(method,decoded).toLowerCase()!==job.calldata.toLowerCase()) throw new Error('Issuance calldata mismatch');
      async function context() {
        const [info,chain,accounts,block]=await Promise.all([sdk.safe.getInfo(),ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]})]);
        if (!info || String(info.safeAddress).toLowerCase()!==normalized || Number(info.chainId)!==137 || info.isReadOnly || info.version!=='1.4.1' || !Number.isSafeInteger(info.nonce) || info.nonce<0 ||
            Number(chain)!==137 || !Array.isArray(accounts) || accounts.length!==1 || String(accounts[0]).toLowerCase()!==normalized || !block || !/^0x[0-9a-f]+$/i.test(block.timestamp||'')) throw new Error('Safe context changed');
        const now=Number(block.timestamp), deadline=Date.UTC(doc.year,doc.month,1)/1000;
        if (!Number.isSafeInteger(now) || now>=deadline || new Date(now*1000).getUTCFullYear()!==doc.year || new Date(now*1000).getUTCMonth()+1!==doc.month) throw new Error('Issuance month changed');
        return {nonce:String(info.nonce),deadline,now};
      }
      const first=await context(), plan=safeTools.proposal({safe:wallet,nonce:first.nonce,data:job.calldata,action:'mint',deadline:first.deadline,now:first.now,ethers});
      const second=await context(); if (second.nonce!==first.nonce) throw new Error('Safe nonce changed');
      await store.transition(db,operationId,'prepared','handoff',null,options);
      let response;
      try { response=await sdk.txs.send({txs:[{to:job.identity.registry,value:'0',data:job.calldata}],params:{safeTxGas:0}}); }
      catch (_) { return {state:'unresolved'}; }
      if (!response || typeof response.safeTxHash!=='string' || response.safeTxHash.toLowerCase()!==plan.safeTxHash) return {state:'unresolved'};
      try { await store.transition(db,operationId,'handoff','safe_pending',{safeProposal:{nonce:first.nonce,safeTxHash:plan.safeTxHash,deadline:first.deadline}},options); }
      catch (_) { return {state:'unresolved'}; }
      return {state:'safe_pending',safeTxHash:plan.safeTxHash};
    });
  }
  /** Propose a zero-value Safe transaction at the expired proposal's exact nonce. */
  async function rejectExpiredSafe({db,operationId,expectedFingerprint,reader,ethereum,wallet,locks,abi,ethers,sdk}) {
    if(!db||!reader||!ethereum||!sdk||!sdk.safe||!sdk.txs||!locks||!safeTools||!ethers||!ethers.utils.isAddress(wallet))throw Error('Safe rejection prerequisites unavailable');
    const options={abi,ethers},normalized=wallet.toLowerCase(),key='odp-v07-issue:'+normalized+':'+operationId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Issuance already in progress');
      const job=await store.get(db,operationId,options);
      if(!job||job.state!=='safe_pending'||job.safeRejection||job.identity.issuer!==normalized||job.fingerprint!==expectedFingerprint)throw Error('Safe proposal changed or rejection already requested');
      const op=await reader.readMintOperation(wallet,operationId,job.identity.digest);if(op.state!=='not-finalized')throw Error('Operation may already be committed');
      async function context(){
        const [info,chain,accounts,block]=await Promise.all([sdk.safe.getInfo(),ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]})]);
        if(!info||String(info.safeAddress).toLowerCase()!==normalized||Number(info.chainId)!==137||info.isReadOnly||info.version!=='1.4.1'||!Number.isSafeInteger(info.nonce)||String(info.nonce)!==job.safeProposal.nonce||Number(chain)!==137||!Array.isArray(accounts)||accounts.length!==1||String(accounts[0]).toLowerCase()!==normalized||!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp))||Number(block.timestamp)<job.safeProposal.deadline)throw Error('Safe proposal is not eligible for rejection');
      }
      await context();
      const original=safeTools.proposal({safe:wallet,nonce:job.safeProposal.nonce,data:job.calldata,action:'mint',deadline:job.safeProposal.deadline,now:0,ethers});
      const rejection=safeTools.rejection(original,0,ethers);await context();
      await store.transition(db,operationId,'safe_pending','safe_pending',{safeRejection:{safeTxHash:rejection.safeTxHash,state:'before-wallet'}},options);
      let response;try{response=await sdk.txs.send({txs:[{to:normalized,value:'0',data:'0x'}],params:{safeTxGas:0}});}catch(_){return {state:'unresolved'};}
      if(!response||typeof response.safeTxHash!=='string'||response.safeTxHash.toLowerCase()!==rejection.safeTxHash)return {state:'unresolved'};
      try{await store.transition(db,operationId,'safe_pending','safe_pending',{safeRejection:{safeTxHash:rejection.safeTxHash,state:'pending'}},options);}catch(_){return {state:'unresolved'};}
      return {state:'safe_rejection_pending',safeTxHash:rejection.safeTxHash};
    });
  }
  async function reprepareAfterSafeRejection({db,operationId,expectedFingerprint,transactionHash,reader,ethereum,wallet,locks,abi,ethers,sdk}) {
    if(!db||!reader||typeof reader.verifySafeRejection!=='function'||!ethereum||!sdk||!sdk.safe||!locks||!jobs||!ethers||!ethers.utils.isAddress(wallet))throw Error('Safe re-preparation prerequisites unavailable');
    const normalized=wallet.toLowerCase(),options={abi,ethers},key='odp-v07-issue:'+normalized+':'+operationId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Issuance already in progress');
      const job=await store.get(db,operationId,options);
      if(!job||job.state!=='safe_pending'||!job.safeRejection||job.safeRejection.state!=='pending'||job.identity.issuer!==normalized||job.fingerprint!==expectedFingerprint)throw Error('Safe rejection job changed');
      await reader.verifySafeRejection(transactionHash,normalized,job.safeRejection.safeTxHash);
      if((await reader.readMintOperation(wallet,operationId,job.identity.digest)).state!=='not-finalized')throw Error('Operation may already be committed');
      const [info,chain,accounts,block,profile]=await Promise.all([sdk.safe.getInfo(),ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]}),reader.readProfileByWallet(wallet)]);
      if(!info||String(info.safeAddress).toLowerCase()!==normalized||Number(info.chainId)!==137||info.isReadOnly||info.version!=='1.4.1'||!Number.isSafeInteger(info.nonce)||BigInt(info.nonce)<=BigInt(job.safeProposal.nonce)||Number(chain)!==137||!Array.isArray(accounts)||accounts.length!==1||String(accounts[0]).toLowerCase()!==normalized||!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp))||!profile.profile||profile.profile.creatorId!==job.identity.creatorId)throw Error('Safe re-preparation context changed');
      const timestamp=Number(block.timestamp),date=new Date(timestamp*1000),doc=canonical.parseJSON(job.canonicalPassport);
      if(!Number.isFinite(date.getTime())||timestamp<job.safeProposal.deadline)throw Error('New issuance month is not available');
      const iso=date.toISOString().replace('.000Z','Z');doc.year=date.getUTCFullYear();doc.month=date.getUTCMonth()+1;doc.registeredAt=timestamp;doc.registration={ianaTimeZone:'UTC',localIso8601:iso.replace('Z','+00:00'),utcIso8601:iso};
      const updated=await jobs.prepare({document:doc,originals:job.originals,profile:profile.profile,wallet,abi,ethers,operationId});
      if((await reader.readMintOperation(wallet,operationId,job.identity.digest)).state!=='not-finalized')throw Error('Operation may already be committed');
      await store.replaceAfterCancellation(db,job,updated,options);
      return {state:'prepared',fingerprint:updated.fingerprint};
    });
  }
  /** Caller must explicitly confirm that no signed or pending copy exists on any device. */
  async function recoverUnsent({db,operationId,expectedFingerprint,backupBytes,reader,ethereum,wallet,locks,abi,ethers}) {
    if(!db||!reader||!ethereum||!locks||typeof locks.request!=='function'||!ethers||!ethers.utils.isAddress(wallet))throw Error('Recovery prerequisites unavailable');
    const options={abi,ethers},normalized=wallet.toLowerCase(),key='odp-v07-issue:'+normalized+':'+operationId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Issuance already in progress');
      const job=await store.get(db,operationId,options);
      if(!job||job.state!=='handoff'||job.identity.issuer!==normalized||job.fingerprint!==expectedFingerprint)throw Error('Recovery job changed');
      const restored=await backup.restore(backupBytes,options);
      if(restored.state!=='prepared'||restored.fingerprint!==job.fingerprint)throw Error('Prepared backup does not match');
      async function check(){
        const [chain,accounts,code,latest,pending,block,op]=await Promise.all([ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getCode',params:[wallet,'latest']}),ethereum.request({method:'eth_getTransactionCount',params:[wallet,'latest']}),ethereum.request({method:'eth_getTransactionCount',params:[wallet,'pending']}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]}),reader.readMintOperation(wallet,operationId,job.identity.digest)]);
        if(Number(chain)!==137||!Array.isArray(accounts)||accounts.length!==1||String(accounts[0]).toLowerCase()!==normalized||typeof code!=='string'||code.toLowerCase()!=='0x'||!/^0x[0-9a-f]+$/i.test(latest||'')||!/^0x[0-9a-f]+$/i.test(pending||'')||BigInt(latest)!==BigInt(pending)||!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp))||op.state!=='not-finalized')throw Error('Wallet or pending transaction cannot be verified');
        const date=new Date(Number(block.timestamp)*1000),doc=canonical.parseJSON(job.canonicalPassport);
        if(!Number.isFinite(date.getTime())||date.getUTCFullYear()!==doc.year||date.getUTCMonth()+1!==doc.month)throw Error('Issuance month changed');
      }
      await check();await check();
      await store.transition(db,operationId,'handoff','prepared',null,options);
      return {state:'prepared'};
    });
  }
  /** Caller must have explicitly reviewed wallet history and requested a retry. */
  async function recoverFailed({ db, operationId, expectedFingerprint, reader, ethereum, wallet, locks, abi, ethers }) {
    if (!db || !reader || typeof reader.verifyFailedMint !== 'function' || !ethereum || !locks || typeof locks.request !== 'function' || !ethers || !ethers.utils.isAddress(wallet)) throw new Error('Recovery prerequisites unavailable');
    const options={abi,ethers}, normalized=wallet.toLowerCase(), key='odp-v07-issue:'+normalized+':'+operationId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if (!lock) throw new Error('Issuance already in progress');
      const job=await store.get(db,operationId,options);
      if (!job || job.state!=='submitted' || job.identity.issuer!==normalized || job.fingerprint!==expectedFingerprint) throw new Error('Recovery job changed');
      const operation=await reader.readMintOperation(wallet,operationId,job.identity.digest);
      if (operation.state!=='not-finalized') throw new Error('Operation may already be committed');
      await reader.verifyFailedMint(job.transactionHash,wallet,job.calldata);
      const [chain,accounts,latest,pending]=await Promise.all([
        ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),
        ethereum.request({method:'eth_getTransactionCount',params:[wallet,'latest']}),ethereum.request({method:'eth_getTransactionCount',params:[wallet,'pending']})
      ]);
      if (Number(chain)!==137 || !Array.isArray(accounts) || accounts.length!==1 || String(accounts[0]).toLowerCase()!==normalized ||
          !/^0x[0-9a-f]+$/i.test(latest||'') || !/^0x[0-9a-f]+$/i.test(pending||'') || BigInt(latest)!==BigInt(pending)) throw new Error('Wallet changed or pending transactions remain');
      // Recheck after all network calls; an absent finalized operation is not by itself proof that a transaction failed.
      if ((await reader.readMintOperation(wallet,operationId,job.identity.digest)).state!=='not-finalized') throw new Error('Operation may already be committed');
      await store.transition(db,operationId,'submitted','prepared',null,options);
      return {state:'prepared'};
    });
  }
  return Object.freeze({ send, sendSafe, rejectExpiredSafe, reprepareAfterSafeRejection, recoverFailed, recoverUnsent });
});
