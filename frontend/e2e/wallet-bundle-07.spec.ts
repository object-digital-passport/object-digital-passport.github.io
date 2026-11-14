import { test, expect } from '@playwright/test';

test('published WalletConnect bundle loads without requesting a wallet or a network', async ({ page }) => {
  const externalRequests: string[] = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => {
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.route('**/wallet-bundle-test', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Wallet bundle test</title>',
  }));
  await page.goto('/wallet-bundle-test');
  await page.addScriptTag({ url: '/backend/js/odp-wallet-wc.bundle.js' });
  const result = await page.evaluate(async () => {
    const wallet = window as any;
    const restored = await wallet.odpWalletConnectTryRestoreSession();
    let error = '';
    try { await wallet.odpWalletConnectConnect(); }
    catch (e) { error = String((e as Error).message); }
    await wallet.odpWalletConnectDisconnect();
    return { restored, error, active: wallet.odpWalletConnectIsActive(), provider: wallet.odpWalletConnectGetEip1193() };
  });
  expect(result.restored).toBeNull();
  expect(result.error).toContain('WalletConnect is not configured');
  expect(result.active).toBe(false);
  expect(result.provider).toBeNull();
  expect(externalRequests).toEqual([]);
});
