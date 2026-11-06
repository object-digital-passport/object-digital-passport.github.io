/* Revocation and print finalization. The caller supplies explicit wallet consent. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-safe-ops.js'));
  else root.ODPV07Release = factory(root.ODPV07SafeOps);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (safeOps) {
  'use strict';
  const REGISTRY = '0x3281492981dcd492cc2f7c17398134e1d3b5ca1f';
  function prepare({ action, passportId, reasonHash, record, wallet, abi, ethers }) {
    if (!['revoke', 'finalize'].includes(action) || !/^ODP-[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{9}$/.test(passportId || '') ||
        !ethers || !ethers.utils.isAddress(wallet) || !Array.isArray(abi) || !record || record.header.passportId !== passportId ||
        String(record.header.creator).toLowerCase() !== wallet.toLowerCase() || record.registry !== REGISTRY || record.chainId !== 137 ||
        !Number.isSafeInteger(record.blockTimestamp) || record.blockTimestamp < 0) throw new Error('Invalid release context');
    if (record.classification.revoked) return { state: action === 'revoke' ? 'completed' : 'revoked' };
    if (BigInt(record.release.printFinalizedAt.toString()) !== 0n) return { state: action === 'finalize' ? 'completed' : 'finalized' };
    if (action === 'revoke') {
      if (!/^0x[0-9a-f]{64}$/i.test(reasonHash || '') || /^0x0{64}$/i.test(reasonHash)) throw new Error('Invalid revocation reason hash');
      if (BigInt(record.blockTimestamp) > BigInt(record.release.revocationDeadline.toString())) return { state: 'expired' };
    }
    const method = action === 'revoke' ? 'revokePassport' : 'finalizePassportForPrint';
    const data = new ethers.utils.Interface(abi).encodeFunctionData(method, action === 'revoke' ? [passportId, reasonHash] : [passportId]);
    return { state: 'ready', chainId: 137, registry: REGISTRY, action, passportId, data, deadline: record.release.revocationDeadline.toString(), snapshot: record.blockNumber };
  }
  async function send({ action, passportId, reasonHash, wallet, reader, ethereum, storage, locks, abi, ethers }) {
    if (!reader || !ethereum || !storage || !locks || typeof locks.request !== 'function' || !ethers || !ethers.utils.isAddress(wallet)) throw new Error('Release prerequisites unavailable');
    const normalized = wallet.toLowerCase(), key = 'odp-v07-release:' + REGISTRY + ':' + normalized + ':' + passportId;
    return locks.request(key, { ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Release operation already in progress');
      let pending; try { pending = storage.getItem(key); } catch (_) { throw new Error('Release journal unavailable'); }
      const record = await reader.readPassport(passportId);
      const plan = prepare({ action, passportId, reasonHash, record, wallet, abi, ethers });
      if (plan.state !== 'ready') return plan;
      if (pending !== null) return { state: 'unresolved' };
      const checkWallet = async () => {
        const [chain, accounts] = await Promise.all([ethereum.request({ method:'eth_chainId' }), ethereum.request({ method:'eth_accounts' })]);
        if (Number(chain) !== 137 || !Array.isArray(accounts) || accounts.length !== 1 || String(accounts[0]).toLowerCase() !== normalized) throw new Error('Wallet account or network changed');
      };
      await checkWallet();
      const tx = { from:wallet, to:REGISTRY, data:plan.data, value:'0x0' };
      await ethereum.request({ method:'eth_estimateGas', params:[tx] });
      await checkWallet();
      const journal = JSON.stringify({ version:1, wallet:normalized, registry:REGISTRY, passportId, action, state:'before-wallet' });
      try { storage.setItem(key,journal); if (storage.getItem(key) !== journal) throw new Error('write'); } catch (_) { throw new Error('Release journal unavailable'); }
      let hash;
      try { hash = await ethereum.request({ method:'eth_sendTransaction', params:[tx] }); }
      catch (error) { if (error && error.code === 4001) { try { storage.removeItem(key); } catch (_) {} return { state:'rejected' }; } return { state:'unresolved' }; }
      if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) return { state:'unresolved' };
      try { storage.setItem(key, JSON.stringify({ version:1, wallet:normalized, registry:REGISTRY, passportId, action, state:'submitted', hash:hash.toLowerCase() })); } catch (_) {}
      return { state:'submitted', hash };
    });
  }
  async function sendSafe({action,passportId,reasonHash,wallet,reader,ethereum,storage,locks,abi,ethers,sdk}) {
    if(!reader||!storage||!locks||!safeOps||!ethers||!ethers.utils.isAddress(wallet))throw Error('Safe release prerequisites unavailable');
    const key='odp-v07-release:'+REGISTRY+':'+wallet.toLowerCase()+':'+passportId;
    return locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Release operation already in progress');
      const record=await reader.readPassport(passportId);
      if(!record.header.creatorId||!['B','P','M'].includes(record.header.creatorId[0]))throw Error('Invalid Safe issuer');
      const plan=prepare({action,passportId,reasonHash,record,wallet,abi,ethers}),existing=storage.getItem(key);
      if(plan.state==='completed'||plan.state==='revoked'||plan.state==='finalized')return plan;
      if(existing!==null){try{const previous=JSON.parse(existing);if(previous.kind==='safe'&&previous.state==='pending')return {state:previous.deadline&&record.blockTimestamp>previous.deadline?'safe_expired':'safe_pending'};}catch(_){}return {state:'unresolved'};}
      if(plan.state!=='ready')return plan;
      const deadline=action==='revoke'?Number(plan.deadline):0;
      if(!Number.isSafeInteger(deadline))throw Error('Invalid Safe deadline');
      return safeOps.submit({sdk,ethereum,wallet,data:plan.data,action,deadline,storage,key,ethers});
    });
  }
  async function safeStatus({passportId,wallet,reader,ethereum,storage,abi,ethers}) {
    if(!reader||!ethereum||!storage||!safeOps||!ethers||!ethers.utils.isAddress(wallet))throw Error('Safe status unavailable');
    const key='odp-v07-release:'+REGISTRY+':'+wallet.toLowerCase()+':'+passportId,record=await reader.readPassport(passportId);
    if(!record||record.header.passportId!==passportId||String(record.header.creator).toLowerCase()!==wallet.toLowerCase()||!['B','P','M'].includes(String(record.header.creatorId)[0]))throw Error('Invalid Safe issuer');
    if(record.classification.revoked)return {state:'completed'};
    if(BigInt(record.release.printFinalizedAt.toString())!==0n)return {state:'finalized'};
    const raw=storage.getItem(key);if(raw===null)return {state:'no_safe_proposal'};
    let journal;try{journal=JSON.parse(raw);}catch(_){throw Error('Invalid Safe journal');}
    if(journal.kind!=='safe'||journal.state!=='pending')return {state:'unresolved'};
    if(journal.action!=='revoke')return {state:'safe_pending'};
    const iface=new ethers.utils.Interface(abi),decoded=iface.decodeFunctionData('revokePassport',journal.data);
    if(decoded[0]!==passportId||iface.encodeFunctionData('revokePassport',decoded).toLowerCase()!==journal.data.toLowerCase())throw Error('Safe journal passport mismatch');
    const deadline=Number(record.release.revocationDeadline.toString());
    safeOps.inspect({journal,wallet,action:'revoke',deadline,ethers});
    if(journal.rejection)return {state:journal.rejection.state==='pending'?'safe_rejection_pending':'unresolved',journal,key};
    const block=await ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]});
    if(!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp)))throw Error('Chain time unavailable');
    return {state:Number(block.timestamp)>deadline?'safe_expired':'safe_pending',journal,key};
  }
  async function rejectExpiredSafe(args) {
    if(!args.locks||typeof args.locks.request!=='function'||!args.sdk)throw Error('Safe rejection unavailable');
    const key='odp-v07-release:'+REGISTRY+':'+args.wallet.toLowerCase()+':'+args.passportId;
    return args.locks.request(key,{ifAvailable:true},async lock=>{
      if(!lock)throw Error('Release operation already in progress');
      const status=await safeStatus(args);if(status.state!=='safe_expired')throw Error('Safe revocation is not eligible for rejection');
      return safeOps.reject({sdk:args.sdk,ethereum:args.ethereum,wallet:args.wallet,storage:args.storage,key,journal:status.journal,ethers:args.ethers});
    });
  }
  return Object.freeze({ prepare, send, sendSafe, safeStatus, rejectExpiredSafe });
});
