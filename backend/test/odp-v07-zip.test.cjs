const { test } = require('node:test');
const assert = require('node:assert/strict');
const zip = require('../js/odp-v07-zip.js');
const { deflateRawSync } = require('node:zlib');

function archive(names) {
  const locals = [], central = []; let offset = 0;
  for (const name of names) {
    const text = Buffer.from(name), local = Buffer.alloc(30 + text.length), entry = Buffer.alloc(46 + text.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(text.length, 26); text.copy(local, 30);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(text.length, 28); entry.writeUInt32LE(offset, 42); text.copy(entry, 46);
    locals.push(local); central.push(entry); offset += local.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const roots = ['passport.json', 'generation.json', 'receipt.json', 'manifest.json'];
test('accepts bounded bundle layout and rejects duplicate and traversal paths', () => {
  assert.equal(zip.inspect(archive([...roots, 'files/' + 'a'.repeat(64)])).length, 5);
  assert.throws(() => zip.inspect(archive([...roots, roots[0]])), /duplicate/);
  assert.throws(() => zip.inspect(archive([...roots, '../passport.json'])), /path/);
  assert.throws(() => zip.inspect(archive(roots.slice(1))), /Incomplete/);
});
test('rejects encrypted entries, altered local names and decompression bombs', () => {
  const original = archive(roots), directory = original.readUInt32LE(original.length - 6);
  const encrypted = Buffer.from(original); encrypted.writeUInt16LE(1, directory + 8);
  assert.throws(() => zip.inspect(encrypted), /Unsupported/);
  const altered = Buffer.from(original); altered[30] ^= 1;
  assert.throws(() => zip.inspect(altered), /mismatch/);
  const bomb = Buffer.from(original); bomb.writeUInt16LE(8, directory + 10); bomb.writeUInt32LE(1, directory + 20); bomb.writeUInt32LE(101, directory + 24);
  assert.throws(() => zip.inspect(bomb), /Unsupported/);
});

function compressedArchive() {
  const locals = [], central = []; let offset = 0;
  for (const name of roots) {
    const text = Buffer.from(name), data = Buffer.from('{}'), compressed = deflateRawSync(data);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30 + text.length + compressed.length), entry = Buffer.alloc(46 + text.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(text.length, 26);
    text.copy(local, 30); compressed.copy(local, 30 + text.length);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(8, 10); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(compressed.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(text.length, 28); entry.writeUInt32LE(offset, 42); text.copy(entry, 46);
    locals.push(local); central.push(entry); offset += local.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(roots.length, 8); end.writeUInt16LE(roots.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
test('streams compressed entries and rejects wrong CRC and forged expanded size', async () => {
  const raw = compressedArchive(), entries = await zip.extract(raw);
  assert.equal(new TextDecoder().decode(entries[0].bytes), '{}');
  const directory = raw.readUInt32LE(raw.length - 6);
  const badCrc = Buffer.from(raw); badCrc.writeUInt32LE(0, 14); badCrc.writeUInt32LE(0, directory + 16);
  await assert.rejects(zip.extract(badCrc), /CRC/);
  const badSize = Buffer.from(raw); badSize.writeUInt32LE(1, 22); badSize.writeUInt32LE(1, directory + 24);
  await assert.rejects(zip.extract(badSize), /expanded beyond declared size/);
});
test('writer round-trips original bytes and rejects duplicates', async () => {
  const data = roots.map(name => ({ name, bytes:new TextEncoder().encode(name) }));
  const bytes = zip.create(data), restored = await zip.extract(bytes);
  assert.deepEqual(restored, data);
  assert.throws(() => zip.create([...data,data[0]]), /Invalid ZIP entry/);
});
