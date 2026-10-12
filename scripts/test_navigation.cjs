/* Browser navigation, category posters, component controls and layout acceptance. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {serve,site}=require('./server.cjs'),{fill,select,value}=require('./test_controls.cjs');
const N=require('../js/navigation.js'),P=require('../js/presentation.js'),L=require('../js/tree-layout.js'),O=require('../js/overview.js');
const datasets=Object.fromEntries(['equipment','skills','consumables'].map(s=>[s,JSON.parse(fs.readFileSync(path.join(site,'assets/data',s+'.json'),'utf8'))]));
const sandbox={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.join(site,'assets/guide-data.js'),'utf8'),sandbox);const guide=JSON.parse(JSON.stringify(sandbox.window.DawnwalkerData));
assert.equal(N.pages.length,17);assert.equal(O.posterFiles.length,34);
for(const file of O.posterFiles)assert(fs.existsSync(path.join(site,file)),file);
for(const tree of P.trees){
 const items=datasets.skills.items.filter(i=>i.tree===tree),layout=L.compactTree(items,datasets.skills.treeCanvases[tree]);
 for(const a of items){const ac=layout.coordinates.get(a.id);assert(ac.x-70>=24&&ac.y-88>=24);
  for(const b of items){if(a===b)continue;const bc=layout.coordinates.get(b.id);assert(Math.abs(ac.x-bc.x)>=140-1e-6||Math.abs(ac.y-bc.y)>=176-1e-6);
   if(a.layout.canvasY===b.layout.canvasY){assert.equal(ac.y,bc.y);assert(Math.abs(ac.x-bc.x)>=148-1e-6);}
   if(a.layout.kind!=='ability'&&b.layout.kind!=='ability')assert(Math.abs((ac.x-bc.x)-((layout.offsets.get(a.id)||0)-(layout.offsets.get(b.id)||0))-(a.layout.canvasX-b.layout.canvasX)*layout.scaleX)<1e-6);
  }
  for(const pre of a.prerequisites){const route=L.routeEdge(layout,pre.id,a.id);assert(route.length>=2);for(let k=1;k<route.length;k++)for(const rect of layout.bounds)assert(!L.crosses(route[k-1],route[k],rect),`${tree}: edge crosses ${rect.id}`);}
 }
 const baseline={巫术:1342,剑术:1852,血族:1784}[tree];if(tree!=='巫术')assert(layout.width<=baseline*.95);else{assert.equal(layout.width,1328);assert.equal(layout.offsets.get('skill-human_fountainofyouth'),148);for(const i of items.filter(i=>i.layout.kind==='ability'))assert.equal(layout.offsets.get(i.id),148);const branches=items.filter(i=>i.prerequisites.some(p=>p.id==='skill-human_bloodcost')).map(i=>L.routeEdge(layout,'skill-human_bloodcost',i.id));assert.equal(branches.length,2);assert.deepEqual(branches[0].slice(0,2),branches[1].slice(0,2));for(const route of branches)assert.equal(route[1].y,route.at(-1).y-16);}
 assert.equal(new Set(items.filter(i=>i.layout.kind==='ability').map(i=>layout.coordinates.get(i.id).x)).size,2);
 if(tree==='血族'){
  const parent='skill-vampire_blooddrinking',children=['skill-vampire_drinkinghumanblood','skill-vampire_drinkinganimalblood','skill-vampire_vrakhirmutation'];
  const root=layout.coordinates.get(parent),positions=children.map(id=>layout.coordinates.get(id)),routes=children.map(id=>L.routeEdge(layout,parent,id));
  assert.equal(positions[0].x,root.x-148);assert.equal(positions[1].x,root.x);assert.equal(positions[2].x,root.x+148);
  assert.equal(positions[0].y,positions[1].y);assert.equal(positions[2].y-positions[1].y,240);
  assert.equal(items.find(i=>i.id===children[2]).row,2);
  for(const id of children)assert.deepEqual(items.find(i=>i.id===id).prerequisites.map(p=>p.id),[parent]);
  assert.equal(routes[0].length,4);assert.equal(routes[1].length,2);assert.equal(routes[2].length,4);
  assert.deepEqual(routes[0].slice(0,2),routes[2].slice(0,2));assert.equal(routes[2][2].x,positions[2].x);
 }
}
console.log('PASS posters, compact relative coordinates, all node bounds and all edge clearances');
(async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.GUIDE_BROWSER?{channel:process.env.GUIDE_BROWSER}:{})});
  for(const prefix of ['/','/dawnwalker-guide/']){
   const base=server.base(prefix),context=await browser.newContext({viewport:{width:1401,height:1260}}),page=await context.newPage(),errors=[],remote=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin)remote.push(r.url());});
   for(const [section,total] of Object.entries({quests:5,equipment:7,skills:3,consumables:2})){
    await page.goto(base+section+'/');await page.locator('[data-overview]').waitFor();assert.equal(await page.locator('.poster-link').count(),total);assert.equal(await page.locator('.item-card,.skill-node,.catalog-link').count(),0);assert.equal(await page.locator('#directory-tools').isVisible(),false);
    assert.deepEqual(await page.locator('.poster-link').evaluateAll(es=>es.map(e=>e.getAttribute('href'))),N.pages.filter(p=>p.section===section).map(p=>p.path));
    assert(await page.locator('.poster-art').evaluateAll(async es=>(await Promise.all(es.map(async e=>{e.loading='eager';try{await e.decode();return e.naturalWidth>0;}catch{return false;}}))).every(Boolean))); 
   }
   for(const p of N.pages){await page.goto(base+p.path);await page.locator('#search').waitFor();const expected=p.section==='quests'?guide.entries.filter(i=>N.matches(p,i)).length:datasets[p.section].items.filter(i=>N.matches(p,i)).length;
    assert.equal(await page.locator(p.section==='quests'?'.catalog-link':p.section==='skills'?'.skill-node':'.item-card').count(),expected,p.path);
    assert(await page.locator('#directory-tools wa-input,#directory-tools wa-select').evaluateAll(es=>es.filter(e=>e.checkVisibility()).every(e=>Math.abs(e.getBoundingClientRect().height-42)<1)),p.path+' control height');assert.equal(await page.locator('#directory-tools').evaluate(e=>e.querySelectorAll('label').length),0);if(p.section==='equipment')assert(await page.locator('#equipment-level').evaluate(e=>e.previousElementSibling.matches('.search-field')));assert.equal(await page.locator('[data-page="'+p.path+'"]').getAttribute('aria-current'),'page');
    if(p.section==='quests')assert(await page.locator('.task-list-card').evaluateAll(es=>es.every(e=>Math.abs(e.querySelector('.avatar,.index-mark').getBoundingClientRect().height-e.querySelector('.catalog-copy').getBoundingClientRect().height)<1)),p.path+' full-height avatar');
    if(p.section==='skills'){assert.equal(await page.locator('.skill-icon-frame.diamond,.skill-reason').count(),0);assert(await page.locator('.skill-node').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('.skill-icon-frame,.point-controls,strong')].every(c=>c.getBoundingClientRect().bottom<=r.bottom+1);})));}
   }
   const dropdown=page.locator('.nav-group:has([data-section=equipment]) wa-dropdown'),trigger=dropdown.locator('.nav-label');
   await page.locator('[data-section=equipment]').hover();assert(await dropdown.evaluate(e=>e.open));await page.keyboard.press('Escape');await page.mouse.move(5,180);
   await trigger.focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('.nav-group:has([data-section=equipment]) wa-dropdown').open);await page.waitForFunction(()=>document.activeElement.localName==='wa-dropdown-item'&&document.activeElement.getAttribute('href')==='equipment/weapons/');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForURL('**/equipment/upper-body/');
   await page.locator('[data-section=equipment]').click();await page.waitForURL('**/equipment/');await page.locator('.poster-link').first().waitFor();assert.equal(await page.locator('.poster-link').count(),7);
   await page.locator('.poster-link[href="equipment/weapons/"]').click();await select(page.locator('#weapon-type'),'长剑');await select(page.locator('#quality'),'史诗');await select(page.locator('#level'),'27');
   await page.locator('[data-section=equipment]').hover();await page.locator('[data-page="equipment/rings/"]').click();assert.equal(await value(page.locator('#quality')),'');assert.equal(await value(page.locator('#level')),'27');
   await page.locator('[data-section=equipment]').hover();await page.locator('[data-page="equipment/weapons/"]').click();assert.equal(await value(page.locator('#quality')),'史诗');assert.equal(await value(page.locator('#weapon-type')),'长剑');await page.locator('#reset').click();assert.equal(await value(page.locator('#level')),'27');
   await page.locator('#global-search-toggle').click();assert(await page.locator('#global-search-controls').isVisible());assert.equal(await page.locator('#global-search-dialog,#global-search-panel').count(),0);assert.equal(await page.locator('#global-search-results-popup').isVisible(),false);assert.equal(await page.locator('wa-dialog[open]').count(),0);await fill(page.locator('#global-search-input'),'Home Sweet Home');await page.locator('.search-result').first().waitFor();assert.equal(await page.locator('.search-result').count(),1);await page.locator('.search-result').click();await page.locator('#reading-title').getByText('甜蜜之家').waitFor();assert.equal(await page.locator('.story p').count(),0);
   await page.locator('#global-search-toggle').click();await fill(page.locator('#global-search-input'),'blood');await page.waitForFunction(()=>document.querySelectorAll('.search-result').length>10);const before=await page.locator('.search-result').count();await page.locator('[data-more]').first().click();assert(await page.locator('.search-result').count()>before);await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement.id==='global-search-toggle');
   await page.goto(base+'skills/swordsmanship/');const id='skill-shared_omniblock';await page.locator(`[data-node="${id}"] [data-change="1"]`).click();await select(page.locator('#character-level'),'37');const total=await page.locator('.point-total strong').innerText();const transform=await page.locator('.tree-canvas').getAttribute('style');
   await page.locator('[data-section=skills]').click();assert.equal(await page.locator('.poster-link').count(),3);await page.locator('.poster-link[href="skills/witchcraft/"]').click();assert.equal(await page.locator('.point-total strong').innerText(),total);assert.equal(await value(page.locator('#character-level')),'37');
   await page.locator('[data-section=skills]').click();await page.locator('.poster-link[href="skills/swordsmanship/"]').click();assert.equal(await page.locator('.tree-canvas').getAttribute('style'),transform);assert.equal(await page.locator(`[data-node="${id}"] .rank-diamonds`).getAttribute('aria-label'),'1 / 4 级');await page.locator('#undo-points').click();assert.equal(await page.locator('.point-total strong').innerText(),'0');
   for(const width of [1401,1024,768,390,320]){
    await page.setViewportSize({width,height:1260});for(const route of ['',...Object.keys(N.labels).map(s=>s+'/'),'equipment/weapons/','skills/witchcraft/']){
     await page.goto(base+route);await page.locator(route.endsWith('weapons/')||route.endsWith('witchcraft/')?'#search':'.poster-link').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' overflow at '+route);
     if(route==='quests/'){const columns=width>=1200?4:width>=900?3:width>=600?2:1;assert.equal(await page.locator('.poster-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),columns);}
    }
   }
   await page.goto(base);assert.equal(await page.locator('.brand-copy').innerText(),'THE BLOOD OF DAWNWALKER\n《黎明行者之血》指南');assert.equal(await page.locator('.welcome .eyebrow,.welcome h1,.welcome .intro,.welcome-hint').count(),0);assert.equal(await page.locator('.home-overview .ornament').count(),0);assert.equal(await page.locator('.site-footer').count(),0);
   assert.equal(await page.locator('.nav-trigger').count(),0);
   let tabOpened=context.waitForEvent('page');await page.locator('[data-section=equipment]').click({modifiers:['Control']});let linkedTab=await tabOpened;await linkedTab.waitForLoadState();assert(linkedTab.url().endsWith('/equipment/'));await linkedTab.close();assert.equal(page.url(),base);
   await page.mouse.move(5,180);await page.locator('[data-section=equipment]').hover();tabOpened=context.waitForEvent('page');await page.locator('[data-page="equipment/weapons/"]').click({modifiers:['Control']});linkedTab=await tabOpened;await linkedTab.waitForLoadState();assert(linkedTab.url().endsWith('/equipment/weapons/'));await linkedTab.close();assert.equal(page.url(),base);
   await page.mouse.move(5,180);await page.locator('[data-section=skills]').hover();tabOpened=context.waitForEvent('page');await page.locator('[data-page="skills/witchcraft/"]').click({button:'middle'});linkedTab=await tabOpened;await linkedTab.waitForLoadState();assert(linkedTab.url().endsWith('/skills/witchcraft/'));await linkedTab.close();assert.equal(page.url(),base);
   const colors=await page.locator('.home-overview .poster-link').evaluateAll(es=>es.map(e=>['h2','.poster-kicker','.poster-enter'].map(selector=>getComputedStyle(e.querySelector(selector)).color)));for(const row of colors)assert.deepEqual(row,colors[0]);
   const centered=await page.locator('.repo-link').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.querySelector('svg').getBoundingClientRect();return Math.abs(a.x+a.width/2-b.x-b.width/2)<1&&Math.abs(a.y+a.height/2-b.y-b.height/2)<1;});assert(centered);
   assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);await context.close();
   const nojs=await browser.newContext({javaScriptEnabled:false}),np=await nojs.newPage();
   for(const [section,total] of Object.entries({quests:5,equipment:7,skills:3,consumables:2})){await np.goto(base+section+'/');assert.equal(await np.locator('.poster-link').count(),total);assert(await np.locator('.poster-link').first().isVisible());}
   for(const p of N.pages){await np.goto(base+p.path);const expected=p.section==='quests'?guide.entries.filter(i=>N.matches(p,i)).length:datasets[p.section].items.filter(i=>N.matches(p,i)).length;assert.equal(await np.locator(p.section==='quests'?'.catalog-link':p.section==='skills'?'.skill-node':'.item-card').count(),expected);}
   await np.locator('[data-section=equipment]').hover();await np.locator('.nav-fallback a[href="equipment/weapons/"]').click();assert(np.url().endsWith('/equipment/weapons/'));await nojs.close();
   const retry=await browser.newContext(),rp=await retry.newPage();let failed=false;await rp.route('**/search-index.json',async r=>{if(!failed){failed=true;await r.fulfill({status:503,body:'unavailable'});}else await r.continue();});await rp.goto(base);await rp.locator('#global-search-toggle').click();await fill(rp.locator('#global-search-input'),'Home Sweet Home');await rp.locator('#retry-search').click();await rp.locator('.search-result').waitFor();await retry.close();
   console.log('PASS overviews, 17 subcategories, native components, navigation, search, state, no-JS and five viewports at',prefix);
  }
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
