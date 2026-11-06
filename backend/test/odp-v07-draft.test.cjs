const { test } = require('node:test');
const assert = require('node:assert/strict');
const draft = require('../js/odp-v07-draft.js');
const passport = require('../js/odp-v07-passport.js');

function input(objectType) { return {objectType,title:'Object',authorName:'Author',shortDescription:'Description',domain:'art',contentClass:'static',status:'produced_object',aiStatus:'none',timestamp:1774204245,width:'20',height:'30',unit:'CMT',materials:'wood, paint',features:'signature',physicalCategory:'artwork',photo:new TextEncoder().encode('photo'),digitalFile:new TextEncoder().encode('digital'),digitalSubtype:'image',digitalFormat:'PNG'}; }
test('three form paths build schema-valid passports and matching required anchors', async () => {
  for (const type of ['physical','digital','mixed']) {
    const {document, originals} = await draft.build(input(type));
    const p = await passport.preparePassport(document, {issuerType:'C'});
    assert.equal(p.document.objectType,type);
    assert.equal(originals.length,type === 'mixed' ? 2 : 1);
    assert.equal(p.mint.anchorTypesMask,type === 'physical' ? 15 : type === 'digital' ? 32 : 47);
  }
});
test('missing originals or invalid physical dimensions never yield a draft', async () => {
  await assert.rejects(draft.build({...input('physical'),photo:new Uint8Array()}), /photo/);
  await assert.rejects(draft.build({...input('physical'),width:'0'}), /dimensions/);
  await assert.rejects(draft.build({...input('digital'),digitalFile:null}), /digital file/);
});
