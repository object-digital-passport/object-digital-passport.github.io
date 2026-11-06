/* UTC month bounds for immutable issuance jobs. No network or wallet calls. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ODPV07Deadline = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function issuance(year, month, now) {
    if (!Number.isInteger(year) || year < 1970 || year > 9998 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isSafeInteger(now) || now < 0) throw new Error('Invalid issuance deadline');
    const end = Date.UTC(year, month, 1) / 1000;
    return Object.freeze({ end, status: now >= end ? 'expired' : end-now <= 86400 ? 'near' : 'open' });
  }
  return Object.freeze({issuance});
});
