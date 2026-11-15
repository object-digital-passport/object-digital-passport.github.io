const {chromium,webkit}=require(process.cwd()+'/frontend/e2e/node_modules/playwright');
const fs=require('fs');
const out='/tmp/odp-mwg-audit';
(async()=>{
 const browser=await chromium.launch();
 const records=[];
 for(const locale of ['en','ru']){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)).*/,r=>r.abort());
  await context.addInitScript(l=>localStorage.setItem('odp_locale',l),locale);
  for(const name of ['index','verify-07','profile-07','issue-07','release-07','verify','creator','passport']){
   const page=await context.newPage(); const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4185/'+name+'.html');
   await page.waitForTimeout(500);
   await page.addScriptTag({path:out+'/axe/package/axe.min.js'});
   const axe=await page.evaluate(async()=>{
    const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}});
    return {violations:r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,count:v.nodes.length})),passes:r.passes.length};
   });
   const layout=[];
   for(const width of [320,390,521,768,1440]){
    await page.setViewportSize({width,height:844});
    const info=await page.evaluate(()=>{
     const el=document.querySelector('h1'),r=el.getBoundingClientRect(),cs=getComputedStyle(el);
     return {scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,h1:{width:r.width,height:r.height,display:cs.display,visibility:cs.visibility,text:el.textContent},outside:[...document.querySelectorAll('input,button,select,a,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left< -1)}).map(e=>({id:e.id,tag:e.tagName,text:e.textContent.slice(0,50)}))};
    });
    layout.push({width,...info});
    if(locale==='en'&&[320,390].includes(width)&&['index','verify-07'].includes(name))await page.screenshot({path:out+'/'+name+'-'+width+'.png',fullPage:true});
   }
   await page.setViewportSize({width:390,height:844});
   const before=await page.locator('h1').evaluate(e=>getComputedStyle(e).fontSize);
   await page.addStyleTag({content:'html {font-size:200% !important}'});
   const zoom=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:innerWidth,h1Font:getComputedStyle(document.querySelector('h1')).fontSize}));
   if(name==='verify-07'){
    await page.locator('#passport-id').fill('wrong');await page.locator('#submit').click();
    zoom.validation=await page.locator('#passport-id').evaluate(e=>({ariaInvalid:e.getAttribute('aria-invalid'),describedby:e.getAttribute('aria-describedby'),nativeValid:e.validity.valid,active:document.activeElement.id,error:document.querySelector('#result').textContent}));
   }
   records.push({name,locale,errors,axe,layout,textScale:{before,...zoom}});
   console.log(name,locale,'axe:',axe.violations.map(v=>v.id).join(','),'overflow:',layout.filter(l=>l.scrollWidth>l.clientWidth).map(l=>l.width).join(','));
   await page.close();
  }
  await context.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(records,null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
