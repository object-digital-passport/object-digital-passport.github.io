/* Browser adaptation of specifications/chain/tools/passport.mjs at d9e1a22. */
(function (root, factory) {
 if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'), require('./odp-v07-schemas.bundle.js'));
 else root.ODPV07Passport = factory(root.ODPV07Canonical, root.ODPV07Schemas);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonicalLib, schemas) {
'use strict';
const {canonicalize, canonicalHash, parseJSON} = canonicalLib;
const validate = schemas.passport;
function editionCommitment({chainId,registry,issuer,satellite,editionNonce,merkleRoot,unitCount,labelSigner}, ethers) {
 if (!ethers || !ethers.utils || !ethers.utils.isAddress(issuer)) throw new Error('Edition hashing unavailable');
 const root = fromHash(merkleRoot), signer = labelSigner || '0x' + '00'.repeat(20);
 if (BigInt(root) === 0n || BigInt(editionNonce) === 0n || ![registry,issuer,satellite].every(a => ethers.utils.isAddress(a) && !/^0x0{40}$/i.test(a)) || !ethers.utils.isAddress(signer) || BigInt(chainId) <= 0n || !Number.isInteger(Number(unitCount)) || Number(unitCount) < 1 || Number(unitCount) > 1048576) throw new Error('Invalid edition context');
 return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string','uint256','address','address','address','bytes32','bytes32','uint32','address'], ['ODP-EDITION-COMMITMENT-0.7',chainId,registry,issuer,satellite,editionNonce,root,unitCount,signer]));
}
const codes={contentClass:['static','time_based','spatial','textual','composite','executable'],status:['concept','prototype','produced_object','archived'],aiStatus:['none','assisted','generated'],verificationMethod:['self_asserted','institutional','nfc','c2pa','hybrid'],edition:['unique','limited','open','dynamic']};
const bits={photo:1,dimensions:2,materials:4,distinguishing_features:8,marks:16,file_hash:32,perceptual_hash:64,c2pa:128,nfc:256,numbered_seal:512,fingerprint:1024,dna:2048,unit_key_set:4096,unit_variant_commit:8192};
const zero='0x'+'00'.repeat(32);
const fromHash=s=>{if(!/^sha256:[0-9a-f]{64}$/.test(s??''))throw new Error('Invalid SHA-256 anchor');return '0x'+s.slice(7);};
async function preparePassport(document, {issuer, issuerType, ethers} = {}) {
 // Mint strings are taken from the same NFC-normalized bytes that are hashed.
 const canonical=canonicalize(document),d=parseJSON(canonical);
 if(!validate(d))throw new Error('Schema: '+JSON.stringify(validate.errors));
 // Optional: verifiers do not know the issuer type; issuers that supply it get the ABI7 B-only edition rule.
 if(issuerType!==undefined && !['C','B','P','M'].includes(issuerType))throw new Error('Invalid issuer type');
 for(const [k,max] of [['title',128],['authorName',128],['shortDescription',256],['domain',128]])if(new TextEncoder().encode(d[k]??'').length>max)throw new Error(k+' byte limit');
 if(!Number.isSafeInteger(d.registeredAt))throw new Error('Invalid preparation time');
 const dt=new Date(d.registeredAt*1000),iso=dt.toISOString().replace('.000Z','Z');
 if(d.registration.utcIso8601!==iso || d.registration.localIso8601!==iso.replace('Z','+00:00') || d.year!==dt.getUTCFullYear() || d.month!==dt.getUTCMonth()+1)throw new Error('Inconsistent preparation time');
 if(d.edition.number && d.edition.total && d.edition.number>d.edition.total)throw new Error('Edition number exceeds total');
 // A `role: "preview"` photo is the public lightweight copy (ABI 0.7-redesign-8 previewHash), never the primary photo.
 const allPhotos=d.anchors.filter(a=>a.type==='photo'),previews=allPhotos.filter(a=>a.data?.role==='preview'),photos=allPhotos.filter(a=>a.data?.role!=='preview'),primary=photos.filter(a=>a.data?.role==='primary');
 if(primary.length>1 || (photos.length>1 && primary.length!==1))throw new Error('Ambiguous primary photo');
 if(previews.length>1)throw new Error('Multiple preview photos');
 if(previews.length && primary.length!==1)throw new Error('Preview photo requires a primary photo');
 const photo=primary[0]??photos[0],files=d.anchors.filter(a=>a.type==='file_hash');
 let imageHash=photo?fromHash(photo.hash):zero,fileHash=d.objectType==='physical'?zero:fromHash(d.digital.fileHash);
 const previewHash=previews.length?fromHash(previews[0].hash):zero;
 if((d.objectType!=='digital' && imageHash===zero) || (d.objectType!=='physical' && fileHash===zero))throw new Error('Required nonzero file/image hash');
 // Mirrors core EC(142)/EC(143).
 if(previewHash!==zero && imageHash===zero)throw new Error('Preview photo requires a primary photo');
 if(previewHash!==zero && previewHash===imageHash)throw new Error('Preview photo must differ from the primary photo');
 if(fileHash!==zero && (files.length!==1 || fromHash(files[0].hash)!==fileHash))throw new Error('File hash mismatch or ambiguous file anchor');
 if(d.objectType==='physical' && files.length)throw new Error('Physical object must not declare digital file anchor');
 const unitSets=d.anchors.filter(a=>a.type==='unit_key_set');if(unitSets.length>1)throw new Error('Multiple unit key sets');
 for(const a of unitSets){const x=a.data;if(!['limited','open'].includes(d.edition.model))throw new Error('Unit key set requires edition');if(BigInt(fromHash(x.merkleRoot))===0n || BigInt(x.editionNonce)===0n || /^0x0{40}$/i.test(x.satellite) || /^0x0{40}$/i.test(x.registry))throw new Error('Zero edition context');if(d.edition.total!==undefined && d.edition.total!==x.unitCount)throw new Error('Edition count mismatch');}
 const variants=d.anchors.filter(a=>a.type==='unit_variant_commit');if(variants.length>1)throw new Error('Multiple variant commitments');
 for(const a of variants)if((d.edition.total!==undefined && a.data.unitCount!==d.edition.total) || (unitSets.length && a.data.unitCount!==unitSets[0].data.unitCount))throw new Error('Variant unit count mismatch');
 let mask=0;for(const a of d.anchors)mask=(mask|(Object.hasOwn(bits,a.type)?bits[a.type]:0x80000000))>>>0;
 if(issuerType!==undefined && issuerType!=='B' && (d.edition.model!=='unique' || (mask & (4096|8192))))throw new Error('Only B profiles may issue editions');
 const core={year:d.year,month:d.month,title:d.title,authorName:d.authorName,shortDescription:d.shortDescription,domain:d.domain??'',contentClass:codes.contentClass.indexOf(d.contentClass)+1,lifecycleStatus:codes.status.indexOf(d.status)+1,aiStatus:codes.aiStatus.indexOf(d.aiStatus)+1,verificationMethod:codes.verificationMethod.indexOf(d.verificationMethod)+1,editionModel:codes.edition.indexOf(d.edition.model)+1};
 let commitment=zero;
 if(unitSets.length){if(!issuer)throw new Error('Issuer address required for edition commitment');const a=unitSets[0].data;commitment=editionCommitment({...a,issuer,labelSigner:a.labelSignerKey},ethers);}
 return {document:d,canonical,mint:{core,dataHash:await canonicalHash(d),imageHash,previewHash,fileHash,anchorsHash:await canonicalHash(d.anchors),anchorTypesMask:mask,editionCommitment:commitment}};
}

async function verifyPassport(document,header,media,classification,ethers) {
 const p=await preparePassport(document,{issuer:header.creator,ethers}),m=p.mint;
 for(const k of ['dataHash','imageHash','previewHash','fileHash','anchorsHash','editionCommitment'])if(m[k].toLowerCase()!==String(media[k]).toLowerCase())throw new Error('Hash mismatch: '+k);
 if(BigInt(m.anchorTypesMask)!==BigInt(media.anchorTypesMask))throw new Error('Anchor mask mismatch');
 for(const k of ['title','authorName','shortDescription','domain'])if(m.core[k]!==header[k])throw new Error('Card mismatch: '+k);
 if(header.objectType!==p.document.objectType || BigInt(header.year)!==BigInt(m.core.year) || BigInt(header.month)!==BigInt(m.core.month))throw new Error('Object/calendar mismatch');
 for(const k of ['contentClass','lifecycleStatus','aiStatus','verificationMethod','editionModel'])if(BigInt(m.core[k])!==BigInt(classification[k]))throw new Error('Classification mismatch: '+k);
 return {integrity:true,capabilities:p.document.anchors.map(a=>({type:a.type,status:'unsupported'})),verificationMethod:{method:p.document.verificationMethod,status:'unsupported'},revoked:classification.revoked,registeredOnChainAt:String(classification.timestamp)};
}
return Object.freeze({preparePassport, verifyPassport});
});
