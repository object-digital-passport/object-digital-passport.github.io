const {test}=require('node:test');
const assert=require('node:assert/strict');
const deadline=require('../js/odp-v07-deadline.js');
test('month deadline uses UTC across year and leap-day boundaries',()=>{
  const end=Date.UTC(2028,2,1)/1000;
  assert.deepEqual(deadline.issuance(2028,2,end-86401),{end,status:'open'});
  assert.deepEqual(deadline.issuance(2028,2,end-86400),{end,status:'near'});
  assert.deepEqual(deadline.issuance(2028,2,end),{end,status:'expired'});
  assert.equal(deadline.issuance(2026,12,0).end,Date.UTC(2027,0,1)/1000);
  assert.throws(()=>deadline.issuance(2026,13,0));
});
