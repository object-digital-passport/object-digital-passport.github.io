const {test}=require('node:test'),assert=require('node:assert/strict'),safe=require('../js/odp-v07-safe.js');
const wallet='0x'+'1'.repeat(40), ethers={utils:{isAddress:x=>x===wallet,_TypedDataEncoder:{hash:(domain,types,tx)=>{assert.equal(domain.chainId,137);assert.equal(types.SafeTx.length,10);return '0x'+'a'.repeat(64);}}}};
test('Safe proposal binds zero-gas parameters, nonce and deadline; rejection uses same nonce',()=>{
  const p=safe.proposal({safe:wallet,nonce:'42',data:'0x12345678',action:'mint',deadline:200000,now:120000,ethers});
  assert.equal(p.status,'near');assert.equal(p.tx.nonce,'42');assert.equal(p.tx.safeTxGas,'0');
  const r=safe.rejection(p,120000,ethers);assert.equal(r.tx.nonce,p.tx.nonce);assert.equal(r.tx.to,wallet);assert.equal(r.tx.data,'0x');
  assert.equal(safe.proposal({safe:wallet,nonce:'42',data:'0x12345678',action:'mint',deadline:200000,now:200000,ethers}).status,'expired');
  assert.throws(()=>safe.proposal({safe:wallet,nonce:'01',data:'0x12345678',action:'mint',deadline:1,now:0,ethers}));
});
