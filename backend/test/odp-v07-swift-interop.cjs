// Optional macOS integration check against the sibling swift-core ZIP implementation.
// No wallet, network or real passport is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const canonical = require('../js/odp-v07-canonical.js');
const zip = require('../js/odp-v07-zip.js');
const bundle = require('../js/odp-v07-bundle.js');
const generation = require('../config/odp-0.7/generation.json');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'odp-swift-interop-'));
  const swiftCore = process.env.ODP_SWIFT_CORE || path.resolve(__dirname, '../../../swift-core');
  const zipSource = path.join(swiftCore, 'Sources/ODPCore/Support/ZipArchive.swift');
  const swiftMain = path.join(temp, 'main.swift'), binary = path.join(temp, 'zip-interop');
  fs.writeFileSync(swiftMain, `import Foundation
let mode = CommandLine.arguments[1]
let directory = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let archive = URL(fileURLWithPath: CommandLine.arguments[3])
if mode == "write" {
  let names = try String(contentsOf: directory.appendingPathComponent("names.txt"), encoding: .utf8).split(separator: "\\n").map(String.init)
  let entries = try names.map { ZipArchive.Entry(path: $0, data: try Data(contentsOf: directory.appendingPathComponent($0))) }
  try ZipArchive.archive(entries: entries).write(to: archive)
} else {
  guard let entries = ZipArchive.extract(try Data(contentsOf: archive)) else { fatalError("ZIP read failed") }
  for (name, bytes) in entries {
    let target = directory.appendingPathComponent(name)
    try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
    try bytes.write(to: target)
  }
}
`);
  const env = {...process.env, CLANG_MODULE_CACHE_PATH:path.join(temp,'clang-cache'), SWIFT_MODULECACHE_PATH:path.join(temp,'swift-cache')};
  execFileSync('swiftc', [zipSource, swiftMain, '-o', binary], {env,stdio:'pipe'});
  const original = new TextEncoder().encode('synthetic iPhone ZIP original');
  const hash = 'sha256:' + (await canonical.sha256(original)).slice(2), filePath = 'files/' + hash.slice(7);
  const passport = structuredClone(require('./vectors/passport-0.7/physical.json'));
  passport.anchors.find(a => a.type === 'photo').hash = hash;
  const receipt = {format:'odp-bundle-receipt-0.7',generationId:generation.generationId,chainId:generation.chainId,registry:generation.registry,passportId:'ODP-2026-09-000000001',transactionHash:'0x'+'1'.repeat(64),blockNumber:'1',blockHash:'0x'+'2'.repeat(64),operationId:'0x'+'3'.repeat(64)};
  const manifest = {format:'odp-bundle-manifest-0.7',passportFile:'passport.json',generationFile:'generation.json',receiptFile:'receipt.json',files:[{path:filePath,sha256:hash,byteLength:String(original.length)}]};
  const entries = Object.entries({passport,generation,receipt,manifest}).map(([name,value]) => ({name:name+'.json',bytes:new TextEncoder().encode(canonical.canonicalize(value))}));
  entries.push({name:filePath,bytes:original});
  const inputDir=path.join(temp,'input'), outputDir=path.join(temp,'output');
  fs.mkdirSync(inputDir); fs.mkdirSync(outputDir);
  for (const entry of entries) { const p=path.join(inputDir,entry.name); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,entry.bytes); }
  fs.writeFileSync(path.join(inputDir,'names.txt'),entries.map(e=>e.name).join('\n'));
  const swiftArchive=path.join(temp,'swift.odpass'), webArchive=path.join(temp,'web.odpass');
  execFileSync(binary,['write',inputDir,swiftArchive],{env});
  const fromSwift=await zip.extract(fs.readFileSync(swiftArchive));
  assert.equal((await bundle.inspectEntries(fromSwift,generation)).payloadsPresent,true);
  fs.writeFileSync(webArchive,zip.create(entries));
  execFileSync(binary,['read',outputDir,webArchive],{env});
  for (const entry of entries) assert.deepEqual(fs.readFileSync(path.join(outputDir,entry.name)),Buffer.from(entry.bytes));
  console.log('Swift ZIP writer -> website local bundle inspection; website ZIP writer -> Swift reader: passed. Synthetic files only.');
}
main().catch(error => { console.error(error.stderr ? String(error.stderr) : error); process.exitCode=1; });
