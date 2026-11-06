import { test, expect } from '@playwright/test';

test('release requires review and does not repeat an uncertain action', async ({ page }) => {
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({ contentType:'application/javascript', body:`window.ODPV07Reader={open:async()=>({readPassport:async id=>({chainId:137,registry:'0x3281492981dcd492cc2f7c17398134e1d3b5ca1f',blockTimestamp:1000,blockNumber:1,header:{passportId:id,creator:'0x'+'1'.repeat(40),title:'Test'},classification:{revoked:false},release:{printFinalizedAt:0,revocationDeadline:2000}})})};` }));
  await page.addInitScript(() => {
    localStorage.setItem('odp_locale','en');
    const wallet='0x'+'1'.repeat(40);
    (window as any).sent=0;
    (window as any).ethers={utils:{isAddress:()=>true,keccak256:()=>('0x'+'1'.repeat(64)),toUtf8Bytes:(s:string)=>s,Interface:class {encodeFunctionData(){return '0x1234';}}},providers:{Web3Provider:class {}}};
    (window as any).ethereum={on(){},request:async ({method}:{method:string})=>{if(method==='eth_requestAccounts'||method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';if(method==='eth_estimateGas')return '0x1234';if(method==='eth_sendTransaction'){(window as any).sent++;throw new Error('uncertain');}throw new Error('unexpected');}};
  });
  await page.goto('/release-07.html');
  await expect(page.getByLabel('Passport ID')).toBeHidden();
  await page.getByRole('button',{name:'Connect wallet'}).click();
  await expect(page.getByLabel('Passport ID')).toBeVisible();
  await page.getByLabel('Passport ID').fill('ODP-2026-09-000000001');
  await page.getByRole('button',{name:'Load passport'}).click();
  await page.getByLabel('Reason for withdrawal').fill('Example');
  await page.getByRole('button',{name:'Review action'}).click();
  await expect(page.getByRole('button',{name:'Confirm in wallet'})).toBeDisabled();
  await page.getByLabel('I understand and want to continue.').check();
  await page.getByRole('button',{name:'Confirm in wallet'}).click();
  await expect(page.getByRole('status')).toContainText('outcome is unknown');
  await page.getByRole('button',{name:'Load passport'}).click();
  await page.getByRole('button',{name:'Review action'}).click();
  await page.getByLabel('I understand and want to continue.').check();
  await page.getByRole('button',{name:'Confirm in wallet'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).sent)).toBe(1);
});

test('print confirmation reviews the irreversible action before wallet hand-off', async ({page}) => {
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readPassport:async id=>({chainId:137,registry:'0x3281492981dcd492cc2f7c17398134e1d3b5ca1f',blockTimestamp:1000,blockNumber:1,header:{passportId:id,creator:'0x'+'1'.repeat(40),title:'Test'},classification:{revoked:false},release:{printFinalizedAt:0,revocationDeadline:2000}})})};`}));
  await page.addInitScript(() => {
    localStorage.setItem('odp_locale','en'); const wallet='0x'+'1'.repeat(40); (window as any).methods=[];
    (window as any).ethers={utils:{isAddress:()=>true,Interface:class {encodeFunctionData(method:string){(window as any).methods.push(method);return '0x1234';}}},providers:{Web3Provider:class {}}};
    (window as any).ethereum={on(){},request:async({method}:{method:string})=>{if(method==='eth_requestAccounts'||method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';if(method==='eth_estimateGas')return '0x1234';if(method==='eth_sendTransaction')return '0x'+'a'.repeat(64);throw Error('unexpected');}};
  });
  await page.goto('/release-07.html');
  await page.getByRole('button',{name:'Connect wallet'}).click();
  await page.getByLabel('Passport ID').fill('ODP-2026-09-000000001');
  await page.getByRole('button',{name:'Load passport'}).click();
  await page.getByLabel('Action').selectOption('finalize');
  await expect(page.getByLabel('Reason for withdrawal')).toBeHidden();
  await page.getByRole('button',{name:'Review action'}).click();
  await expect(page.locator('#summary')).toContainText('Confirm for print');
  await expect(page.getByRole('button',{name:'Confirm in wallet'})).toBeDisabled();
  await page.getByLabel('I understand and want to continue.').check();
  await page.getByRole('button',{name:'Confirm in wallet'}).click();
  await expect(page.getByRole('status')).toContainText('Request submitted');
  expect(await page.evaluate(()=>(window as any).methods)).toContain('finalizePassportForPrint');
});
