import { test, expect } from "@playwright/test";

test("0.7 lookup renders registry facts and separates unchecked files", async ({ page }) => {
  await page.route("**/ethers@5.7.2/**", route => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("odp_locale", "en");
    (window as any).ethers = { providers: { JsonRpcProvider: class {} } };
  });
  await page.route("**/backend/js/odp-v07-reader.js", route => route.fulfill({ contentType: "application/javascript", body: `window.ODPV07Reader={open:async()=>({readPassport:async(id)=>({header:{passportId:id,title:'<img src=x onerror=alert(1)>',authorName:'Artist',creatorId:'C-123'},classification:{revoked:false,editionModel:2},media:{anchorTypesMask:4096},release:{revocationDeadline:1700000000,printFinalizedAt:0},blockNumber:123}),readEdition:async()=>{throw new Error('offline')}})};` }));
  await page.goto("/verify-07.html");
  await page.getByLabel("Passport ID").fill("ODP-2026-09-000000027");
  await page.getByRole("button", { name: "Check registration" }).click();
  await expect(page.getByText("Registration found on the ODP 0.7 registry")).toBeVisible();
  await expect(page.getByText("Files: not checked")).toBeVisible();
  await expect(page.getByText("Individual edition item: not checked")).toBeVisible();
  await expect(page.locator("#result img")).toHaveCount(0);
  await page.getByRole("button", { name: "Change language to Russian" }).click();
  await expect(page.getByText("Файлы: не проверены")).toBeVisible();
});

test('edition lookup displays activation without claiming possession', async ({ page }) => {
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.addInitScript(() => { localStorage.setItem('odp_locale','en'); (window as any).ethers={providers:{JsonRpcProvider:class {}}}; });
  await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({contentType:'application/javascript',body:`
    const record={header:{passportId:'ODP-2026-09-000000027',title:'Edition',authorName:'Artist',creatorId:'B-123'},classification:{revoked:false,editionModel:2},media:{anchorTypesMask:4096},release:{revocationDeadline:1700000000,printFinalizedAt:0},blockNumber:123,blockTimestamp:1699996400};
    window.ODPV07Reader={open:async()=>({readPassport:async()=>record,readEdition:async(id,abi,unit)=>{window.requestedUnit=unit;return {passport:record,edition:{open:true,unitCount:12},activation:{timestamp:42,unitAddress:'0x'+'1'.repeat(40)},unitIndex:unit};},readActivationBlock:async()=>({blockNumber:120,timestamp:'42',unitAddress:'0x'+'1'.repeat(40)})})};
  `}));
  await page.goto('/verify-07.html');
  await page.getByLabel('Passport ID').fill('ODP-2026-09-000000027');
  await page.getByLabel('Unit index, if known (starts at 0)').fill('3');
  await page.getByRole('button',{name:'Check registration'}).click();
  await expect(page.getByText('Edition size: 12')).toBeVisible();
  await expect(page.getByText('Withdrawal time remaining at this block: 1 h 0 min')).toBeVisible();
  await expect(page.getByText('Recently issued')).toBeVisible();
  await expect(page.getByText(/The issuer may still withdraw this passport until/)).toBeVisible();
  await expect(page.getByText('Author name declared by issuer: Artist')).toBeVisible();
  await expect(page.getByText(/First proof of access to the unit key is recorded/)).toBeVisible();
  await expect(page.getByText('Activation block: 120')).toBeVisible();
  await expect(page.getByText('Individual edition item: not checked')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).requestedUnit)).toBe(3);
  await page.getByRole('button',{name:'Change language to Russian'}).click();
  await expect(page.getByText(/Издатель может отозвать этот паспорт до/)).toBeVisible();
});

test('odpass local check distinguishes valid files from confirmed registration', async ({ page }) => {
  const canonical = require('../../backend/js/odp-v07-canonical.js');
  const zip = require('../../backend/js/odp-v07-zip.js');
  const generation = require('../../backend/config/odp-0.7/generation.json');
  const passport = structuredClone(require('../../backend/test/vectors/passport-0.7/physical.json'));
  const bytes = Buffer.from('synthetic original'), hash='sha256:'+(await canonical.sha256(bytes)).slice(2), path='files/'+hash.slice(7);
  passport.anchors.find((a:any)=>a.type==='photo').hash=hash;
  const docs:any={passport,generation,receipt:{format:'odp-bundle-receipt-0.7',generationId:generation.generationId,chainId:generation.chainId,registry:generation.registry,passportId:'ODP-2026-09-000000001',transactionHash:'0x'+'1'.repeat(64),blockNumber:'1',blockHash:'0x'+'2'.repeat(64),operationId:'0x'+'3'.repeat(64)},manifest:{format:'odp-bundle-manifest-0.7',passportFile:'passport.json',generationFile:'generation.json',receiptFile:'receipt.json',files:[{path,sha256:hash,byteLength:String(bytes.length)}]}};
  const entries=Object.entries(docs).map(([name,value])=>({name:name+'.json',bytes:new TextEncoder().encode(canonical.canonicalize(value))})); entries.push({name:path,bytes});
  const archive=Buffer.from(zip.create(entries));
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.addInitScript(()=>localStorage.setItem('odp_locale','en'));
  await page.goto('/verify-07.html');
  await page.getByLabel('Or select an .odpass file').setInputFiles({name:'sample.odpass',mimeType:'application/zip',buffer:archive});
  await expect(page.getByText('Archive files match their manifest. The passport schema and deployment details match.')).toBeVisible();
  await expect(page.getByText(/Registration is not confirmed/)).toBeVisible();
  await expect(page.getByText('The passport content and mint receipt match the ODP 0.7 registry.')).toHaveCount(0);
  await page.getByLabel('Or select an .odpass file').setInputFiles({name:'broken.odpass',mimeType:'application/zip',buffer:Buffer.from('not a zip')});
  await expect(page.getByText(/This file could not be checked/)).toBeVisible();
});

test('legacy public locator is preserved without forwarding unrelated parameters',async({page})=>{
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/,route=>route.abort());
  await page.addInitScript(()=>localStorage.setItem('odp_locale','en'));
  await page.goto('/verify.html?id=odp%3A%2F%2FODP-2026-09-000000027&secret=do-not-forward');
  await page.getByRole('button',{name:'Got it'}).click();
  await page.getByRole('link',{name:'Check an ODP 0.7 passport'}).click();
  await expect(page).toHaveURL(/verify-07\.html\?id=ODP-2026-09-000000027$/);
  await expect(page.getByLabel('Passport ID')).toHaveValue('ODP-2026-09-000000027');
  await expect(page.locator('#result')).toBeEmpty();
});

test('ODP locator is accepted while extra URI data is rejected',async({page})=>{
  await page.route('**/ethers@5.7.2/**',route=>route.abort());
  await page.addInitScript(()=>{localStorage.setItem('odp_locale','en');(window as any).ethers={providers:{JsonRpcProvider:class{}}};});
  await page.route('**/backend/js/odp-v07-reader.js',route=>route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readPassport:async id=>({header:{passportId:id,title:'Object',authorName:'Artist',creatorId:'C-123'},classification:{revoked:false,editionModel:1},media:{anchorTypesMask:15},release:{revocationDeadline:1700000000,printFinalizedAt:0},blockNumber:123})})};`}));
  await page.goto('/verify-07.html');await page.getByLabel('Passport ID').fill('odp://ODP-2026-09-000000027');
  await page.getByRole('button',{name:'Check registration'}).click();await expect(page.getByText('Registration found on the ODP 0.7 registry')).toBeVisible();
  await page.getByLabel('Passport ID').fill('odp://ODP-2026-09-000000027?code=secret');await page.getByRole('button',{name:'Check registration'}).click();
  await expect(page.getByText(/Enter a passport ID in the format/)).toBeVisible();
});
