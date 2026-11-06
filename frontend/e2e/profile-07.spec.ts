import { test, expect } from '@playwright/test';

test('profile registration asks once and retains an uncertain submission', async ({ page }) => {
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({ contentType:'application/javascript', body:`window.ODPV07Reader={open:async()=>({readProfileByWallet:async()=>({profile:null})})};` }));
  await page.addInitScript(() => {
    localStorage.setItem('odp_locale', 'en');
    const wallet = '0x' + '1'.repeat(40);
    (window as any).sent = 0;
    (window as any).ethers = { utils: { isAddress: () => true, Interface: class { encodeFunctionData() { return '0x1234'; } } }, providers: { Web3Provider: class {} } };
    (window as any).ethereum = { on() {}, request: async ({method}: {method:string}) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [wallet];
      if (method === 'eth_chainId') return '0x89';
      if (method === 'eth_getCode') return '0x';
      if (method === 'eth_estimateGas') return '0x10000';
      if (method === 'eth_sendTransaction') { (window as any).sent++; throw new Error('uncertain'); }
      throw new Error('unexpected request');
    } };
  });
  await page.goto('/profile-07.html');
  await page.getByRole('button', { name:'Connect wallet' }).click();
  await expect(page.getByText('Wallet ready. Choose a profile type.')).toBeVisible();
  await page.getByRole('button', { name:'Review registration' }).click();
  await page.getByLabel('I understand and want to register this profile.').check();
  await page.getByRole('button', { name:'Register profile' }).click();
  await expect(page.getByText(/previous registration may still be pending/)).toBeVisible();
  await page.getByRole('button', { name:'Connect wallet' }).click();
  await page.getByRole('button', { name:'Review registration' }).click();
  await page.getByLabel('I understand and want to register this profile.').check();
  await page.getByRole('button', { name:'Register profile' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).sent)).toBe(1);
});

test('mobile wallet is selected explicitly and account changes invalidate the session', async ({page}) => {
  await page.route('**/ethers@5.7.2/**', route=>route.abort());
  await page.route('**/backend/js/odp-wallet-wc-loader.js', route=>route.fulfill({contentType:'application/javascript',body:'window.odpEnsureWalletConnectBundle=async()=>{};'}));
  await page.route('**/backend/js/odp-v07-reader.js', route=>route.fulfill({contentType:'application/javascript',body:'window.ODPV07Reader={open:async()=>({readProfileByWallet:async()=>({profile:null})})};'}));
  await page.addInitScript(()=>{
    localStorage.setItem('odp_locale','en');
    const wallet='0x'+'1'.repeat(40), handlers:any={};
    (window as any).ethers={utils:{isAddress:()=>true},providers:{Web3Provider:class {}}};
    const mobile={on:(name:string,fn:Function)=>{handlers[name]=fn;},request:async({method}:{method:string})=>{if(method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';throw Error('unexpected');}};
    (window as any).odpWalletConnectConnect=async()=>mobile;
    (window as any).changeMobileAccount=()=>handlers.accountsChanged([]);
  });
  await page.goto('/profile-07.html');
  await page.getByRole('button',{name:'Mobile wallet · WalletConnect'}).click();
  await expect(page.getByText('Wallet ready. Choose a profile type.')).toBeVisible();
  await page.evaluate(()=>(window as any).changeMobileAccount());
  await expect(page.getByText('Wallet changed. Connect again.')).toBeVisible();
  await expect(page.getByLabel('Profile type')).toBeHidden();
});

test('each profile type is reviewed and changing it clears confirmation', async ({page}) => {
  await page.route('**/ethers@5.7.2/**', route => route.abort());
  await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({contentType:'application/javascript',body:'window.ODPV07Reader={open:async()=>({readProfileByWallet:async()=>({profile:null})})};'}));
  await page.addInitScript(() => {
    localStorage.setItem('odp_locale','en'); const wallet='0x'+'1'.repeat(40);
    (window as any).ethers={utils:{isAddress:()=>true},providers:{Web3Provider:class {}}};
    (window as any).ethereum={on(){},request:async({method}:{method:string})=>{if(method==='eth_requestAccounts'||method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';throw Error('unexpected');}};
  });
  await page.goto('/profile-07.html');
  await page.getByRole('button',{name:'Connect wallet'}).click();
  for(const [role,label] of [['C','individual creator'],['B','brand'],['P','expert or institution'],['M','museum']]) {
    await page.getByLabel('Profile type').selectOption(role);
    await expect(page.locator('#confirmation')).toBeHidden();
    await page.getByRole('button',{name:'Review registration'}).click();
    await expect(page.locator('#selection')).toContainText(`${role} — ${label}`);
    await expect(page.getByLabel('I understand and want to register this profile.')).not.toBeChecked();
    await page.getByLabel('I understand and want to register this profile.').check();
  }
});
