/* Cold route replacement and planner updates must not shift the existing UI. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {serve}=require('./server.cjs');
(async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.GUIDE_BROWSER?{channel:process.env.GUIDE_BROWSER}:{})});
  for(const prefix of ['/','/dawnwalker-guide/']){
   for(const width of [390,1320]){
    const context=await browser.newContext({viewport:{width,height:1260},hasTouch:width===390}),page=await context.newPage(),base=server.base(prefix),cdp=await context.newCDPSession(page),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    let release,requested;const gate=new Promise(resolve=>release=resolve),started=new Promise(resolve=>requested=resolve);
    await page.route('**/assets/data/skills.json',async route=>{requested();await gate;await route.continue();});
    await page.goto(base);await page.locator('.poster-art').first().evaluate(image=>image.decode());
    const source=()=>page.evaluate(()=>({body:document.body.className,poster:document.querySelector('.poster-link').getBoundingClientRect().toJSON(),reader:document.querySelector('#reader').getBoundingClientRect().toJSON()}));
    const before=await source();
    await page.evaluate(()=>{
     window.routeFrames=[];
     const sample=()=>{const home=!!document.querySelector('.home-overview'),target=!!document.querySelector('[data-overview="skills"]');window.routeFrames.push({home,target,body:document.body.className});if(!target)requestAnimationFrame(sample);};requestAnimationFrame(sample);
    });
    await page.locator('.poster-link[href="skills/"]').dispatchEvent('click');assert.equal(page.url(),base+'skills/');await started;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.deepEqual(await source(),before,'pending route changed the old page layout');
    release();await page.locator('[data-overview="skills"]').waitFor();
    await page.waitForFunction(()=>window.routeFrames.some(frame=>frame.target));
    const frames=await page.evaluate(()=>window.routeFrames);assert(frames.every(frame=>frame.target?!frame.home:frame.home&&frame.body==='home'),'source and target did not swap together');
    await page.locator('.poster-link[href="skills/witchcraft/"]').click();await page.locator('.tree-viewport').waitFor();
    await page.waitForFunction(()=>document.querySelector('.tree-canvas').style.transform.includes('scale'));
    await page.evaluate(()=>{window.originalSummary=document.querySelector('#planner-summary');window.originalNotice=document.querySelector('#allocation-notice');});
    const geometry=()=>page.evaluate(()=>({height:document.querySelector('#planner-summary').getBoundingClientRect().height,treeTop:document.querySelector('.tree-viewport').getBoundingClientRect().top+scrollY,transform:document.querySelector('.tree-canvas').style.transform}));
    const original=await geometry(),id='skill-human_toughskin';
    const action=async selector=>{await page.locator(selector).click();assert.deepEqual(await geometry(),original,'planner action shifted the tree');assert(await page.evaluate(()=>window.originalSummary===document.querySelector('#planner-summary')&&window.originalNotice===document.querySelector('#allocation-notice')),'planner status nodes were replaced');};
    await action(`[data-node="${id}"] [data-change="1"]`);assert((await page.locator('#allocation-notice').innerText()).includes('已增加'));
    await action(`[data-node="${id}"] [data-change="-1"]`);assert((await page.locator('#allocation-notice').innerText()).includes('退还'));
    await action('#undo-points');await action('#clear-points');await action('#undo-points');
    assert.deepEqual(errors,[]);await context.close();
    console.log('PASS atomic cold route replacement, stable planner geometry and retained status nodes at',prefix,width);
   }
  }
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
