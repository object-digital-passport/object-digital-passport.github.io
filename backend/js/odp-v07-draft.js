/* Build a 0.7 unique-object document from explicit form values and local files. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./odp-v07-canonical.js'));
  else root.ODPV07Draft = factory(root.ODPV07Canonical);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (canonical) {
  'use strict';
  async function build(input) {
    if (!input || !['physical','digital','mixed'].includes(input.objectType) || !['static','time_based','spatial','textual','composite','executable'].includes(input.contentClass) ||
        !['concept','prototype','produced_object','archived'].includes(input.status) || !['none','assisted','generated'].includes(input.aiStatus) ||
        !Number.isSafeInteger(input.timestamp) || input.timestamp < 0) throw new Error('Invalid passport choices');
    const text = (value, name, required = true) => {
      if (typeof value !== 'string' || (required && !value.trim())) throw new Error('Missing ' + name);
      return value.trim().normalize('NFC');
    };
    const date = new Date(input.timestamp * 1000); if (!Number.isFinite(date.getTime())) throw new Error('Invalid preparation time');
    const iso = date.toISOString().replace('.000Z','Z');
    const doc = { version:'0.7', passportId:null, title:text(input.title,'title'), authorName:text(input.authorName,'author'), shortDescription:text(input.shortDescription,'description'),
      domain:text(input.domain || '', 'domain', false), objectType:input.objectType, status:input.status, contentClass:input.contentClass, aiStatus:input.aiStatus,
      verificationMethod:'self_asserted', edition:{model:'unique'}, idGranularity:'item', anchors:[], year:date.getUTCFullYear(), month:date.getUTCMonth()+1,
      registeredAt:input.timestamp, registration:{ianaTimeZone:'UTC',localIso8601:iso.replace('Z','+00:00'),utcIso8601:iso} };
    const originals = [], seen = new Set();
    async function original(value, name) {
      if (!(value instanceof Uint8Array) || !value.length || value.length > 50 * 1048576) throw new Error('Invalid ' + name);
      const bytes = value.slice(), hash = 'sha256:' + (await canonical.sha256(bytes)).slice(2);
      if (!seen.has(hash)) { originals.push({hash,bytes}); seen.add(hash); }
      return hash;
    }
    if (input.objectType !== 'digital') {
      const width = Number(input.width), height = Number(input.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0 || !['MMT','CMT','MTR','INH','FOT'].includes(input.unit)) throw new Error('Invalid dimensions');
      const photoHash = await original(input.photo, 'photo');
      const materials = text(input.materials,'materials').split(',').map(x => x.trim()).filter(Boolean);
      if (!materials.length) throw new Error('Missing materials');
      doc.anchors.push({type:'photo',data:{role:'primary'},hash:photoHash},{type:'dimensions',data:{width,height,unit:input.unit}},
        {type:'materials',data:{list:materials}},{type:'distinguishing_features',data:{text:text(input.features,'distinguishing features')}});
      doc.physical = {category:text(input.physicalCategory,'physical category')};
    }
    if (input.objectType !== 'physical') {
      const fileHash = await original(input.digitalFile, 'digital file');
      doc.anchors.push({type:'file_hash',hash:fileHash});
      doc.digital = {subtype:text(input.digitalSubtype,'digital subtype'),format:text(input.digitalFormat,'digital format'),fileHash,fileSize:input.digitalFile.length};
    }
    return { document:doc, originals };
  }
  return Object.freeze({ build });
});
