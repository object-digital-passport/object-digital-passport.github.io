/* ZIP envelope preflight. Call before any decompressor and enforce CRC while extracting. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ODPV07Zip = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const roots = new Set(['passport.json', 'generation.json', 'receipt.json', 'manifest.json']);
  function inspect(input) {
    if (!(input instanceof Uint8Array) || input.length < 22 || input.length > 104857600) throw new Error('Invalid ZIP size');
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    const n = (p, size) => { if (p < 0 || p + size > input.length) throw new Error('Truncated ZIP'); return size === 2 ? view.getUint16(p, true) : view.getUint32(p, true); };
    let end = -1;
    for (let p = input.length - 22; p >= Math.max(0, input.length - 65557); p--) {
      if (n(p, 4) === 0x06054b50 && p + 22 + n(p + 20, 2) === input.length) { end = p; break; }
    }
    if (end < 0 || n(end + 4, 2) !== 0 || n(end + 6, 2) !== 0) throw new Error('Invalid ZIP directory');
    const count = n(end + 10, 2), start = n(end + 16, 4), directorySize = n(end + 12, 4);
    if (!count || count > 1000 || count !== n(end + 8, 2) || start + directorySize !== end) throw new Error('Invalid ZIP directory');
    let p = start, total = 0; const names = new Set(), ranges = [], entries = [];
    const decoder = new TextDecoder('utf-8', { fatal: true });
    for (let i = 0; i < count; i++) {
      if (n(p, 4) !== 0x02014b50) throw new Error('Invalid ZIP entry');
      const madeBy = n(p + 4, 2), flags = n(p + 8, 2), method = n(p + 10, 2), crc = n(p + 16, 4);
      const compressed = n(p + 20, 4), size = n(p + 24, 4), nameLength = n(p + 28, 2);
      const next = p + 46 + nameLength + n(p + 30, 2) + n(p + 32, 2), local = n(p + 42, 4);
      if (next > end || !nameLength || (flags & ~0x080e) !== 0 || ![0, 8].includes(method) || n(p + 34, 2) !== 0 ||
          compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff ||
          (method === 0 && compressed !== size) || size > 268435456 || (total += size) > 536870912 || size > Math.max(compressed, 1) * 100) throw new Error('Unsupported ZIP entry');
      const name = decoder.decode(input.subarray(p + 46, p + 46 + nameLength));
      if ((!roots.has(name) && !/^files\/[0-9a-f]{64}$/.test(name) && name !== 'files/') || names.has(name)) throw new Error('Invalid or duplicate ZIP path');
      names.add(name);
      const mode = n(p + 38, 4) >>> 16;
      if ((madeBy >>> 8) === 3 && (mode & 0xf000) === 0xa000) throw new Error('ZIP symlink not allowed');
      if (name === 'files/' && (size !== 0 || compressed !== 0)) throw new Error('Invalid ZIP directory entry');
      if (local >= start || n(local, 4) !== 0x04034b50 || n(local + 6, 2) !== flags || n(local + 8, 2) !== method || n(local + 26, 2) !== nameLength) throw new Error('Invalid ZIP local header');
      if (!(flags & 8) && (n(local + 14, 4) !== crc || n(local + 18, 4) !== compressed || n(local + 22, 4) !== size)) throw new Error('ZIP local size or CRC mismatch');
      const content = local + 30 + nameLength + n(local + 28, 2);
      if (content + compressed > start || decoder.decode(input.subarray(local + 30, local + 30 + nameLength)) !== name) throw new Error('ZIP local entry mismatch');
      ranges.push([local, content + compressed]);
      if (name !== 'files/') entries.push({ name, size, compressed, crc, method, offset: content });
      p = next;
    }
    if (p !== end || roots.size !== [...roots].filter(x => names.has(x)).length) throw new Error('Incomplete ZIP directory');
    ranges.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) if (ranges[i][0] < ranges[i - 1][1]) throw new Error('Overlapping ZIP entries');
    return entries;
  }
  const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    return value >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    return (crc ^ 0xffffffff) >>> 0;
  }
  async function extract(input) {
    const entries = inspect(input), extracted = [];
    for (const entry of entries) {
      const source = input.subarray(entry.offset, entry.offset + entry.compressed);
      let bytes;
      if (entry.method === 0) bytes = source.slice();
      else {
        if (typeof DecompressionStream !== 'function') throw new Error('Raw deflate is unavailable');
        let reader;
        try { reader = new Blob([source]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(); }
        catch (_) { throw new Error('Raw deflate is unavailable'); }
        const chunks = []; let length = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.length;
            if (length > entry.size) { await reader.cancel(); throw new Error('ZIP expanded beyond declared size'); }
            chunks.push(part.value);
          }
        } finally { reader.releaseLock(); }
        if (length !== entry.size) throw new Error('ZIP expanded size mismatch');
        bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      }
      if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw new Error('ZIP CRC mismatch');
      extracted.push({ name: entry.name, bytes });
    }
    return extracted;
  }
  /** Write a stored ZIP with no links, descriptors, or hidden entries. */
  function create(entries) {
    if (!Array.isArray(entries) || entries.length < 4 || entries.length > 1000) throw new Error('Invalid ZIP entries');
    const seen = new Set(), encoder = new TextEncoder(); let total = 22;
    const rows = entries.map(entry => {
      if (!entry || typeof entry.name !== 'string' || !(entry.bytes instanceof Uint8Array) ||
          (!roots.has(entry.name) && !/^files\/[0-9a-f]{64}$/.test(entry.name)) || seen.has(entry.name) || entry.bytes.length > 268435456) throw new Error('Invalid ZIP entry');
      seen.add(entry.name);
      const name = encoder.encode(entry.name), bytes = entry.bytes.slice(), crc = crc32(bytes);
      total += 30 + name.length + bytes.length + 46 + name.length;
      if (total > 104857600) throw new Error('ZIP size limit exceeded');
      return { name, bytes, crc, offset:0 };
    });
    if ([...roots].some(name => !seen.has(name))) throw new Error('Missing ZIP root');
    const out = new Uint8Array(total), view = new DataView(out.buffer); let offset = 0;
    const u16 = (at, value) => view.setUint16(at, value, true), u32 = (at, value) => view.setUint32(at, value, true);
    for (const row of rows) {
      row.offset = offset; u32(offset,0x04034b50); u16(offset+4,20); u32(offset+14,row.crc); u32(offset+18,row.bytes.length); u32(offset+22,row.bytes.length); u16(offset+26,row.name.length);
      out.set(row.name,offset+30); out.set(row.bytes,offset+30+row.name.length); offset += 30+row.name.length+row.bytes.length;
    }
    const directoryStart = offset;
    for (const row of rows) {
      u32(offset,0x02014b50); u16(offset+4,20); u16(offset+6,20); u32(offset+16,row.crc); u32(offset+20,row.bytes.length); u32(offset+24,row.bytes.length); u16(offset+28,row.name.length); u32(offset+42,row.offset);
      out.set(row.name,offset+46); offset += 46+row.name.length;
    }
    const directorySize = offset-directoryStart;
    u32(offset,0x06054b50); u16(offset+8,rows.length); u16(offset+10,rows.length); u32(offset+12,directorySize); u32(offset+16,directoryStart);
    return out;
  }
  return Object.freeze({ inspect, extract, create });
});
