import { expect, test, type Page } from '@playwright/test';

type Frame = { text: string; language: string };

async function watchHeading(page: Page, selector: string) {
  await page.addInitScript(selector => {
    const frames: Frame[] = [];
    Object.assign(window, { odpVisibleHeadings: frames });
    function sample() {
      const heading = document.querySelector(selector);
      if (heading?.getBoundingClientRect().width && getComputedStyle(heading).visibility === 'visible') {
        const text = heading.textContent?.trim() || '';
        const language = document.documentElement.lang;
        const last = frames[frames.length - 1];
        if (text && (last?.text !== text || last.language !== language)) frames.push({ text, language });
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, selector);
}

const readFrames = (page: Page) => page.evaluate(() =>
  (window as Window & { odpVisibleHeadings: Frame[] }).odpVisibleHeadings
);

test.use({ locale: 'ru-RU', viewport: { width: 390, height: 850 } });

test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
});

const v07 = [
  ['verify', 'Проверить паспорт'],
  ['profile', 'Профиль'],
  ['issue', 'Создать паспорт'],
  ['release', 'Действия с паспортом'],
] as const;

for (const [route, title] of v07) {
  test(`${route} shows Russian in the first frame while ethers is pending`, async ({ page }) => {
    let releaseRequest!: () => void;
    const held = new Promise<void>(resolve => { releaseRequest = resolve; });
    await page.route('**/ethers@5.7.2/**', async request => {
      await held;
      await request.abort();
    });
    await watchHeading(page, 'h1');
    try {
      await page.goto(`/${route}-07.html`, { waitUntil: 'commit' });
      await expect.poll(() => readFrames(page)).toEqual([{ text: title, language: 'ru' }]);
      await expect(page).toHaveTitle(`${title} — ODP 0.7`);
      const picker = page.getByRole('combobox', { name: 'Язык' });
      await expect(picker).toHaveValue('ru');
      await expect(picker.locator('option:checked')).toHaveText('🇷🇺 RU');
      await expect(picker.getByRole('option', { name: 'English' })).toHaveText('🇬🇧 EN');
    } finally {
      releaseRequest();
    }
    await page.waitForLoadState();
    expect(await readFrames(page)).toEqual([{ text: title, language: 'ru' }]);
  });
}

test('a saved language survives reload and links between the legacy and 0.7 pages', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await page.getByLabel('Язык', { exact: true }).selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
  await page.getByRole('link', { name: /Verify —/ }).click();
  await expect(page).toHaveURL(/verify-07\.html$/);
  await expect(page.getByRole('heading', { name: 'Verify a passport' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru');
  await page.getByRole('link', { name: 'Главная' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByLabel('Язык', { exact: true })).toHaveValue('ru');
});

for (const [route, selector] of [['index', '.home-intro h2'], ['verify', 'h1']]) {
  test(`${route} stays hidden until successful slow dictionaries are applied`, async ({ page }) => {
    let releaseDictionaries!: () => void;
    let seenDictionary!: () => void;
    const held = new Promise<void>(resolve => { releaseDictionaries = resolve; });
    const requested = new Promise<void>(resolve => { seenDictionary = resolve; });
    await page.route('**/localization/ru/*.json?*', async request => {
      seenDictionary();
      await held;
      await request.continue();
    });
    await watchHeading(page, selector);
    try {
      await page.goto(`/${route}.html`);
      await requested;
      await expect(page.locator(selector)).toBeHidden();
      expect(await readFrames(page)).toEqual([]);
    } finally {
      releaseDictionaries();
    }
    await expect.poll(() => readFrames(page)).toHaveLength(1);
    expect((await readFrames(page))[0].language).toBe('ru');
  });
}

test('a timed-out translation stays English and can be retried with the switch', async ({ page }) => {
  let releaseDictionaries!: () => void;
  let lateResponseAttempted!: () => void;
  const lateResponse = new Promise<void>(resolve => { lateResponseAttempted = resolve; });
  const held = new Promise<void>(resolve => { releaseDictionaries = resolve; });
  const dictionary = '**/localization/ru/*.json?*';
  await page.route(dictionary, async request => {
    await held;
    try {
      await request.continue();
    } catch {
      // The page may have already aborted the request after its deadline.
    } finally {
      lateResponseAttempted();
    }
  });
  await watchHeading(page, '.home-intro h2');
  try {
    await page.goto('/index.html');
    await expect(page.getByLabel('Language', { exact: true })).toHaveValue('en');
    await expect.poll(() => readFrames(page)).toHaveLength(1);
  } finally {
    releaseDictionaries();
  }
  await lateResponse;
  await page.unroute(dictionary);
  expect((await readFrames(page)).map(frame => frame.language)).toEqual(['en']);
  await page.getByLabel('Language', { exact: true }).selectOption('ru');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { name: 'Что вы хотите сделать?' })).toBeVisible();
});

test('a browser that denies storage still gets a Russian first frame', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage disabled', 'SecurityError'); }
    });
  });
  await watchHeading(page, 'h1');
  await page.goto('/verify-07.html');
  await expect.poll(() => readFrames(page)).toEqual([{ text: 'Проверить паспорт', language: 'ru' }]);
});

test.describe('unsupported browser locale', () => {
  test.use({ locale: 'de-DE' });
  test('falls back to English on the first frame', async ({ page }) => {
    await watchHeading(page, 'h1');
    await page.goto('/profile-07.html');
    await expect.poll(() => readFrames(page)).toEqual([{ text: 'Profile', language: 'en' }]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('shows the default HTML on the home page and in a workflow', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.home-intro h2')).toBeVisible();
    await page.goto('/verify-07.html');
    await expect(page.getByRole('heading', { name: 'Verify a passport' })).toBeVisible();
  });
});


test('a registered third language loads 0.7 dictionaries and falls back per page and per key', async ({ page }) => {
  await page.route('**/js/odp-i18n-boot.js?*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('var ODP_LOCALES = [', `var ODP_LOCALES = [
      { code: "de", emoji: "🇩🇪", abbr: "DE", label: "Deutsch", switchLabel: "Sprache" },`);
    await route.fulfill({ response, body });
  });
  await page.route('**/localization/de/*', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/verify-07.json')) {
      await route.fulfill({ json: { title: 'Pass prüfen', home: 'Startseite', intro: '' } });
    } else {
      await route.fulfill({ status: 404 });
    }
  });
  await watchHeading(page, 'h1');
  await page.goto('/verify-07.html#lookup');
  await page.getByRole('combobox', { name: 'Язык' }).selectOption('de');
  const german = page.getByRole('combobox', { name: 'Sprache' });
  await expect(german.locator('option:checked')).toHaveText('🇩🇪 DE');
  await expect(page.getByRole('link', { name: 'Startseite' })).toBeVisible();
  await expect(page.getByText('Enter a passport ID or odp:// locator', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/#lookup$/);
  await page.reload();
  await expect.poll(() => readFrames(page)).toEqual([{ text: 'Pass prüfen', language: 'de' }]);

  await page.goto('/profile-07.html');
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#language')).toHaveValue('de');
  await expect(page.getByRole('button', { name: 'Connect with WalletConnect' })).toBeEnabled();
  await page.locator('#language').selectOption('ru');
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
});
