import { test, expect } from "@playwright/test";

test.describe("static smoke", () => {
  test("verify and passport pages load", async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
    const verify = await page.goto("/verify.html");
    expect(verify?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("heading", { name: /verify/i })).toBeVisible();

    const passport = await page.goto("/passport.html");
    expect(passport?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });
});

test('the legacy trust dialog has keyboard focus and closes for the current session', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
  await page.goto('/verify.html');
  const dialog = page.getByRole('dialog');
  const title = dialog.getByRole('heading', { level: 2 });
  const dismiss = dialog.getByRole('button');
  await expect(dialog).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await expect(dismiss).toBeInViewport();
  await expect(title).toBeFocused();
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(tab);
  await expect(dialog.getByRole('region')).toBeFocused();
  await page.keyboard.press(tab);
  await expect(dismiss).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('odp_site_trust_disclosure_ok'))).toBe('1');
  await page.reload();
  await expect(page.getByRole('heading', { name: /verify/i, level: 1 })).toBeVisible();
  await expect(dialog).toBeHidden();
});
