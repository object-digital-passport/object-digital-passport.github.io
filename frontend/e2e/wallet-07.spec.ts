import { test, expect } from '@playwright/test';
for(const screen of ['issue','release']) test(`mobile wallet connects and invalidates ${screen} screen`,async({page})=>{
  await page.route('**/ethers@5.7.2/**',route=>route.abort());
  await page.route('**/backend/js/odp-wallet-wc-loader.js',route=>route.fulfill({contentType:'application/javascript',body:'window.odpEnsureWalletConnectBundle=async()=>{};'}));
  await page.route('**/backend/js/odp-v07-reader.js',route=>route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readProfileByWallet:async wallet=>({profile:{wallet,creatorId:'C-123-456-789-012',typePrefix:'0x43'}})})};`}));
  await page.addInitScript(()=>{
    localStorage.setItem('odp_locale','en'); const wallet='0x'+'1'.repeat(40),handlers:any={};
    (window as any).ethers={utils:{isAddress:()=>true},providers:{Web3Provider:class {}}};
    const mobile={on:(event:string,fn:Function)=>{handlers[event]=fn;},request:async({method}:{method:string})=>{if(method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';throw Error('unexpected');}};
    (window as any).odpWalletConnectConnect=async()=>mobile; (window as any).disconnectMobile=()=>handlers.disconnect();
  });
  await page.goto('/'+screen+'-07.html');
  await page.getByRole('button',{name:'Mobile wallet · WalletConnect'}).click();
  await expect(page.locator('#status')).toContainText(screen==='issue'?'Profile ready:':'Wallet connected:');
  await page.evaluate(()=>(window as any).disconnectMobile());
  await expect(page.locator('#status')).toContainText('Wallet changed.');
});
