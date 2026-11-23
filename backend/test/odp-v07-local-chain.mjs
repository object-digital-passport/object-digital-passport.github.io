/* Run only against an isolated Hardhat network with chainId 137; never connects to Polygon. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { network } from 'hardhat';
const require = createRequire(import.meta.url);
const site = process.env.ODP_SITE_ROOT, artifactPath = process.env.ODP_TEST_ARTIFACT;
if (!site || !artifactPath) throw new Error('Missing local test paths');
const readerTools = require(site + '/backend/js/odp-v07-reader.js');
const profileTools = require(site + '/backend/js/odp-v07-profile.js');
const mintTools = require(site + '/backend/js/odp-v07-mint.js');
const releaseTools = require(site + '/backend/js/odp-v07-release.js');
const jobTools = require(site + '/backend/js/odp-v07-job.js');
const jobStore = require(site + '/backend/js/odp-v07-job-store.js');
const jobBackup = require(site + '/backend/js/odp-v07-job-backup.js');
const draft = require(site + '/backend/js/odp-v07-draft.js');
const issue = require(site + '/backend/js/odp-v07-issue.js');
const exporter = require(site + '/backend/js/odp-v07-export.js');
const zip = require(site + '/backend/js/odp-v07-zip.js');
const bundle = require(site + '/backend/js/odp-v07-bundle.js');
const safeTools = require(site + '/backend/js/odp-v07-safe.js');
const trustedGeneration = require(site + '/backend/config/odp-0.7/generation.json');
const { IDBFactory } = require(site + '/backend/node_modules/fake-indexeddb');
const abi = require(site + '/backend/config/odp-0.7/ObjectDigitalPassport.json');
const editionAbi = require(site + '/backend/config/odp-0.7/ODPEditionUnits.json');
const artifact = require(artifactPath);
const connection = await network.connect();
const { ethers } = connection, provider = ethers.provider;
assert.equal((await provider.getNetwork()).chainId, 137n);
assert.equal(ethers.keccak256(artifact.deployedBytecode), readerTools.RUNTIME_HASH);
await provider.send('hardhat_setCode', [readerTools.REGISTRY, artifact.deployedBytecode]);
const compat = { Contract: ethers.Contract, utils: { isAddress: ethers.isAddress, keccak256: ethers.keccak256, id: ethers.id,
  hexZeroPad: ethers.zeroPadValue, defaultAbiCoder: ethers.AbiCoder.defaultAbiCoder(), Interface: ethers.Interface } };
// Optional: exercise the same ethers version as the browser, against the same local chain.
const ethers5 = process.env.ODP_ETHERS_V5_MODULE ? require(process.env.ODP_ETHERS_V5_MODULE) : null;
if (ethers5 && ethers5.version !== 'ethers/5.7.2') throw new Error('Expected ethers 5.7.2');
const reader5 = ethers5 ? await readerTools.open(new ethers5.providers.Web3Provider(connection.provider), abi, ethers5) : null;
const accounts = await ethers.getSigners();
// Compare the site's Safe proposal identity with canonical Safe v1.4.1 on the isolated chain.
const safeFixture = require(process.env.ODP_SAFE_FIXTURE), zeroAddress=ethers.ZeroAddress;
const singleton=await (await new ethers.ContractFactory(safeFixture.Safe.abi,safeFixture.Safe.bytecode,accounts[0]).deploy()).waitForDeployment();
const safeFactory=await (await new ethers.ContractFactory(safeFixture.SafeProxyFactory.abi,safeFixture.SafeProxyFactory.bytecode,accounts[0]).deploy()).waitForDeployment();
const initializer=singleton.interface.encodeFunctionData('setup',[[accounts[1].address,accounts[2].address,accounts[3].address],2,zeroAddress,'0x',zeroAddress,zeroAddress,0,zeroAddress]);
const safeCreation=await (await safeFactory.createProxyWithNonce(await singleton.getAddress(),initializer,0)).wait();
const safeEvent=safeCreation.logs.map(log=>{try{return safeFactory.interface.parseLog(log);}catch{return null;}}).find(log=>log?.name==='ProxyCreation');
const safeInstance=new ethers.Contract(safeEvent.args.proxy,safeFixture.Safe.abi,provider);
const safeCompat={utils:{isAddress:ethers.isAddress,_TypedDataEncoder:{hash:ethers.TypedDataEncoder.hash}}};
const safePlan=safeTools.proposal({safe:await safeInstance.getAddress(),nonce:String(await safeInstance.nonce()),data:'0x12345678',action:'mint',deadline:200000,now:120000,ethers:safeCompat});
const safeArgs=p=>[p.tx.to,p.tx.value,p.tx.data,p.tx.operation,p.tx.safeTxGas,p.tx.baseGas,p.tx.gasPrice,p.tx.gasToken,p.tx.refundReceiver,p.tx.nonce];
assert.equal((await safeInstance.getTransactionHash(...safeArgs(safePlan))).toLowerCase(),safePlan.safeTxHash);
const safeReject=safeTools.rejection(safePlan,120000,safeCompat);
assert.equal((await safeInstance.getTransactionHash(...safeArgs(safeReject))).toLowerCase(),safeReject.safeTxHash);
for (let i = 0; i < 4; i++) {
  const prepared = profileTools.prepareRegistration(['C','B','P','M'][i], abi, compat);
  await (await accounts[i].sendTransaction({ to: prepared.to, data: prepared.data })).wait();
}
let reader = await readerTools.open(provider, abi, compat);
const safeTypes={SafeTx:[{name:'to',type:'address'},{name:'value',type:'uint256'},{name:'data',type:'bytes'},{name:'operation',type:'uint8'},{name:'safeTxGas',type:'uint256'},{name:'baseGas',type:'uint256'},{name:'gasPrice',type:'uint256'},{name:'gasToken',type:'address'},{name:'refundReceiver',type:'address'},{name:'nonce',type:'uint256'}]};
const safeSigners=[accounts[1],accounts[2]].sort((a,b)=>BigInt(a.address)<BigInt(b.address)?-1:1);
const signatures=ethers.concat(await Promise.all(safeSigners.map(s=>s.signTypedData({chainId:137,verifyingContract:safeReject.safe},safeTypes,safeReject.tx))));
const cancellation=await (await safeInstance.connect(accounts[1]).execTransaction(...safeArgs(safeReject).slice(0,9),signatures)).wait();
const originalSafeReceipt=provider.getTransactionReceipt.bind(provider);
provider.getTransactionReceipt=async hash=>{const value=await originalSafeReceipt(hash);return value&&{transactionHash:value.hash,blockNumber:value.blockNumber,blockHash:value.blockHash,status:value.status,logs:value.logs};};
try{assert.equal((await reader.verifySafeRejection(cancellation.hash,safeReject.safe,safeReject.safeTxHash)).transactionHash,cancellation.hash.toLowerCase());}
finally{provider.getTransactionReceipt=originalSafeReceipt;}
for (let i = 0; i < 4; i++) {
  const result = await reader.readProfileByWallet(accounts[i].address);
  assert.equal(result.profile.creatorId[0], ['C','B','P','M'][i]);
  const byId = await reader.readProfileById(result.profile.creatorId);
  assert.equal(byId.profile.wallet.toLowerCase(), accounts[i].address.toLowerCase());
}
const journal = new Map();
const storage = { getItem:key => journal.has(key) ? journal.get(key) : null, setItem:(key,value) => journal.set(key,value), removeItem:key => journal.delete(key) };
const locks = { request:async (_key,_options,fn) => fn({}) };
// Run the site's Safe proposal path against a real 2-of-3 synthetic Safe on this chain.
async function verifySafeIssuance(role, kind, safeInstance, expireFirst = false) {
const safeWallet = await safeInstance.getAddress(), safeReader = reader5 || reader;
const safeEthers = ethers5 || { ...compat, utils:{...compat.utils,_TypedDataEncoder:safeCompat.utils._TypedDataEncoder} };
const safeEthereum = {request:async request => {
  if (request.method === 'eth_accounts') return [safeWallet];
  if (request.method === 'eth_sendTransaction') throw Error('Unexpected direct Safe transaction');
  return connection.provider.request(request);
}};
let capturedSafeTx = null, safeProposals = 0;
const sdk = {
  safe:{getInfo:async()=>({safeAddress:safeWallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:Number(await safeInstance.nonce())})},
  txs:{send:async ({txs,params}) => {
    safeProposals++;
    assert.equal(txs.length,1); assert.equal(params.safeTxGas,0);
    capturedSafeTx={to:txs[0].to,value:'0',data:txs[0].data,operation:0,safeTxGas:'0',baseGas:'0',gasPrice:'0',gasToken:zeroAddress,refundReceiver:zeroAddress,nonce:String(await safeInstance.nonce())};
    const safeTxHash=await safeInstance.getTransactionHash(...safeArgs({tx:capturedSafeTx}));
    return {safeTxHash};
  }}
};
async function executeCapturedSafeTx() {
  assert.ok(capturedSafeTx);
  const signatures=ethers.concat(await Promise.all(safeSigners.map(s=>s.signTypedData({chainId:137,verifyingContract:safeWallet},safeTypes,capturedSafeTx))));
  const receipt=await (await safeInstance.connect(accounts[1]).execTransaction(...safeArgs({tx:capturedSafeTx}).slice(0,9),signatures)).wait();
  const events=receipt.logs.map(log=>{try{return safeInstance.interface.parseLog(log);}catch{return null;}});
  assert.ok(events.some(event=>event?.name==='ExecutionSuccess'));
  capturedSafeTx=null;
  return receipt;
}
assert.equal((await profileTools.registerSafe({role,wallet:safeWallet,ethereum:safeEthereum,reader:safeReader,storage,locks,abi,ethers:safeEthers,sdk})).state,'safe_pending');
await executeCapturedSafeTx();
const safeProfile=(await safeReader.readProfileByWallet(safeWallet)).profile;
assert.equal(safeProfile.creatorId[0],role);
const safeBlock=await provider.getBlock('latest');
const safeDraft=await draft.build({objectType:kind,title:'Safe '+kind+' object',authorName:'Author',shortDescription:'Synthetic Safe test',domain:'art',contentClass:'static',status:'produced_object',aiStatus:'none',timestamp:safeBlock.timestamp,width:'10',height:'20',unit:'CMT',materials:'paper',features:'mark',physicalCategory:'art',photo:new TextEncoder().encode('Safe photo'),digitalFile:new TextEncoder().encode('Safe original'),digitalSubtype:'image',digitalFormat:'png'});
const safeOpts={abi,ethers:safeEthers};
let safeJob=await jobTools.prepare({...safeDraft,profile:safeProfile,wallet:safeWallet,...safeOpts});
const safeDb=await jobStore.open(new IDBFactory());
await jobStore.save(safeDb,safeJob,safeOpts);
let safeBackup=await jobBackup.exportJob(safeJob,safeOpts);
let safeIssueArgs={db:safeDb,operationId:safeJob.identity.operationId,expectedFingerprint:safeJob.fingerprint,backupBytes:safeBackup,reader:safeReader,ethereum:safeEthereum,wallet:safeWallet,locks,...safeOpts};
assert.equal((await issue.sendSafe({...safeIssueArgs,sdk})).state,'safe_pending');
assert.equal((await issue.send(safeIssueArgs)).state,'safe_pending');
if (expireFirst) {
  const oldFingerprint=safeJob.fingerprint;
  const deadline=Date.UTC(safeDraft.document.year,safeDraft.document.month,1)/1000;
  await provider.send('evm_setNextBlockTimestamp',[deadline]);
  await provider.send('evm_mine',[]);
  assert.equal((await issue.send(safeIssueArgs)).state,'safe_expired');
  assert.equal((await issue.rejectExpiredSafe({...safeIssueArgs,sdk})).state,'safe_rejection_pending');
  const rejectionReceipt=await executeCapturedSafeTx();
  const getReceipt=provider.getTransactionReceipt.bind(provider);
  provider.getTransactionReceipt=async hash=>{const r=await getReceipt(hash);return r&&{transactionHash:r.hash,blockNumber:r.blockNumber,blockHash:r.blockHash,status:r.status,logs:r.logs};};
  try {
    assert.equal((await issue.reprepareAfterSafeRejection({...safeIssueArgs,sdk,transactionHash:rejectionReceipt.hash.toLowerCase()})).state,'prepared');
  } finally { provider.getTransactionReceipt=getReceipt; }
  safeJob=await jobStore.get(safeDb,safeJob.identity.operationId,safeOpts);
  assert.notEqual(safeJob.fingerprint,oldFingerprint);
  safeBackup=await jobBackup.exportJob(safeJob,safeOpts);
  safeIssueArgs={...safeIssueArgs,expectedFingerprint:safeJob.fingerprint,backupBytes:safeBackup};
  assert.equal((await issue.sendSafe({...safeIssueArgs,sdk})).state,'safe_pending');
}
const pendingSafeJob=await jobStore.get(safeDb,safeJob.identity.operationId,safeOpts);
const pendingSafeBackup=await jobBackup.exportJob(pendingSafeJob,safeOpts);
const safeMintReceipt=await executeCapturedSafeTx();
const safeMinted=await issue.send(safeIssueArgs);
assert.equal(safeMinted.state,'minted');
const savedSafeJob=await jobStore.get(safeDb,safeJob.identity.operationId,safeOpts);
const safeBundleReceipt={format:'odp-bundle-receipt-0.7',generationId:trustedGeneration.generationId,chainId:'137',registry:readerTools.REGISTRY,passportId:safeMinted.passportId,transactionHash:safeMintReceipt.hash.toLowerCase(),blockNumber:String(safeMintReceipt.blockNumber),blockHash:safeMintReceipt.blockHash.toLowerCase(),operationId:safeJob.identity.operationId};
const recoveryDb=await jobStore.open(new IDBFactory());
const restoredSafe=await jobBackup.restore(pendingSafeBackup,safeOpts);
assert.equal((await jobStore.importBackup(recoveryDb,restoredSafe,safeOpts)).state,'safe_pending');
const recoveredSafe=await issue.send({...safeIssueArgs,db:recoveryDb});
assert.equal(recoveredSafe.state,'minted');
assert.equal(recoveredSafe.passportId,safeMinted.passportId);
assert.equal(safeProposals,expireFirst?4:2); // Recovery does not send another proposal.
const recoveredSafeJob=await jobStore.get(recoveryDb,safeJob.identity.operationId,safeOpts);
assert.equal(recoveredSafeJob.transactionHash,undefined);
const savedGetReceipt=provider.getTransactionReceipt.bind(provider);
provider.getTransactionReceipt=async hash=>{const r=await savedGetReceipt(hash);return r&&{transactionHash:r.hash,blockNumber:r.blockNumber,blockHash:r.blockHash,status:r.status,logs:r.logs};};
try {
  const safeArchive=await exporter.make({job:savedSafeJob,receipt:safeBundleReceipt,trustedGeneration,reader:safeReader,...safeOpts});
  const verified=await bundle.verifyEntries(await zip.extract(safeArchive.bytes),trustedGeneration,safeReader,safeEthers);
  assert.equal(verified.record.header.creatorId,safeProfile.creatorId);
  assert.equal(verified.record.header.creator.toLowerCase(),safeWallet.toLowerCase());
  assert.equal(verified.record.header.objectType,kind);
  const restoredArchive=await exporter.make({job:recoveredSafeJob,receipt:safeBundleReceipt,trustedGeneration,reader:safeReader,...safeOpts});
  assert.equal((await bundle.verifyEntries(await zip.extract(restoredArchive.bytes),trustedGeneration,safeReader,safeEthers)).record.header.passportId,safeMinted.passportId);
  await assert.rejects(exporter.make({job:recoveredSafeJob,receipt:{...safeBundleReceipt,transactionHash:pendingSafeJob.safeProposal.safeTxHash},trustedGeneration,reader:safeReader,...safeOpts}));
} finally {provider.getTransactionReceipt=savedGetReceipt;safeDb.close();recoveryDb.close();}
}
let safeSalt = 0;
for (const role of ['B','P','M']) for (const kind of ['physical','digital','mixed']) {
  let instance=safeInstance;
  if (safeSalt > 0) {
    const creation=await (await safeFactory.createProxyWithNonce(await singleton.getAddress(),initializer,safeSalt)).wait();
    const created=creation.logs.map(log=>{try{return safeFactory.interface.parseLog(log);}catch{return null;}}).find(log=>log?.name==='ProxyCreation');
    assert.ok(created);
    instance=new ethers.Contract(created.args.proxy,safeFixture.Safe.abi,provider);
  }
  safeSalt++;
  await verifySafeIssuance(role,kind,instance);
}
console.log('Local Safe 1.4.1: all 9 B/P/M and object-type profiles, proposals, multisig executions and archive verifications passed.');
const expiryCreation=await (await safeFactory.createProxyWithNonce(await singleton.getAddress(),initializer,safeSalt)).wait();
const expirySafe=expiryCreation.logs.map(log=>{try{return safeFactory.interface.parseLog(log);}catch{return null;}}).find(log=>log?.name==='ProxyCreation');
assert.ok(expirySafe);
await verifySafeIssuance('B','mixed',new ethers.Contract(expirySafe.args.proxy,safeFixture.Safe.abi,provider),true);
console.log('Local Safe 1.4.1: expired monthly proposal cancelled, re-prepared and issued successfully.');
const ethereum = { request:async request => request.method === 'eth_accounts' ? [accounts[4].address] : connection.provider.request(request) };
const coordinatorResult = await profileTools.register({ role:'C', wallet:accounts[4].address, ethereum, reader, storage, locks, abi, ethers:compat });
assert.equal(coordinatorResult.state, 'submitted');
assert.equal((await reader.readProfileByWallet(accounts[4].address)).profile.creatorId[0], 'C');
assert.equal((await profileTools.register({ role:'C', wallet:accounts[4].address, ethereum, reader, storage, locks, abi, ethers:compat })).state, 'registered');
const contract = new ethers.Contract(readerTools.REGISTRY, abi, accounts[0]);
const hash = text => ethers.sha256(ethers.toUtf8Bytes(text)), zero = ethers.ZeroHash;
const block = await provider.getBlock('latest'), now = new Date(block.timestamp * 1000);
const core = { year: now.getUTCFullYear(), month: now.getUTCMonth()+1, title:'Object', authorName:'Author', shortDescription:'Description', domain:'art', contentClass:1, lifecycleStatus:3, aiStatus:1, verificationMethod:1, editionModel:1 };
// Synthetic pre-existing edition on the isolated chain: open, inspect and activate one test key.
const editionArtifact=require(process.env.ODP_EDITION_ARTIFACT);
const editionTemp=await (await new ethers.ContractFactory(editionArtifact.abi,editionArtifact.bytecode,accounts[0]).deploy(readerTools.REGISTRY)).waitForDeployment();
const editionCode=await provider.getCode(await editionTemp.getAddress()),satellite=trustedGeneration.satellites.find(s=>s.role==='edition-units');
assert.equal(ethers.keccak256(editionCode),satellite.runtimeCodeHash);
await provider.send('hardhat_setCode',[satellite.address,editionCode]);
const editionContract=new ethers.Contract(satellite.address,editionAbi,accounts[1]),root=await editionContract.unitLeaf(0,accounts[5].address),editionNonce=hash('synthetic-edition-nonce');
const commitment=await editionContract.commitmentFor(accounts[1].address,root,1,ethers.ZeroAddress,editionNonce);
const editionMint={core:{...core,editionModel:2},dataHash:hash('edition-data'),imageHash:hash('edition-image'),previewHash:zero,fileHash:zero,anchorsHash:hash('edition-anchors'),anchorTypesMask:4111,editionCommitment:commitment};
const editionReceipt=await (await contract.connect(accounts[1]).mintPhysical(editionMint,hash('synthetic-edition-operation'))).wait();
const editionEvent=editionReceipt.logs.map(log=>{try{return contract.interface.parseLog(log);}catch{return null;}}).find(log=>log?.name==='PassportMinted');
const editionId=editionEvent.args.passportIdText;
assert.equal((await reader.readEdition(editionId,editionAbi,null)).edition.open,false);
await (await editionContract.openEdition(editionId,root,1,ethers.ZeroAddress,editionNonce)).wait();
assert.equal((await reader.readEdition(editionId,editionAbi,0)).activation.timestamp,0n);
const activationSignature=await accounts[5].signMessage(ethers.getBytes(await editionContract.activationPayloadHash(editionId,0)));
const activationReceipt=await (await editionContract.activate(editionId,0,[],activationSignature)).wait();
const activationRead=await reader.readEdition(editionId,editionAbi,0);
assert.ok(activationRead.activation.timestamp>0n);assert.equal(activationRead.activation.unitAddress.toLowerCase(),accounts[5].address.toLowerCase());
const activationLogs=await provider.getLogs({address:satellite.address,fromBlock:activationReceipt.blockNumber,toBlock:activationReceipt.blockNumber,topics:[ethers.id('UnitActivated(string,uint32,address,uint256)'),ethers.zeroPadValue(ethers.toBeHex(0),32),ethers.zeroPadValue(accounts[5].address,32)]});
assert.equal(activationLogs.length,1);assert.equal(editionContract.interface.parseLog(activationLogs[0]).args.editionPassportId,editionId);
let index = 0;
for (const kind of ['physical','digital','mixed']) {
  const mint = { core, dataHash:hash('data-'+kind), imageHash:kind === 'digital' ? zero : hash('image'), previewHash:zero, fileHash:kind === 'physical' ? zero : hash('file'), anchorsHash:hash('anchors'), anchorTypesMask:kind === 'physical' ? 15 : kind === 'digital' ? 32 : 47, editionCommitment:zero };
  const operationId = hash('operation-' + kind), plan = mintTools.prepare({ issuer:accounts[0].address, objectType:kind, mint, operationId, abi, ethers:compat });
  const receipt = await (await accounts[0].sendTransaction({ to:plan.registry, data:plan.calldata })).wait();
  const event = receipt.logs.map(log => { try { return contract.interface.parseLog(log); } catch { return null; } }).find(log => log?.name === 'PassportMinted');
  assert.ok(event);
  const id = event.args.passportIdText;
  reader = await readerTools.open(provider, abi, compat);
  const observed = await reader.readPassport(id);
  assert.equal(observed.header.objectType, kind);
  assert.equal((await reader.readMintOperation(accounts[0].address, operationId, plan.digest)).passportId, id);
  if (kind === 'physical') {
    const getReceipt = provider.getTransactionReceipt.bind(provider);
    provider.getTransactionReceipt = async hash => { const value = await getReceipt(hash); return value && { transactionHash:value.hash, blockNumber:value.blockNumber, blockHash:value.blockHash, status:value.status, logs:value.logs }; };
    try {
      const claim = { format:'odp-bundle-receipt-0.7', generationId:'odp-0.7-redesign-8-polygon-20260925', chainId:'137', registry:readerTools.REGISTRY,
        passportId:id, transactionHash:receipt.hash.toLowerCase(), blockNumber:String(receipt.blockNumber), blockHash:receipt.blockHash.toLowerCase(), operationId:operationId.toLowerCase() };
      assert.equal((await reader.verifyReceipt(claim)).transactionHash, claim.transactionHash);
    } finally { provider.getTransactionReceipt = getReceipt; }
  }
  const walletProvider = { request:async request => request.method === 'eth_accounts' ? [accounts[0].address] : connection.provider.request(request) };
  if (index++ === 0) {
    assert.equal((await releaseTools.send({ action:'revoke', passportId:id, reasonHash:hash('reason'), wallet:accounts[0].address, reader, ethereum:walletProvider, storage, locks, abi, ethers:compat })).state, 'submitted');
    assert.equal((await reader.readPassport(id)).classification.revoked, true);
  } else if (kind === 'digital') {
    assert.equal((await releaseTools.send({ action:'finalize', passportId:id, wallet:accounts[0].address, reader, ethereum:walletProvider, storage, locks, abi, ethers:compat })).state, 'submitted');
    assert.ok((await reader.readPassport(id)).release.printFinalizedAt > 0n);
  }
}
const example = structuredClone(require(site + '/backend/test/vectors/passport-0.7/physical.json'));
const chainBlock = await provider.getBlock('latest'), date = new Date(chainBlock.timestamp * 1000), iso = date.toISOString().replace('.000Z','Z');
example.year = date.getUTCFullYear(); example.month = date.getUTCMonth()+1; example.registeredAt = chainBlock.timestamp;
example.registration = { ianaTimeZone:'UTC', utcIso8601:iso, localIso8601:iso.replace('Z','+00:00') };
const photoBytes = new TextEncoder().encode('local synthetic photo'), photoHash = 'sha256:' + ethers.sha256(photoBytes).slice(2);
example.anchors.find(a => a.type === 'photo').hash = photoHash;
const profile = (await reader.readProfileByWallet(accounts[0].address)).profile;
const opts = { abi, ethers:compat }, preparedJob = await jobTools.prepare({ document:example, originals:[{hash:photoHash,bytes:photoBytes}], profile, wallet:accounts[0].address, ...opts });
const db = await jobStore.open(new IDBFactory()); await jobStore.save(db, preparedJob, opts);
const walletProvider = { request:async request => request.method === 'eth_accounts' ? [accounts[0].address] : connection.provider.request(request) };
const issueArgs = { db, operationId:preparedJob.identity.operationId, expectedFingerprint:preparedJob.fingerprint, reader, ethereum:walletProvider, wallet:accounts[0].address, locks, ...opts };
assert.equal((await issue.send(issueArgs)).state, 'submitted');
assert.equal((await issue.send(issueArgs)).state, 'minted');
const mintedJob = await jobStore.get(db,preparedJob.identity.operationId,opts);
assert.equal(mintedJob.state, 'minted');
const receiptFromChain = await provider.getTransactionReceipt(mintedJob.transactionHash);
const bundleReceipt = {format:'odp-bundle-receipt-0.7',generationId:trustedGeneration.generationId,chainId:'137',registry:readerTools.REGISTRY,passportId:mintedJob.passportId,transactionHash:mintedJob.transactionHash,blockNumber:String(receiptFromChain.blockNumber),blockHash:receiptFromChain.blockHash.toLowerCase(),operationId:mintedJob.identity.operationId};
const originalGetReceipt = provider.getTransactionReceipt.bind(provider);
provider.getTransactionReceipt = async hash => { const value = await originalGetReceipt(hash); return value && { transactionHash:value.hash, blockNumber:value.blockNumber, blockHash:value.blockHash, status:value.status, logs:value.logs }; };
try {
  const archive = await exporter.make({job:mintedJob,receipt:bundleReceipt,trustedGeneration,reader,abi,ethers:compat});
  assert.ok(archive.bytes.length > photoBytes.length);
  // An interrupted wallet hand-off can recover the committed job without its transaction hash.
  // A user-provided receipt must still authenticate against the finalized mint event.
  const recovered = structuredClone(mintedJob); delete recovered.transactionHash;
  assert.ok((await exporter.make({job:recovered,receipt:bundleReceipt,trustedGeneration,reader,abi,ethers:compat})).bytes.length > 0);
  await assert.rejects(exporter.make({job:recovered,receipt:{...bundleReceipt,transactionHash:hash('not-the-mint')},trustedGeneration,reader,abi,ethers:compat}));
} finally { provider.getTransactionReceipt = originalGetReceipt; }
db.close();
for (const [role, kind, signer] of [
  ['C', accounts[0]],
  ['B', accounts[1]],
  ['P', accounts[2]],
  ['M', accounts[3]],
].flatMap(([role, signer]) => ['physical', 'digital', 'mixed'].map(kind => [role, kind, signer]))) {
  const wallet = signer.address;
  const flowReader = reader5 || reader, flowEthers = ethers5 || compat, flowOpts = { abi, ethers: flowEthers };
  const issuer = (await flowReader.readProfileByWallet(wallet)).profile;
  assert.equal(issuer.creatorId[0], role);
  let sends = 0;
  const ethereum = {request: async request => {
    if (request.method === 'eth_accounts') return [wallet];
    if (request.method === 'eth_sendTransaction') sends++;
    return connection.provider.request(request);
  }};
  const latest = await provider.getBlock('latest');
  const photo = new TextEncoder().encode('photo '+kind);
  const sameOriginal = role === 'C' && kind === 'mixed';
  const digitalFile = sameOriginal ? photo : new TextEncoder().encode('file '+kind);
  const built = await draft.build({objectType:kind,title:'Local '+kind,authorName:'Author',shortDescription:'Synthetic test',domain:'art',contentClass:'static',status:'produced_object',aiStatus:'none',timestamp:latest.timestamp,width:'10',height:'20',unit:'CMT',materials:'paper',features:'mark',physicalCategory:'art',photo,digitalFile,digitalSubtype:'image',digitalFormat:'png'});
  if (sameOriginal) {
    assert.equal(built.originals.length, 1);
    assert.equal(built.document.anchors.find(a => a.type === 'photo').hash, built.document.digital.fileHash);
  }
  const prepared = await jobTools.prepare({...built,profile:issuer,wallet,...flowOpts});
  const testDb = await jobStore.open(new IDBFactory());
  await jobStore.save(testDb,prepared,flowOpts);
  const backup = await jobBackup.exportJob(prepared,flowOpts);
  const args = {db:testDb,operationId:prepared.identity.operationId,expectedFingerprint:prepared.fingerprint,reader:flowReader,ethereum,wallet,locks,...flowOpts};
  assert.equal((await issue.send(args)).state,'submitted');
  // An older backup must not erase a locally recorded submission or send it again.
  const restored = await jobBackup.restore(backup,flowOpts);
  const afterRestore = await jobStore.importBackup(testDb,restored,flowOpts);
  assert.equal(afterRestore.state,'submitted');
  assert.match(afterRestore.transactionHash,/^0x[0-9a-f]{64}$/);
  assert.equal((await issue.send(args)).state,'minted');
  assert.equal(sends,1);
  const minted = await jobStore.get(testDb,prepared.identity.operationId,flowOpts);
  assert.equal((await flowReader.readPassport(minted.passportId)).header.creatorId, issuer.creatorId);
  let recoveredJob = null;
  if (role === 'M' && kind === 'mixed') {
    // On a new device the old backup is guarded until the finalized operation is found.
    const newDb = await jobStore.open(new IDBFactory());
    try {
      assert.equal((await jobStore.importBackup(newDb,restored,flowOpts)).state,'handoff');
      const recovered = await issue.send({...args,db:newDb});
      assert.equal(recovered.state,'minted');
      assert.equal(recovered.passportId,minted.passportId);
      assert.equal(sends,1);
      recoveredJob = await jobStore.get(newDb,prepared.identity.operationId,flowOpts);
      assert.equal(recoveredJob.transactionHash,undefined);
    } finally { newDb.close(); }
  }
  const chainReceipt = await provider.getTransactionReceipt(minted.transactionHash);
  const receipt = {format:'odp-bundle-receipt-0.7',generationId:trustedGeneration.generationId,chainId:'137',registry:readerTools.REGISTRY,passportId:minted.passportId,transactionHash:minted.transactionHash,blockNumber:String(chainReceipt.blockNumber),blockHash:chainReceipt.blockHash.toLowerCase(),operationId:minted.identity.operationId};
  const getReceipt = provider.getTransactionReceipt.bind(provider);
  provider.getTransactionReceipt = async hash => { const value = await getReceipt(hash); return value && {transactionHash:value.hash,blockNumber:value.blockNumber,blockHash:value.blockHash,status:value.status,logs:value.logs}; };
  try {
    if (recoveredJob) {
      const recoveredArchive = await exporter.make({job:recoveredJob,receipt,trustedGeneration,reader:flowReader,abi,ethers:flowEthers});
      const recoveredVerification = await bundle.verifyEntries(await zip.extract(recoveredArchive.bytes),trustedGeneration,flowReader,flowEthers);
      assert.equal(recoveredVerification.record.header.passportId,minted.passportId);
    }
    if (reader5) {
      const archive5 = await exporter.make({job:minted,receipt,trustedGeneration,reader:reader5,abi,ethers:ethers5});
      const verified5 = await bundle.verifyEntries(await zip.extract(archive5.bytes), trustedGeneration, reader5, ethers5);
      assert.equal(verified5.record.header.creatorId, issuer.creatorId);
      assert.equal(verified5.record.header.objectType, kind);
    }
    const archive = await exporter.make({job:minted,receipt,trustedGeneration,reader,abi,ethers:compat});
    const entries = await zip.extract(archive.bytes);
    const verified = await bundle.verifyEntries(entries, trustedGeneration, reader, compat);
    assert.equal(verified.record.header.creatorId, issuer.creatorId);
    assert.equal(verified.record.header.objectType, kind);
    const original = entries.find(entry => entry.name.startsWith('files/'));
    assert.ok(original);
    original.bytes[0] ^= 1;
    const modifiedArchive = zip.create(entries);
    await assert.rejects(bundle.verifyEntries(await zip.extract(modifiedArchive), trustedGeneration, reader, compat));
  }
  finally { provider.getTransactionReceipt = getReceipt; testDb.close(); }
}
if (reader5) console.log('ethers 5.7.2: all 12 C/B/P/M and object-type prepare, mint, lookup, export and archive verification paths passed.');
console.log('Local ABI8 chain: all 12 C/B/P/M and object-type draft, mint, lookup, export and archive verification paths passed; modified originals were rejected.');
await connection.close();
