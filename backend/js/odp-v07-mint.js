/* Deterministic ABI8 mint identity and calldata. This module does not sign or send. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ODPV07Mint = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const registry = "0x3281492981dcd492cc2f7c17398134e1d3b5ca1f";
  const core = "tuple(uint32 year,uint8 month,string title,string authorName,string shortDescription,string domain,uint8 contentClass,uint8 lifecycleStatus,uint8 aiStatus,uint8 verificationMethod,uint8 editionModel)";
  const tuple = `tuple(${core} core,bytes32 dataHash,bytes32 imageHash,bytes32 previewHash,bytes32 fileHash,bytes32 anchorsHash,uint32 anchorTypesMask,bytes32 editionCommitment)`;
  const word = /^0x[0-9a-f]{64}$/i;
  const zero = /^0x0{64}$/i;
  function digest(issuer, objectType, mint, ethers) {
    if (!ethers || !ethers.utils.isAddress(issuer) || !["physical", "digital", "mixed"].includes(objectType) || !mint) throw new Error("Invalid mint context");
    const encoded = ethers.utils.defaultAbiCoder.encode(["string", "uint256", "address", "address", "string", tuple], ["ODP-MINT-OPERATION-0.7", 137, registry, issuer, objectType, mint]);
    return ethers.utils.keccak256(encoded);
  }
  function prepare({ issuer, objectType, mint, operationId, abi, ethers }) {
    if (!ethers || !ethers.utils.isAddress(issuer) || !["physical", "digital", "mixed"].includes(objectType) || !Array.isArray(abi)) throw new Error("Invalid mint context");
    if (!word.test(operationId || "") || zero.test(operationId)) throw new Error("Invalid operation ID");
    if (!mint || !mint.core || !Number.isInteger(Number(mint.anchorTypesMask)) || Number(mint.anchorTypesMask) < 0 || Number(mint.anchorTypesMask) > 0xffffffff || Number(mint.core.editionModel) !== 1 || (Number(mint.anchorTypesMask) & (4096 | 8192)) !== 0) throw new Error("Only unique objects are supported");
    for (const k of ["dataHash", "imageHash", "previewHash", "fileHash", "anchorsHash", "editionCommitment"]) if (!word.test(mint[k] || "")) throw new Error("Invalid " + k);
    if (!zero.test(mint.editionCommitment)) throw new Error("Unexpected edition commitment");
    if (!zero.test(mint.previewHash) && (zero.test(mint.imageHash) || mint.previewHash.toLowerCase() === mint.imageHash.toLowerCase())) throw new Error("Invalid preview hash");
    if (zero.test(mint.dataHash) || (objectType !== "digital" && zero.test(mint.imageHash)) || (objectType !== "physical" && zero.test(mint.fileHash))) throw new Error("Missing required hash");
    if (objectType === "physical" && !zero.test(mint.fileHash)) throw new Error("Physical objects cannot carry a digital file hash");
    const operationDigest = digest(issuer, objectType, mint, ethers);
    const method = { physical: "mintPhysical", digital: "mintDigital", mixed: "mintMixed" }[objectType];
    const calldata = new ethers.utils.Interface(abi).encodeFunctionData(method, [mint, operationId]);
    return Object.freeze({ chainId: 137, registry, issuer, objectType, operationId, digest: operationDigest, calldata });
  }
  return Object.freeze({ prepare, digest });
});
