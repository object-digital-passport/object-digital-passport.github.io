/* Read-only access to the owner-approved ODP 0.7-redesign-8 deployment. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ODPV07Reader = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const CHAIN_ID = 137;
  const REGISTRY = "0x3281492981dcd492cc2f7c17398134e1d3b5ca1f";
  const RUNTIME_HASH = "0x9da6429fcf47e638377081bab80189877574ef33a6d1468dd4ac466bbc5ea7ec";
  const GENERATION = "odp-0.7-redesign-8-polygon-20260925";
  const EDITIONS = "0x3dbf163b8ec7c251565e4acd7b4f6b310b60d0fe";
  const EDITIONS_HASH = "0x4e7ac33b4c47fab6bed608685bb45ee04c97c8ced6f29bd9da817f0d9e65552b";
  const EDITIONS_DEPLOYMENT_BLOCK = 94434870;

  // ethers v5 does not consistently accept "finalized" as a block tag.
  async function finalizedBlock(provider) {
    const raw = await provider.send("eth_getBlockByNumber", ["finalized", false]);
    if (!raw || !/^0x[0-9a-f]+$/i.test(raw.number || "") || !/^0x[0-9a-f]{64}$/i.test(raw.hash || "")) {
      throw new Error("Finalized block unavailable");
    }
    const number = Number(raw.number);
    if (!Number.isSafeInteger(number)) throw new Error("Invalid finalized block");
    return { number, hash: raw.hash.toLowerCase() };
  }
  async function activationLogs(provider, topics, toBlock, timestamp) {
    const request=(fromBlock,end)=>provider.getLogs({address:EDITIONS,topics,fromBlock,toBlock:end});
    try { const logs=await request(EDITIONS_DEPLOYMENT_BLOCK,toBlock);if(Array.isArray(logs)&&logs.length>0&&logs.length<=256)return logs; } catch (_) {}
    // Some RPCs reject long log ranges. Locate the event's timestamp using bounded block reads,
    // then query only blocks at that second. Finality and event contents are checked by the caller.
    const target=Number(timestamp);if(!Number.isSafeInteger(target)||target<=0)throw Error('Invalid activation timestamp');
    const cache=new Map();
    async function timeAt(n){if(cache.has(n))return cache.get(n);const block=await provider.getBlock(n);if(!block||block.number!==n||!Number.isSafeInteger(block.timestamp)||block.timestamp<0)throw Error('Activation block time unavailable');cache.set(n,block.timestamp);return block.timestamp;}
    async function bound(firstGreater){let low=EDITIONS_DEPLOYMENT_BLOCK,high=toBlock+1;while(low<high){const mid=low+Math.floor((high-low)/2),time=await timeAt(mid);if(firstGreater?time<=target:time<target)low=mid+1;else high=mid;}return low;}
    const [start,endExclusive]=await Promise.all([bound(false),bound(true)]);
    if(start>=endExclusive||start>toBlock||endExclusive-start>2048||await timeAt(start)!==target)throw Error('Activation timestamp not found');
    return request(start,endExclusive-1);
  }

  /** Validate the provider and bytecode before creating a reader. */
  async function open(provider, abi, ethers) {
    if (!provider || !Array.isArray(abi) || !ethers) throw new Error("Invalid reader configuration");
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CHAIN_ID) throw new Error("Wrong network");
    const block = await finalizedBlock(provider);
    const code = await provider.getCode(REGISTRY, block.number);
    if (!code || code === "0x" || ethers.utils.keccak256(code).toLowerCase() !== RUNTIME_HASH) {
      throw new Error("Registry code does not match the approved deployment");
    }
    const contract = new ethers.Contract(REGISTRY, abi, provider);
    if (Number(await contract.CONTRACT_VERSION({ blockTag: block.number })) !== 7) throw new Error("Wrong registry version");
    const canonical = await provider.getBlock(block.number);
    if (!canonical || !canonical.hash || canonical.hash.toLowerCase() !== block.hash) throw new Error("Finalized block changed");
    return {
      /** All four components are read at a single block to avoid mixed lifecycle states. */
      async readPassport(id) {
        if (typeof id !== "string" || !id.trim()) throw new Error("Passport ID is required");
        const snapshot = await finalizedBlock(provider);
        const blockTag = snapshot.number;
        const options = { blockTag };
        const [header, classification, media, release] = await Promise.all([
          contract.getPassportHeader(id.trim(), options),
          contract.getPassportClassification(id.trim(), options),
          contract.getPassportMedia(id.trim(), options),
          contract.getPassportReleaseState(id.trim(), options),
        ]);
        if (header.passportId !== id.trim() || Number(header.contractVersion) !== 7) throw new Error("Invalid passport response");
        const canonical = await provider.getBlock(blockTag);
        if (!canonical || !canonical.hash || canonical.hash.toLowerCase() !== snapshot.hash || !Number.isSafeInteger(canonical.timestamp) || canonical.timestamp < 0) throw new Error("Finalized block changed or timestamp unavailable");
        return { header, classification, media, release, blockNumber: blockTag, blockHash: snapshot.hash, blockTimestamp: canonical.timestamp, registry: REGISTRY, chainId: CHAIN_ID };
      },
      /** Read edition and activation facts; these do not prove possession or authenticity. */
      async readEdition(id, editionAbi, unitIndex) {
        if (!Array.isArray(editionAbi)) throw new Error("Invalid edition ABI");
        if (unitIndex != null && (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex > 1048575)) throw new Error("Invalid unit index");
        const passport = await this.readPassport(id);
        const blockTag = passport.blockNumber;
        if ((Number(passport.media.anchorTypesMask) & 4096) === 0 || ![2, 3].includes(Number(passport.classification.editionModel))) {
          throw new Error("Passport does not contain an edition key set");
        }
        const code = await provider.getCode(EDITIONS, blockTag);
        if (!code || code === "0x" || ethers.utils.keccak256(code).toLowerCase() !== EDITIONS_HASH) throw new Error("Edition contract code does not match the approved deployment");
        const editions = new ethers.Contract(EDITIONS, editionAbi, provider);
        const options = { blockTag };
        const [registry, edition] = await Promise.all([editions.odpRegistry(options), editions.getEdition(id.trim(), options)]);
        if (String(registry).toLowerCase() !== REGISTRY) throw new Error("Edition registry mismatch");
        let activation = null;
        if (unitIndex != null) {
          if (!edition.open || unitIndex >= Number(edition.unitCount)) throw new Error("Unit is outside the opened edition");
          activation = await editions.getActivation(id.trim(), unitIndex, options);
        }
        const canonical = await provider.getBlock(blockTag);
        if (!canonical || !canonical.hash || canonical.hash.toLowerCase() !== passport.blockHash) throw new Error("Finalized block changed");
        return { passport, edition, unitIndex: unitIndex == null ? null : unitIndex, activation };
      },
      /** Resolve the activation event block without treating an event as proof of possession. */
      async readActivationBlock(id, editionAbi, unitIndex) {
        const result=await this.readEdition(id,editionAbi,unitIndex),activation=result.activation;
        if(!activation||BigInt(activation.timestamp.toString())===0n||!ethers.utils.isAddress(activation.unitAddress)||result.passport.blockNumber<EDITIONS_DEPLOYMENT_BLOCK)throw Error('Activation is not recorded');
        const editions=new ethers.Contract(EDITIONS,editionAbi,provider);
        const topics=[ethers.utils.id('UnitActivated(string,uint32,address,uint256)'),ethers.utils.hexZeroPad(ethers.utils.hexlify(unitIndex),32),ethers.utils.hexZeroPad(activation.unitAddress,32)];
        const logs=await activationLogs(provider,topics,result.passport.blockNumber,activation.timestamp.toString());
        if(!Array.isArray(logs)||logs.length>256)throw Error('Activation event unavailable');
        const matching=[];
        for(const log of logs){
          if(log.removed||String(log.address).toLowerCase()!==EDITIONS||!Number.isSafeInteger(log.blockNumber)||log.blockNumber<EDITIONS_DEPLOYMENT_BLOCK||log.blockNumber>result.passport.blockNumber)continue;
          try{const event=editions.interface.parseLog(log),args=event.args;if(event.name==='UnitActivated'&&args.editionPassportId===id.trim()&&Number(args.unitIndex)===unitIndex&&String(args.unitAddress).toLowerCase()===String(activation.unitAddress).toLowerCase()&&String(args.timestamp)===String(activation.timestamp))matching.push(log);}catch(_){}
        }
        if(matching.length!==1)throw Error('Activation event not found or ambiguous');
        const log=matching[0], [block,snapshot]=await Promise.all([provider.getBlock(log.blockNumber),provider.getBlock(result.passport.blockNumber)]);
        if(!block||!block.hash||!log.blockHash||block.hash.toLowerCase()!==log.blockHash.toLowerCase()||!snapshot||!snapshot.hash||snapshot.hash.toLowerCase()!==result.passport.blockHash)throw Error('Activation event block changed');
        return {blockNumber:log.blockNumber,unitAddress:String(activation.unitAddress).toLowerCase(),timestamp:activation.timestamp.toString()};
      },
      /** Reconcile a saved operation after an uncertain wallet submission. */
      async readMintOperation(issuer, operationId, expectedDigest) {
        const word = /^0x[0-9a-f]{64}$/i;
        if (!ethers.utils.isAddress(issuer) || !word.test(operationId || "") || /^0x0{64}$/i.test(operationId) ||
            !word.test(expectedDigest || "") || /^0x0{64}$/i.test(expectedDigest)) throw new Error("Invalid mint operation identity");
        const snapshot = await finalizedBlock(provider);
        const result = await contract.getMintOperation(issuer, operationId, { blockTag: snapshot.number });
        const canonical = await provider.getBlock(snapshot.number);
        if (!canonical || !canonical.hash || canonical.hash.toLowerCase() !== snapshot.hash) throw new Error("Finalized block changed");
        if (!result || !word.test(result.digest || "") || typeof result.passportId !== "string") throw new Error("Invalid mint operation response");
        const emptyDigest = /^0x0{64}$/i.test(result.digest);
        if (!result.passportId && emptyDigest) return { state: "not-finalized", blockNumber: snapshot.number };
        if (!result.passportId || emptyDigest) throw new Error("Invalid mint operation response");
        return { state: result.digest.toLowerCase() === expectedDigest.toLowerCase() ? "committed" : "conflict", passportId: result.passportId, blockNumber: snapshot.number };
      },
      /** Only a finalized, matching direct EOA transaction can establish that this attempt failed. */
      async verifyFailedMint(transactionHash, issuer, calldata) {
        const hex32 = /^0x[0-9a-f]{64}$/i;
        if (!hex32.test(transactionHash || '') || !ethers.utils.isAddress(issuer) || !/^0x(?:[0-9a-f]{2})+$/i.test(calldata || '')) throw new Error('Invalid failed transaction claim');
        const [tx, receipt, finalized] = await Promise.all([provider.getTransaction(transactionHash), provider.getTransactionReceipt(transactionHash), finalizedBlock(provider)]);
        const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
        if (!tx || !receipt || !Number.isSafeInteger(receipt.blockNumber) || receipt.blockNumber > finalized.number ||
            !same(tx.hash, transactionHash) || !same(receipt.transactionHash, transactionHash) || receipt.status !== 0 ||
            tx.blockNumber !== receipt.blockNumber || !same(tx.blockHash, receipt.blockHash) ||
            !same(tx.from, issuer) || !same(tx.to, REGISTRY) || !same(tx.data, calldata) || BigInt(tx.value.toString()) !== 0n) throw new Error('Transaction is not a matching finalized failure');
        const [block, finalBlock, code] = await Promise.all([provider.getBlock(receipt.blockNumber), provider.getBlock(finalized.number), provider.getCode(issuer, finalized.number)]);
        if (!block || block.number !== receipt.blockNumber || !same(block.hash, receipt.blockHash) || !finalBlock || !same(finalBlock.hash, finalized.hash) || code !== '0x') throw new Error('Transaction finality or issuer type cannot be verified');
        return { blockNumber:receipt.blockNumber, transactionHash:transactionHash.toLowerCase() };
      },
      /** The Safe proposal hash is distinct from its execution transaction hash. */
      async verifySafeRejection(transactionHash, safe, safeTxHash) {
        const word=/^0x[0-9a-f]{64}$/i;
        if(!word.test(transactionHash||'')||!word.test(safeTxHash||'')||!ethers.utils.isAddress(safe))throw Error('Invalid Safe rejection claim');
        const [tx,receipt,finalized]=await Promise.all([provider.getTransaction(transactionHash),provider.getTransactionReceipt(transactionHash),finalizedBlock(provider)]);
        const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
        if(!tx||!receipt||!Number.isSafeInteger(receipt.blockNumber)||receipt.blockNumber>finalized.number||receipt.status!==1||
           !same(tx.hash,transactionHash)||!same(receipt.transactionHash,transactionHash)||tx.blockNumber!==receipt.blockNumber||!same(tx.blockHash,receipt.blockHash))throw Error('Safe rejection is not finalized');
        const [block,finalBlock]=await Promise.all([provider.getBlock(receipt.blockNumber),provider.getBlock(finalized.number)]);
        if(!block||block.number!==receipt.blockNumber||!same(block.hash,receipt.blockHash)||!finalBlock||!same(finalBlock.hash,finalized.hash))throw Error('Safe rejection block changed');
        const signature=ethers.utils.id('ExecutionSuccess(bytes32,uint256)');
        const matches=(receipt.logs||[]).filter(log=>!log.removed&&same(log.address,safe)&&Array.isArray(log.topics)&&log.topics.length===2&&same(log.topics[0],signature)&&same(log.topics[1],safeTxHash));
        if(matches.length!==1)throw Error('Safe rejection execution event not found');
        return {blockNumber:receipt.blockNumber,transactionHash:transactionHash.toLowerCase()};
      },
      /** A wallet has at most one profile in this generation. */
      async readProfileByWallet(wallet) {
        if (!ethers.utils.isAddress(wallet)) throw new Error("Invalid wallet address");
        const snapshot = await finalizedBlock(provider), options = { blockTag: snapshot.number };
        const id = await contract.getCreatorByWallet(wallet, options);
        if (typeof id !== "string") throw new Error("Invalid profile response");
        let profile = null;
        if (id) {
          if (!/^[CBPM]-(?:[0-9]{3}-){3}[0-9]{3}$/.test(id)) throw new Error("Invalid profile ID");
          profile = await contract.getCreator(id, options);
          const expectedPrefix = "0x" + id.charCodeAt(0).toString(16);
          if (!profile || profile.creatorId !== id || String(profile.wallet).toLowerCase() !== wallet.toLowerCase() ||
              String(profile.typePrefix).toLowerCase() !== expectedPrefix) throw new Error("Profile record mismatch");
        }
        const canonical = await provider.getBlock(snapshot.number);
        if (!canonical || !canonical.hash || canonical.hash.toLowerCase() !== snapshot.hash) throw new Error("Finalized block changed");
        return { profile, blockNumber: snapshot.number, blockHash: snapshot.hash };
      },
      /** A bundle receipt is a claim: authenticate it against the canonical finalized chain. */
      async verifyReceipt(claim) {
        const hex32 = /^0x[0-9a-f]{64}$/;
        const id = /^ODP-[0-9]{4}-(0[1-9]|1[0-2])-[0-9]{9}$/;
        if (!claim || claim.format !== "odp-bundle-receipt-0.7" || claim.generationId !== GENERATION ||
            claim.chainId !== String(CHAIN_ID) || claim.registry !== REGISTRY || !id.test(claim.passportId) ||
            !hex32.test(claim.transactionHash) || !hex32.test(claim.blockHash) || !hex32.test(claim.operationId) ||
            /^0x0{64}$/.test(claim.operationId) || !/^(0|[1-9][0-9]*)$/.test(claim.blockNumber) ||
            !Number.isSafeInteger(Number(claim.blockNumber))) {
          throw new Error("Invalid receipt claim");
        }
        const record = await this.readPassport(claim.passportId);
        const height = Number(claim.blockNumber);
        const [tx, receipt, block, finalized] = await Promise.all([
          provider.getTransaction(claim.transactionHash), provider.getTransactionReceipt(claim.transactionHash),
          provider.getBlock(height), finalizedBlock(provider),
        ]);
        const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
        if (!tx || !receipt || !block || !finalized || finalized.number < height ||
            !same(tx.hash, claim.transactionHash) || !same(tx.blockHash, claim.blockHash) || tx.blockNumber !== height ||
            !same(receipt.transactionHash, claim.transactionHash) || receipt.status !== 1 ||
            receipt.blockNumber !== height || !same(receipt.blockHash, claim.blockHash) ||
            block.number !== height || !same(block.hash, claim.blockHash)) throw new Error("Receipt is not confirmed in a canonical finalized block");
        const events = [];
        for (const log of receipt.logs || []) {
          if (!same(log.address, REGISTRY) || log.removed || !Array.isArray(log.topics) || log.topics.length !== 3 ||
              !same(log.topics[1], ethers.utils.id(claim.passportId)) ||
              !same(log.topics[2], ethers.utils.hexZeroPad(record.header.creator, 32))) continue;
          try { const event = contract.interface.parseLog(log); if (event.name === "PassportMinted") events.push(event.args); } catch (_) {}
        }
        if (events.length !== 1) throw new Error("Mint event not found or ambiguous");
        const e = events[0], h = record.header, c = record.classification, m = record.media;
        if (e.passportIdText !== h.passportId || e.creatorId !== h.creatorId || e.title !== h.title ||
            e.authorName !== h.authorName || e.domain !== h.domain || e.objectType !== h.objectType ||
            String(e.contentClass) !== String(c.contentClass) || String(e.year) !== String(h.year) ||
            String(e.month) !== String(h.month) || !same(e.dataHash, m.dataHash) || !same(e.anchorsHash, m.anchorsHash) ||
            String(e.anchorTypesMask) !== String(m.anchorTypesMask) || String(e.timestamp) !== String(c.timestamp) ||
            !same(e.operationId, claim.operationId)) throw new Error("Mint event differs from the registry record");
        return { blockNumber: height, transactionHash: claim.transactionHash };
      },
    };
  }
  return Object.freeze({ open, CHAIN_ID, REGISTRY, RUNTIME_HASH });
});
