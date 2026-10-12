/* Header geometry, cold navigation, deep links and image reuse. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve}=require('./server.cjs'),{fill}=require('./test_controls.cjs');
const N=require('../js/navigation.js');
const settled=page=>page.waitForFunction(()=>!document.querySelector('#global-search-controls').getAnimations().length);
(async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.GUIDE_BROWSER?{channel:process.env.GUIDE_BROWSER}:{})});
  for(const prefix of ['/','/dawnwalker-guide/']){
   const context=await browser.newContext(),page=await context.newPage(),base=server.base(prefix),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   for(const width of [320,390,768,1024,1401]){
    await page.setViewportSize({width,height:844});await page.goto(base);await page.locator('.poster-link').first().waitFor();
    const rects=()=>Promise.all(['#global-search-toggle','.repo-link','.primary-navigation','.masthead'].map(s=>page.locator(s).boundingBox()));
    const before=await rects();await page.locator('#global-search-toggle').click();await settled(page);
    assert.equal(await page.locator('#global-search-toggle').getAttribute('aria-expanded'),'true');
    assert.deepEqual(await rects(),before,width+' header moved when search opened');
    const input=await page.locator('#global-search-input').boundingBox();assert(input.x>=0&&input.x+input.width<before[0].x,width+' input must expand left');
    await fill(page.locator('#global-search-input'),'blood');await page.locator('.search-result').first().waitFor();
    const checkPanel=async()=>{const r=await page.locator('#global-search-results-popup').boundingBox(),v=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));assert(r.x>=0&&r.y>=0&&r.x+r.width<=v.width&&r.y+r.height<=v.height+.5,width+' search results outside viewport');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
    await checkPanel();await page.setViewportSize({width,height:360});await page.waitForFunction(()=>{const r=document.querySelector('#global-search-results-popup').getBoundingClientRect();return r.bottom<=innerHeight;});await checkPanel();await page.setViewportSize({width,height:844});
    await page.locator('#global-search-toggle').click();await settled(page);assert.equal(await page.locator('#global-search-controls').isVisible(),false);assert.deepEqual(await rects(),before);
    for(const group of await page.locator('.nav-group').all()){
     const a=await group.boundingBox(),b=await group.locator('.nav-label').boundingBox();assert(Math.abs(a.x+a.width/2-b.x-b.width/2)<1,width+' dropdown trigger not centered');
    }
    // Quick reversals must not leave the input or result panel open.
    await page.locator('#global-search-toggle').click();await page.locator('#global-search-toggle').click();await settled(page);
    assert.equal(await page.locator('#global-search-controls').isVisible(),false);
   }
   // Directory URLs exist as real files, so reload does not need SPA fallback.
   await page.setViewportSize({width:1401,height:900});
   for(const path of [...Object.keys(N.labels).map(s=>s+'/'),...N.pages.map(p=>p.path),'skills/skill-vampire_vrakhirmutation/','equipment/eq-sworddawnwalker5a/']){
    const response=await page.goto(base+path);assert.equal(response.status(),200,path);assert.equal((await page.reload()).status(),200,path+' reload');
    assert.equal(await page.evaluate(()=>new URL(document.baseURI).pathname),prefix);
   }
   await context.close();assert.deepEqual(errors,[]);
   const cold=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),cp=await cold.newPage(),cdp=await cold.newCDPSession(cp),images=[];
   await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
   cp.on('request',r=>{if(r.resourceType()==='image'&&r.url().includes('/posters/'))images.push(r.url());});
   await cp.route('**/assets/vendor/guide-ui.js',async r=>{await new Promise(resolve=>setTimeout(resolve,250));await r.continue();});
   await cp.goto(base);await cp.locator('.poster-art').first().evaluate(e=>e.decode());
   assert((await cp.locator('script[src*="poster-versions.js"]').getAttribute('src')).includes('?v='),'poster version map must also invalidate its cache');
   const source=await cp.locator('.poster-art').first().evaluate(e=>e.currentSrc);assert(source.includes('?v='));assert.equal(images.filter(url=>url===source).length,1,'initial poster fetched twice');
   await cp.locator('.poster-link').first().dispatchEvent('click');
   assert.equal(cp.url(),base+'quests/','poster click must change the URL immediately');
   assert.equal(await cp.locator('.poster-link').first().evaluate(e=>e.getAnimations().length),0,'poster click must not start a zoom animation');
   await cp.waitForURL(base+'quests/');await cp.locator('[data-overview=quests]').waitFor();
   await cp.locator('.poster-link[href="quests/standalone/"]').tap();await cp.waitForURL(base+'quests/standalone/');await cp.locator('.catalog-link').first().waitFor();
   await cold.close();
   const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto(base);await rp.locator('.poster-link').first().click();await rp.waitForURL(base+'quests/');assert.equal(await rp.locator('.poster-link').first().evaluate(e=>e.getAnimations().length),0);await reduced.close();
   console.log('PASS fixed header, left search animation, viewport results, centered dropdowns, deep-link reloads, immediate uncached posters and reduced motion at',prefix);
  }
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
