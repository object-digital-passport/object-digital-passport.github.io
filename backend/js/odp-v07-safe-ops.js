/* Shared Safe App hand-off: caller holds a journal lock and has checked the registry. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./odp-v07-safe.js'));else root.ODPV07SafeOps=factory(root.ODPV07Safe);})(typeof globalThis!=='undefined'?globalThis:this,function(safeTools){
  'use strict';
  async function submit({sdk,ethereum,wallet,data,action,deadline,storage,key,ethers}) {
    if(!sdk||!sdk.safe||!sdk.txs||!ethereum||!storage||!key||!safeTools||!ethers||!ethers.utils.isAddress(wallet))throw Error('Safe prerequisites unavailable');
    const normalized=wallet.toLowerCase();
    async function context(){
      const [info,chain,accounts,block]=await Promise.all([sdk.safe.getInfo(),ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]})]);
      if(!info||String(info.safeAddress).toLowerCase()!==normalized||Number(info.chainId)!==137||info.isReadOnly||info.version!=='1.4.1'||!Number.isSafeInteger(info.nonce)||info.nonce<0||Number(chain)!==137||!Array.isArray(accounts)||accounts.length!==1||String(accounts[0]).toLowerCase()!==normalized||!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp)))throw Error('Safe context changed');
      return {nonce:String(info.nonce),now:Number(block.timestamp)};
    }
    const first=await context(), plan=safeTools.proposal({safe:wallet,nonce:first.nonce,data,action,deadline,now:first.now,ethers});
    if(plan.status==='expired')return {state:'safe_expired'};
    const second=await context();if(second.nonce!==first.nonce||(deadline&&second.now>deadline))throw Error('Safe context changed');
    const journal=JSON.stringify({version:1,kind:'safe',wallet:normalized,registry:plan.tx.to,action,data:plan.tx.data,nonce:first.nonce,safeTxHash:plan.safeTxHash,deadline,state:'before-wallet'});
    try{storage.setItem(key,journal);if(storage.getItem(key)!==journal)throw Error('write');}catch(_){throw Error('Safe journal unavailable');}
    let response;try{response=await sdk.txs.send({txs:[{to:plan.tx.to,value:'0',data:plan.tx.data}],params:{safeTxGas:0}});}catch(_){return {state:'unresolved'};}
    if(!response||typeof response.safeTxHash!=='string'||response.safeTxHash.toLowerCase()!==plan.safeTxHash)return {state:'unresolved'};
    try{storage.setItem(key,JSON.stringify({...JSON.parse(journal),state:'pending'}));}catch(_){}
    return {state:'safe_pending',safeTxHash:plan.safeTxHash,nonce:first.nonce};
  }
  function inspect({journal,wallet,action,deadline,ethers}) {
    if(!journal||journal.kind!=='safe'||journal.wallet!==wallet.toLowerCase()||journal.action!==action||journal.deadline!==deadline||journal.state!=='pending')throw Error('Safe journal mismatch');
    const plan=safeTools.proposal({safe:wallet,nonce:journal.nonce,data:journal.data,action,deadline,now:0,ethers});
    if(plan.safeTxHash!==journal.safeTxHash||journal.registry!==plan.tx.to)throw Error('Safe journal hash mismatch');
    if(journal.rejection){const r=safeTools.rejection(plan,0,ethers);if(!['before-wallet','pending'].includes(journal.rejection.state)||r.safeTxHash!==journal.rejection.safeTxHash)throw Error('Safe rejection mismatch');}
    return plan;
  }
  async function reject({sdk,ethereum,wallet,storage,key,journal,ethers}) {
    const original=inspect({journal,wallet,action:'revoke',deadline:journal.deadline,ethers});
    if(journal.rejection)throw Error('Safe rejection already requested');
    const normalized=wallet.toLowerCase();
    async function context(){const [info,chain,accounts,block]=await Promise.all([sdk.safe.getInfo(),ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'}),ethereum.request({method:'eth_getBlockByNumber',params:['latest',false]})]);
      if(!info||String(info.safeAddress).toLowerCase()!==normalized||Number(info.chainId)!==137||info.isReadOnly||info.version!=='1.4.1'||!Number.isSafeInteger(info.nonce)||String(info.nonce)!==original.tx.nonce||Number(chain)!==137||!Array.isArray(accounts)||accounts.length!==1||String(accounts[0]).toLowerCase()!==normalized||!block||!/^0x[0-9a-f]+$/i.test(block.timestamp||'')||!Number.isSafeInteger(Number(block.timestamp))||Number(block.timestamp)<=journal.deadline)throw Error('Safe rejection is not eligible');}
    await context();const plan=safeTools.rejection(original,0,ethers);await context();
    const saved=JSON.stringify({...journal,rejection:{state:'before-wallet',safeTxHash:plan.safeTxHash}});
    try{storage.setItem(key,saved);if(storage.getItem(key)!==saved)throw Error('write');}catch(_){throw Error('Safe journal unavailable');}
    let response;try{response=await sdk.txs.send({txs:[{to:normalized,value:'0',data:'0x'}],params:{safeTxGas:0}});}catch(_){return {state:'unresolved'};}
    if(!response||typeof response.safeTxHash!=='string'||response.safeTxHash.toLowerCase()!==plan.safeTxHash)return {state:'unresolved'};
    try{storage.setItem(key,JSON.stringify({...JSON.parse(saved),rejection:{state:'pending',safeTxHash:plan.safeTxHash}}));}catch(_){}
    return {state:'safe_rejection_pending'};
  }
  return Object.freeze({submit,inspect,reject});
});
