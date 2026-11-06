import { test, expect } from '@playwright/test';

test('home links to 0.7 and keeps previous URLs in both languages', async ({page}) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
  await page.addInitScript(() => { if (!localStorage.getItem('odp_locale')) localStorage.setItem('odp_locale','en'); });
  await page.goto('/index.html');
  await expect(page.locator('a[href="verify-07.html"]').first()).toBeVisible();
  await expect(page.locator('a[href="issue-07.html"]').first()).toBeVisible();
  await expect(page.locator('a[href="profile-07.html"]').first()).toBeVisible();
  await expect(page.locator('a[href="release-07.html"]')).toBeVisible();
  for(const path of ['creator.html','passport.html','verify.html']) await expect(page.locator(`a[href="${path}"]`)).toBeVisible();
  await page.locator('#odpLangSelect').selectOption('ru');
  await expect(page.getByText('Предыдущая версия:')).toBeVisible();
  await expect(page.getByRole('link',{name:'Действия с паспортом'})).toHaveAttribute('href','release-07.html');
});
