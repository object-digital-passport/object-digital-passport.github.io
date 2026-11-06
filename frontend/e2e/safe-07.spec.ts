import {test,expect} from '@playwright/test';
test('Safe mint stays pending with its proposal identity',async({page})=>{
  await page.route('**/ethers@5.7.2/**',route=>route.abort());
  await page.route('**/backend/js/odp-v07-safe-app.bundle.js',route=>route.fulfill({contentType:'application/javascript',body:'window.odpOpenSafeApp=async()=>window.safeProvider;'}));
  await page.route('**/backend/js/odp-v07-reader.js',route=>route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readProfileByWallet:async wallet=>({profile:{wallet,creatorId:'B-123-456-789-012',typePrefix:'0x42'}}),readMintOperation:async()=>({state:'not-finalized'}),verifySafeRejection:async()=>({blockNumber:1})})};`}));
  await page.addInitScript(()=>{
    localStorage.setItem('odp_locale','en');const wallet='0x'+'1'.repeat(40),hash='0x'+'b'.repeat(64);
    (window as any).ethers={utils:{isAddress:()=>true,defaultAbiCoder:{encode:()=> '0x1234'},keccak256:()=> '0x'+'2'.repeat(64),_TypedDataEncoder:{hash:()=>hash},Interface:class{encodeFunctionData(){return '0x12345678';}decodeFunctionData(){return [];}}},providers:{Web3Provider:class{}}};
    (window as any).safeNonce=7;const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:(window as any).safeNonce})},txs:{send:async()=>{(window as any).proposals++;return {safeTxHash:hash};}}};
    (window as any).proposals=0;(window as any).chainTime=Math.floor(Date.now()/1000);
    (window as any).safeProvider={odpSafeSdk:sdk,on(){},request:async({method}:{method:string})=>{if(method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';if(method==='eth_getBlockByNumber')return {timestamp:'0x'+(window as any).chainTime.toString(16)};throw Error('unexpected');}};
  });
  await page.goto('/issue-07.html');await page.getByRole('button',{name:'Connect Safe App'}).click();
  await expect(page.locator('#status')).toContainText('B-123-456-789-012');
  await page.getByLabel('Object type').selectOption('digital');await page.getByLabel('Title',{exact:true}).fill('Safe object');
  await page.getByLabel('Author name declared by issuer').fill('Artist');await page.getByLabel('Short description').fill('Test object');
  await page.getByLabel('Original file').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('safe test')});
  await page.getByLabel('Digital type').fill('text');await page.getByLabel('File format').fill('txt');
  await page.getByRole('button',{name:'Prepare passport'}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download issuance backup'}).click();
  const file=await download,path=await file.path();if(!path)throw Error('backup');
  await page.getByLabel('Select the saved backup to verify it').setInputFiles(path);
  await expect(page.getByText('Backup matches this job.')).toBeVisible();
  await page.getByLabel('I reviewed this digital original.').check();
  await page.getByLabel('I reviewed these details and want to issue permanently.').check();await page.getByRole('button',{name:'Issue permanently'}).click();
  await expect(page.locator('#status')).toContainText('Safe proposal is awaiting');
  await expect(page.locator('#summary')).toContainText('Safe proposal · nonce: 7');
  await expect(page.getByRole('button',{name:'Download .odpass'})).toBeHidden();
  await page.getByRole('button',{name:'Check issuance status'}).click();
  await expect(page.locator('#status')).toContainText('Safe proposal is awaiting');
  expect(await page.evaluate(()=>(window as any).proposals)).toBe(1);
  await page.evaluate(()=>{const d=new Date();(window as any).chainTime=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000;});
  await page.getByRole('button',{name:'Check issuance status'}).click();
  await expect(page.locator('#status')).toContainText('passed its execution deadline');
  await page.getByLabel('I reviewed the Safe queue and want to propose this cancellation.').check();
  await page.getByRole('button',{name:'Propose cancellation in Safe'}).click();
  await expect(page.locator('#status')).toContainText('cancellation is awaiting');
  expect(await page.evaluate(()=>(window as any).proposals)).toBe(2);
  await page.evaluate(()=>{(window as any).safeNonce=8;});
  await page.getByLabel('Cancellation execution transaction hash').fill('0x'+'d'.repeat(64));
  await page.getByRole('button',{name:'Verify cancellation and prepare the new month'}).click();
  await expect(page.locator('#status')).toContainText('The cancellation was verified');
  await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
});
for(const screen of ['profile','release'])test(`Safe ${screen} proposal is pending and journaled`,async({page})=>{
  await page.route('**/ethers@5.7.2/**',route=>route.abort());
  await page.route('**/backend/js/odp-v07-safe-app.bundle.js',route=>route.fulfill({contentType:'application/javascript',body:'window.odpOpenSafeApp=async()=>window.safeProvider;'}));
  await page.route('**/backend/js/odp-v07-reader.js',route=>route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readProfileByWallet:async()=>({profile:null}),readPassport:async id=>({chainId:137,registry:'0x3281492981dcd492cc2f7c17398134e1d3b5ca1f',blockTimestamp:1000,blockNumber:1,header:{passportId:id,creator:'0x'+'1'.repeat(40),creatorId:'B-123-456-789-012',title:'Test'},classification:{revoked:false},release:{printFinalizedAt:0,revocationDeadline:2000}})})};`}));
  await page.addInitScript(()=>{
    localStorage.setItem('odp_locale','en');const wallet='0x'+'1'.repeat(40),hash='0x'+'b'.repeat(64);
    (window as any).ethers={utils:{isAddress:()=>true,keccak256:()=>hash,toUtf8Bytes:(s:string)=>s,_TypedDataEncoder:{hash:()=>hash},Interface:class{encodeFunctionData(){return '0x12345678';}decodeFunctionData(){return ['ODP-2026-09-000000001',hash];}}},providers:{Web3Provider:class{}}};
    const sdk={safe:{getInfo:async()=>({safeAddress:wallet,chainId:137,isReadOnly:false,version:'1.4.1',nonce:7})},txs:{send:async()=>{(window as any).proposals++;return {safeTxHash:hash};}}};
    (window as any).proposals=0;(window as any).chainTime=1000;(window as any).safeProvider={odpSafeSdk:sdk,on(){},request:async({method}:{method:string})=>{if(method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';if(method==='eth_getBlockByNumber')return {timestamp:'0x'+(window as any).chainTime.toString(16)};throw Error('unexpected');}};
  });
  await page.goto('/'+screen+'-07.html');await page.getByRole('button',{name:'Connect Safe App'}).click();
  if(screen==='profile'){
    await page.getByRole('button',{name:'Review registration'}).click();await expect(page.locator('#status')).toContainText('personal C profile');
    await page.getByLabel('Profile type').selectOption('B');await page.getByRole('button',{name:'Review registration'}).click();
    await page.getByLabel('I understand and want to register this profile.').check();await page.getByRole('button',{name:'Register profile'}).click();
  }else{
    await page.getByLabel('Passport ID').fill('ODP-2026-09-000000001');await page.getByRole('button',{name:'Load passport'}).click();
    await page.getByLabel('Reason for withdrawal').fill('Example');await page.getByRole('button',{name:'Review action'}).click();
    await page.getByLabel('I understand and want to continue.').check();await page.getByRole('button',{name:'Confirm in wallet'}).click();
  }
  await expect(page.locator('#status')).toContainText('Safe proposal is awaiting');expect(await page.evaluate(()=>(window as any).proposals)).toBe(1);
  if(screen==='release'){
    await page.getByRole('button',{name:'Load passport'}).click();
    await page.evaluate(()=>{(window as any).chainTime=2001;});
    await page.getByRole('button',{name:'Check Safe proposal'}).click();
    await expect(page.locator('#status')).toContainText('Safe proposal has expired');
    await page.getByLabel('I reviewed the Safe queue and want to propose cancellation.').check();
    await page.getByRole('button',{name:'Propose cancellation in Safe'}).click();
    await expect(page.locator('#status')).toContainText('Cancellation is awaiting');
    expect(await page.evaluate(()=>(window as any).proposals)).toBe(2);
  }
});
