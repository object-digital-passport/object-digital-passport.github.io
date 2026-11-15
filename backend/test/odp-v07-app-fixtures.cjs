// Optional cross-repository test using the iPhone app's synthetic receipt fixtures.
// It checks local archive structure only and never contacts a chain.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zip = require('../js/odp-v07-zip.js');
const bundle = require('../js/odp-v07-bundle.js');
const approved = require('../config/odp-0.7/generation.json');
const app = process.env.ODP_APP_ROOT || path.resolve(__dirname, '../../../apple-app');
const fixtures = path.join(app, 'Tests/Fixtures/public-receipt');

async function read(name) {
  const entries = await zip.extract(fs.readFileSync(path.join(fixtures, name+'.odpass')));
  const generation = JSON.parse(new TextDecoder().decode(entries.find(entry => entry.name === 'generation.json').bytes));
  return {entries,generation};
}
async function main() {
  for (const name of ['active','revoked','finalized']) {
    const {entries,generation} = await read(name);
    assert.notEqual(generation.generationId,approved.generationId);
    assert.equal((await bundle.inspectEntries(entries,generation)).payloadsPresent,true);
    // A fixture's test deployment must not be trusted as the production generation.
    await assert.rejects(bundle.inspectEntries(entries,approved),/Untrusted generation/);
  }
  for (const name of ['active-missing-file','active-changed-file']) {
    const {entries,generation} = await read(name);
    await assert.rejects(bundle.inspectEntries(entries,generation),/Payload missing or changed/);
  }
  console.log('App synthetic fixtures: 3 valid archives accepted locally; 2 altered archives and unapproved test generation rejected.');
}
main().catch(error => { console.error(error); process.exitCode=1; });
