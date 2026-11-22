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

test('resuming a saved issuance explains the file and requires a connected wallet', async ({ page }) => {
  await page.goto('/issue-07.html');
  await expect(page.getByLabel('Select a saved issuance file (.odpjob)')).toBeHidden();
  await page.getByText('Resume a saved issuance', { exact: true }).click();
  await expect(page.getByLabel('Select a saved issuance file (.odpjob)')).toBeDisabled();
  await expect(page.getByText('Connect the same wallet to open it.', { exact: false })).toBeVisible();
});

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
