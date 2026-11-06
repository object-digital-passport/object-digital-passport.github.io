import {test,expect} from '@playwright/test';
for(const width of [390,1440]) test(`0.7 pages fit a ${width}px viewport`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/,route=>route.abort());
  await page.addInitScript(()=>localStorage.setItem('odp_locale','en'));
  for(const name of ['index','verify-07','profile-07','issue-07','release-07']){
    await page.goto('/'+name+'.html');await expect(page.locator('h1').first()).toBeVisible();
    const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    expect(sizes.page,`${name} horizontal overflow`).toBeLessThanOrEqual(sizes.viewport);
    const visibleHidden=await page.locator('[hidden]').evaluateAll(elements=>elements.filter(el=>getComputedStyle(el).display!=='none').map(el=>el.id||el.tagName));
    expect(visibleHidden,`${name} hidden elements`).toEqual([]);
    if(width===390 && ['index','issue-07','verify-07'].includes(name))await page.screenshot({path:testInfo.outputPath('odp-'+name+'-mobile.png'),fullPage:true,animations:'disabled'});
  }
});
