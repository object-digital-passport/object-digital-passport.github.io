/* Deterministic Safe v1.4.1 proposal identity; no signing or submission. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ODPV07Safe = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const REGISTRY='0x3281492981dcd492cc2f7c17398134e1d3b5ca1f', ZERO='0x0000000000000000000000000000000000000000';
  const types={SafeTx:[{name:'to',type:'address'},{name:'value',type:'uint256'},{name:'data',type:'bytes'},{name:'operation',type:'uint8'},{name:'safeTxGas',type:'uint256'},{name:'baseGas',type:'uint256'},{name:'gasPrice',type:'uint256'},{name:'gasToken',type:'address'},{name:'refundReceiver',type:'address'},{name:'nonce',type:'uint256'}]};
  function proposal({safe,nonce,data,action,deadline,now,ethers}) {
    if (!ethers || !ethers.utils || !ethers.utils.isAddress(safe) || !['mint','register','revoke','finalize','reject'].includes(action) ||
        !/^(0|[1-9][0-9]{0,77})$/.test(String(nonce)) || BigInt(nonce) >= (1n << 256n) || !Number.isSafeInteger(deadline) || deadline<0 || (['mint','revoke'].includes(action) && deadline===0) || !Number.isSafeInteger(now) || now<0 ||
        !/^0x(?:[0-9a-f]{2})*$/i.test(data || '') || (action!=='reject' && data.length<10) || (action==='reject' && data!=='0x')) throw new Error('Invalid Safe proposal');
    const tx={to:action==='reject'?safe.toLowerCase():REGISTRY,value:'0',data:data.toLowerCase(),operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:ZERO,refundReceiver:ZERO,nonce:String(nonce)};
    const safeTxHash=ethers.utils._TypedDataEncoder.hash({chainId:137,verifyingContract:safe},types,tx).toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(safeTxHash)) throw new Error('Invalid Safe hash');
    const status=deadline && (action==='revoke'?now>deadline:now>=deadline)?'expired':deadline && deadline-now<=86400?'near':'ready';
    return Object.freeze({safe:safe.toLowerCase(),chainId:137,action,deadline,tx:Object.freeze(tx),safeTxHash,status});
  }
  function rejection(original, now, ethers) {
    if (!original || !original.tx || original.action==='reject') throw new Error('Invalid original proposal');
    return proposal({safe:original.safe,nonce:original.tx.nonce,data:'0x',action:'reject',deadline:0,now,ethers});
  }
  return Object.freeze({proposal,rejection});
});
