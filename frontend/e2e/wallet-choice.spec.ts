import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
});

for (const route of ['profile', 'issue', 'release']) {
  test(`${route} only offers WalletConnect and can retry a failed connection`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('odp_locale', 'ru');
      let attempts = 0;
      const fake = {
        ethereum: { request: () => { throw new Error('Injected wallet must not be used'); } },
        odpWalletConnectConnect: async () => { attempts++; throw new Error('Wallet closed'); },
        odpTestAttempts: () => attempts,
      };
      Object.assign(window, fake);
    });
    await page.goto(`/${route}-07.html`);
    const connect = page.getByRole('button', { name: 'Подключить через WalletConnect' });
    await expect(connect).toBeVisible();
    await expect(page.getByRole('button', { name: /Safe App|^Подключить кошелёк$/ })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).odpTestAttempts())).toBe(0);
    await connect.click();
    await expect(page.getByRole('status')).toContainText('Не удалось подключиться');
    await expect(connect).toBeEnabled();
    await connect.click();
    await expect.poll(() => page.evaluate(() => (window as any).odpTestAttempts())).toBe(2);
  });
}

for (const route of ['creator', 'passport']) {
  test(`legacy ${route} offers a keyboard-accessible WalletConnect button`, async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('odp_skip_wallet_autoconnect', '1');
      sessionStorage.setItem('odp_site_trust_disclosure_ok', '1');
      Object.assign(window, {
        odpWalletConnectConnect: async () => { throw new Error('Wallet closed'); },
      });
    });
    await page.goto(`/${route}.html`);
    const connect = page.getByRole('button', { name: 'Connect with WalletConnect' });
    await expect(connect).toBeVisible();
    await expect(page.getByText('Connect wallet', { exact: true })).toHaveCount(0);
    await connect.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Could not connect/)).toBeVisible();
    await expect(connect).toBeEnabled();
  });
}

for (const profileId of ['', 'C-123-456-789-012']) {
  test(`legacy profile page handles a wallet ${profileId ? 'with' : 'without'} a 0.6 profile`, async ({ page }) => {
    await page.route('**/backend/js/odp-contract.js?*', route => route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.odpMergeRegistryConfigAsync = async () => {};
        window.odpRequireSingleEthereumAccount = async () => ({ ok: true });
        window.odpHasValidRegistryAddress = () => true;
        window.odpFinalizeWalletContract = async () => ({
          generation: 6,
          contract: { getCreatorByWallet: async () => ${JSON.stringify(profileId)} },
        });
      `,
    }));
    await page.addInitScript(() => {
      sessionStorage.setItem('odp_skip_wallet_autoconnect', '1');
      sessionStorage.setItem('odp_site_trust_disclosure_ok', '1');
      Object.assign(window, {
        odpWalletConnectConnect: async () => ({}),
        ethers: { providers: { Web3Provider: class {
          getSigner() { return { getAddress: async () => '0x' + '1'.repeat(40) }; }
        } } },
      });
    });
    await page.goto('/creator.html');
    const register = page.getByRole('link', { name: 'Register an ODP 0.7 profile' });
    await expect(register).toHaveAttribute('href', 'profile-07.html');
    await page.getByRole('button', { name: 'Connect with WalletConnect' }).click();

    if (profileId) {
      await expect(page.getByRole('link', { name: /Verify profile/ })).toHaveAttribute('href', /verify\.html/);
    } else {
      await expect(page.getByRole('status')).toContainText('This wallet has no ODP 0.6 profile.');
    }
    await expect(page.getByRole('button', { name: /register/i })).toHaveCount(0);
    await register.click();
    await expect(page).toHaveURL(/profile-07\.html$/);
  });
}

test('legacy verification tools open and return to the list', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('odp_site_trust_disclosure_ok', '1');
    Object.assign(window, {
      odpWalletConnectConnect: async () => { throw new Error('Wallet closed'); },
    });
  });
  await page.goto('/verify.html');
  const record = page.getByRole('button', { name: 'Record a document hash' });
  const back = page.getByRole('button', { name: /Back to Verify/ });
  await record.click();
  const connect = page.getByRole('button', { name: 'Connect with WalletConnect' });
  await expect(connect).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send document hash' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toHaveCount(0);
  await connect.click();
  await expect(page.getByText(/Could not connect/)).toBeVisible();
  await back.click();
  await page.getByRole('button', { name: 'Check a document hash' }).click();
  await expect(page.locator('#docVerifyFile')).toBeVisible();
  await back.click();
  await page.getByRole('button', { name: 'Check offline passport data' }).click();
  await expect(page.locator('#offlineVerifyBase64')).toBeVisible();
  await back.click();
  await expect(record).toBeVisible();
});
