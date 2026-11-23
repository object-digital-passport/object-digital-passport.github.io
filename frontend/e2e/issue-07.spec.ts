import { test, expect } from '@playwright/test';

for (const kind of ['physical','digital','mixed']) {
  test(`issues a ${kind} passport without a backup file`, async ({page}) => {
    await page.route('**/ethers@5.7.2/**', route => route.abort());
    await page.route('**/backend/js/odp-v07-reader.js', route => route.fulfill({contentType:'application/javascript',body:`window.ODPV07Reader={open:async()=>({readProfileByWallet:async wallet=>({profile:{wallet,creatorId:'C-123-456-789-012',typePrefix:'0x43'}}),readMintOperation:async()=>({state:'not-finalized'}),verifyFailedMint:async()=>({blockNumber:1})})};`}));
    await page.addInitScript(() => {
      localStorage.setItem('odp_locale','en');
      const wallet='0x'+'1'.repeat(40);
      (window as any).ethers={utils:{isAddress:()=>true,defaultAbiCoder:{encode:()=> '0x1234'},keccak256:()=> '0x'+'2'.repeat(64),Interface:class {encodeFunctionData(){return '0x1234';} decodeFunctionData(){return [];}}},providers:{Web3Provider:class {}}};
      const handlers:Record<string,Function>={};
      (window as any).odpWalletConnectConnect=async()=>({on(event:string,fn:Function){handlers[event]=fn;},request:async ({method}:{method:string})=>{if(method==='eth_requestAccounts'||method==='eth_accounts')return [wallet];if(method==='eth_chainId')return '0x89';if(method==='eth_getBlockByNumber')return {timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)};if(method==='eth_getCode')return '0x';if(method==='eth_estimateGas')return '0x1234';if(method==='eth_sendTransaction'){if((window as any).uncertainMint)throw new Error('Connection lost');if((window as any).delayMint)return await new Promise(resolve=>(window as any).finishMint=resolve);return '0x'+'a'.repeat(64);}if(method==='eth_getTransactionCount')return '0x1';throw new Error('unexpected wallet request');}});
      (window as any).disconnectTestWallet=()=>handlers.disconnect();
    });
    await page.goto('/issue-07.html');
    await page.getByRole('button',{name:'Connect with WalletConnect'}).click();
    await expect(page.getByText('Profile ready:',{exact:false})).toBeVisible();
    await page.getByLabel('Object type').selectOption(kind);
    await page.getByLabel('Title',{exact:true}).fill('An object');
    await page.getByLabel('Author name declared by issuer').fill('Artist');
    await page.getByLabel('Short description').fill('A test object');
    if(kind!=='digital'){
      const photo=kind==='physical'?Buffer.from('not an image'):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
      await page.getByLabel('Original photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:photo});
      await page.getByLabel('Width').fill('10'); await page.getByLabel('Height').fill('20');
      await page.getByLabel('Materials, separated by commas').fill('paper');
      await page.getByLabel('Distinguishing features').fill('a mark');
      await page.getByLabel('Category').fill('art');
    }
    if(kind!=='physical'){
      const original=kind==='digital'?Buffer.from('<img src=x onerror=alert(1)>'):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
      await page.getByLabel('Original file').setInputFiles({name:kind==='digital'?'original.txt':'original.png',mimeType:kind==='digital'?'text/plain':'image/png',buffer:original});
      await page.getByLabel('Digital type').fill(kind==='digital'?'text':'image'); await page.getByLabel('File format').fill(kind==='digital'?'txt':'png');
    }
    await page.getByRole('button',{name:'Prepare passport'}).click();
    await expect(page.getByRole('heading',{name:'Review before issuing'})).toBeVisible();
    if(kind==='physical'){
      await expect(page.locator('#photoStatus')).toContainText('cannot be displayed');
      await page.getByLabel('I reviewed these details and want to issue permanently.').check();
      await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
      await page.getByRole('button',{name:'Edit details'}).click();
      await page.getByLabel('Original photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')});
      await page.getByRole('button',{name:'Prepare passport'}).click();
    }
    if(kind!=='digital')await expect.poll(()=>page.locator('#preview').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
    await expect(page.locator('#summary')).toContainText('An object');
    await expect(page.locator('#summary')).toContainText('Prepared at:');
    await expect(page.locator('#summary')).toContainText('The registry records the actual issuance time separately');
    await expect(page.locator('#summary')).toContainText('Mint execution deadline');
    await expect(page.locator('#summary')).toContainText('Unique object · edition size 1');
    if(kind!=='digital')await expect(page.locator('#summary')).toContainText('a mark');
    if(kind!=='physical'){
      await expect(page.locator('#summary')).toContainText(kind==='digital'?'text · txt':'image · png');
      if(kind==='digital'){
        await expect(page.locator('#digitalPreviewText')).toHaveText('<img src=x onerror=alert(1)>');
        await expect(page.locator('#digitalPreviewText img')).toHaveCount(0);
      } else {
        await expect(page.locator('#digitalPreviewImage')).toBeVisible();
        await expect.poll(()=>page.locator('#digitalPreviewImage').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(1);
      }
      const originalDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download the exact original'}).click();
      const originalPath=await (await originalDownload).path();if(!originalPath)throw Error('Original unavailable');
      expect(require('fs').readFileSync(originalPath)).toEqual(kind==='digital'?Buffer.from('<img src=x onerror=alert(1)>'):Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'));
    }
    await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
    await expect(page.getByText(/\.odpjob/i)).toHaveCount(0);
    await page.getByLabel('I reviewed these details and want to issue permanently.').check();
    if(kind!=='physical'){
      await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
      await page.getByLabel('I reviewed this digital original.').check();
    }
    await expect(page.getByRole('button',{name:'Issue permanently'})).toBeEnabled();
    if(kind==='physical'){
      await page.evaluate(() => { (window as any).uncertainMint=true; });
      await page.getByRole('button',{name:'Issue permanently'}).click();
      await expect(page.getByText(/The result is unknown/)).toBeVisible();
      await page.getByRole('button',{name:'Check issuance status'}).click();
      await expect(page.getByText(/The result is unknown/)).toBeVisible();
      await expect(page.getByRole('button',{name:'Check wallet and prepare the saved job'})).toBeDisabled();
      await page.getByLabel('I checked every wallet and device: no signed or pending request for this job exists.').check();
      await page.getByRole('button',{name:'Check wallet and prepare the saved job'}).click();
      await expect(page.getByText(/The saved job is ready to review/)).toBeVisible();
      await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
    }
    if(kind==='digital'){
      await page.getByRole('button',{name:'Issue permanently'}).click();
      await expect(page.getByText(/Request sent/)).toBeVisible();
      await expect(page.getByRole('button',{name:'Check failed transaction and prepare retry'})).toBeDisabled();
      await page.getByLabel('I checked that no other request for this job is pending or can still be sent.').check();
      await page.getByRole('button',{name:'Check failed transaction and prepare retry'}).click();
      await expect(page.getByText(/The failed transaction was verified/)).toBeVisible();
      await expect(page.getByRole('button',{name:'Issue permanently'})).toBeDisabled();
    }
    if(kind==='mixed'){
      await page.evaluate(() => { (window as any).delayMint=true; });
      await page.getByRole('button',{name:'Issue permanently'}).click();
      await expect.poll(() => page.evaluate(() => typeof (window as any).finishMint)).toBe('function');
      await page.evaluate(() => { (window as any).disconnectTestWallet(); (window as any).finishMint('0x'+'a'.repeat(64)); });
      await expect(page.locator('#status')).toContainText('Wallet changed.');
      await expect(page.locator('#review')).toBeHidden();
      await expect(page.getByRole('button',{name:'Connect with WalletConnect'})).toBeEnabled();
      await expect(page.locator('#status')).toContainText('Wallet changed.');
    }
  });
}
