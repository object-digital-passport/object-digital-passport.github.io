/* Parse only a public passport ID; never forward extra parameters or fragments. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ODPV07Locator = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function queryPassportId(search, hash) {
    if (hash) return null;
    const entries = [...new URLSearchParams(search)];
    if (entries.length !== 1 || !['id','odp'].includes(entries[0][0])) return null;
    const match = /^(?:odp:\/\/)?(ODP-[0-9]{4}-(?:0[1-9]|1[0-2])-[0-9]{9})$/i.exec(entries[0][1].trim());
    return match ? match[1].toUpperCase() : null;
  }
  return Object.freeze({queryPassportId});
});
