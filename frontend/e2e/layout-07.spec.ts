import {test,expect} from '@playwright/test';
for(const width of [320,390,521,1440]) test(`0.7 pages fit a ${width}px viewport`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/,route=>route.abort());
  await page.addInitScript(()=>localStorage.setItem('odp_locale','en'));
  for(const name of ['index','verify-07','profile-07','issue-07','release-07']){
    await page.goto('/'+name+'.html');await expect(page.locator('h1').first()).toBeVisible();
    const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    expect(sizes.page,`${name} horizontal overflow`).toBeLessThanOrEqual(sizes.viewport);
    const overflowingFiles=await page.locator('input[type="file"]:visible').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().right>document.documentElement.clientWidth).map(el=>el.id));
    expect(overflowingFiles,`${name} file fields outside viewport`).toEqual([]);
    const visibleHidden=await page.locator('[hidden]').evaluateAll(elements=>elements.filter(el=>getComputedStyle(el).display!=='none').map(el=>el.id||el.tagName));
    expect(visibleHidden,`${name} hidden elements`).toEqual([]);
    if(width===390 && ['index','issue-07','verify-07'].includes(name))await page.screenshot({path:testInfo.outputPath('odp-'+name+'-mobile.png'),fullPage:true,animations:'disabled'});
  }
});

for (const width of [768, 1440, 1920]) {
  for (const locale of ['en', 'ru']) {
    test(`0.7 pages share one desktop column at ${width}px in ${locale}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/, route => route.abort());
      await page.addInitScript(locale => localStorage.setItem('odp_locale', locale), locale);

      for (const route of ['verify', 'profile', 'issue', 'release']) {
        await page.goto(`/${route}-07.html`);
        await expect(page.locator('#language')).toHaveValue(locale);
        if (width === 1440 && locale === 'ru') {
          await page.screenshot({ path: testInfo.outputPath(`${route}-desktop.png`), animations: 'disabled' });
        }

        const layout = await page.evaluate(() => {
          const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect();
          const header = box('.page > header');
          const nav = box('.page > .nav');
          const cards = Array.from(document.querySelectorAll('.page > .card'), card => card.getBoundingClientRect());
          const language = document.querySelector<HTMLSelectElement>('#language')!;
          const connect = document.querySelector<HTMLButtonElement>('#connect');
          const label = document.createRange();
          if (connect) label.selectNodeContents(connect);
          return {
            centered: Math.abs((header.left + header.right) / 2 - document.documentElement.clientWidth / 2),
            edgeMismatch: Math.max(...[nav, ...cards].flatMap(item =>
              [Math.abs(item.left - header.left), Math.abs(item.right - header.right)])),
            languageRight: Math.abs(language.parentElement!.getBoundingClientRect().right - header.right),
            languageBackground: getComputedStyle(language).backgroundColor,
            buttonExcess: connect ? connect.getBoundingClientRect().width - label.getBoundingClientRect().width : 0,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });

        expect.soft(layout.centered, route + ' centered column').toBeLessThanOrEqual(1);
        expect.soft(layout.edgeMismatch, route + ' shared edges').toBeLessThanOrEqual(1);
        expect.soft(layout.languageRight, route + ' aligned language picker').toBeLessThanOrEqual(1);
        expect.soft(layout.languageBackground, route + ' language picker background').toBe('rgba(0, 0, 0, 0)');
        expect.soft(layout.buttonExcess, route + ' button padding').toBeLessThanOrEqual(46);
        expect.soft(layout.overflow, route + ' horizontal overflow').toBeLessThanOrEqual(0);
      }
    });
  }
}
