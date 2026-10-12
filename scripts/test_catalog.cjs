const {fill,select,value}=require('./test_controls.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const site=path.resolve(__dirname,'../dist'),P=require('../js/presentation.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(site,'assets/data',name+'.json'),'utf8'));
const datasets={equipment:read('equipment'),skills:read('skills'),consumables:read('consumables')};
const {equipment,skills,consumables}=datasets;
const rarity=['常见','卓越','大师','史诗','传说','任务'];
const order=['大剑','长剑','短剑','类刀剑锐器','重型','中型','轻型',''];
const itemOrder=(a,b)=>order.indexOf(a.weaponType||a.armorType||'')-order.indexOf(b.weaponType||b.armorType||'')||a.cn.localeCompare(b.cn,'zh-CN')||a.id.localeCompare(b.id);
const consumableOrder=(a,b)=>a.craftable?a.craftingOrder-b.craftingOrder:a.cn.localeCompare(b.cn,'zh-CN')||rarity.indexOf(a.quality)-rarity.indexOf(b.quality)||a.id.localeCompare(b.id);
for(const [kind,d] of Object.entries(datasets)){
 assert.equal(d.schemaVersion,3);assert.equal(d.items.length,{equipment:542,skills:90,consumables:102}[kind]);assert.equal(new Set(d.items.map(i=>i.id)).size,d.items.length);
 for(const item of d.items){
  const html=fs.readFileSync(path.join(site,kind,item.id,'index.html'),'utf8');
  assert(html.includes('data-item="'+item.id+'"'));assert(html.includes(P.esc(item.cn)));assert(html.includes('<base href="../../">'));
  assert(html.includes('https://rainbowcoke.github.io/dawnwalker-guide/'+kind+'/'+item.id+'/'));
  assert(html.includes('<title>'+P.esc(item.cn)));assert(/<meta name="description" content="[^"]+">/.test(html));
  for(const word of ['研究注释','开发记录','资料来源','核对日志','.local/','C:\\Users','reader-config','sourcePath','LearningPrerequisite'])assert(!html.includes(word),word+' leaked in '+item.id);
  assert.equal((html.match(/class="inspection-card/g)||[]).length,1);
  if(kind==='skills')for(const r of item.ranks)assert(html.includes('本级 '+r.pointCost+' 技能点，学习 '+r.learningTime+' 个时间段'));
  for(const a of item.acquisition||[])assert(html.includes(P.esc(a.text)));
  for(const m of item.manuals||[])assert(html.includes(P.esc(m.cn)));
 }
}
assert.equal((fs.readFileSync(path.join(site,'sitemap.xml'),'utf8').match(/<url>/g)||[]).length,756);
assert.equal(consumables.items.filter(i=>i.craftable).length,44);
for(const [index,g] of P.craftCategories.entries()){
 const rows=consumables.items.filter(i=>i.craftingCategory===g).sort(consumableOrder);assert.equal(rows.length,[12,6,10,7,9][index]);assert.deepEqual(rows.map(i=>i.craftingOrder),rows.map((_,i)=>i));
}
const mihai=equipment.items.find(i=>i.id==='eq-sworddawnwalker5a');assert(mihai.levels[39].effects.some(e=>e.includes('19.5%')));assert(mihai.levels[39].effects.some(e=>e.includes('20.8%')));
const invigorate=skills.items.find(i=>i.cn==='振奋精神');assert(invigorate);assert.deepEqual(invigorate.ranks.map(r=>r.pointCost),[1,1,2]);for(const [i,n] of [15,30,50].entries())assert(invigorate.ranks[i].effects.some(e=>e.includes(n+'%')));
console.log('PASS all static HTML, metadata, sitemap, count, privacy and decimal/rank regressions');
(async()=>{
 const {serve}=require('./server.cjs'),server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.GUIDE_BROWSER?{channel:process.env.GUIDE_BROWSER}:{})});
  for(const prefix of ['/','/dawnwalker-guide/']){
   const base=server.base(prefix),context=await browser.newContext({viewport:{width:1401,height:1260}}),page=await context.newPage(),errors=[],remote=[];
   page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin)remote.push(r.url());});
   const open=async id=>{await page.locator(`[data-id="${id}"]`).click();await page.waitForFunction(id=>document.querySelector('#item-dialog').open&&document.querySelector('.inspection-card')?.dataset.item===id,id);};
   const close=async()=>{await page.locator('#close-item').click();await page.waitForFunction(()=>!document.querySelector('#item-dialog').open);};
   const N=require('../js/navigation.js');
   for(const p of N.pages.filter(p=>p.section==='equipment')){
    await page.goto(base+p.path);await page.locator('.item-card').first().waitFor();
    for(const tier of await page.locator('.rarity-tier').all()){const ids=await tier.locator('.item-card').evaluateAll(es=>es.map(e=>e.dataset.id));assert.deepEqual(ids,ids.map(id=>equipment.items.find(i=>i.id===id)).sort(itemOrder).map(i=>i.id));}
   }
   await page.goto(base+'equipment/weapons/');await select(page.locator('#weapon-type'),'长剑');await select(page.locator('#quality'),'史诗');assert.equal(await page.locator('.item-card').count(),equipment.items.filter(i=>i.slot==='武器'&&i.weaponType==='长剑'&&i.quality==='史诗').length);await page.locator('#reset').click();
   const sword=equipment.items.find(i=>i.levels[0].damage&&i.acquisition.some(a=>a.questId));await fill(page.locator('#search'),sword.en);await open(sword.id);await select(page.locator('#card-level'),'27');assert((await page.locator('.equipment-stats').innerText()).includes(sword.levels[26].damage.join('—')));assert.equal(await value(page.locator('#level')),'27');
   await page.locator('details[data-disclosure=acquisition]>summary').click();assert((await page.locator('.acquisition-list').innerText()).includes(sword.acquisition[0].text));await close();assert.equal(await value(page.locator('#search')),sword.en);assert.equal(await value(page.locator('#level')),'27');
   await page.goForward();await page.waitForFunction(()=>document.querySelector('#item-dialog').open);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#item-dialog').open);await page.waitForFunction(id=>document.activeElement?.dataset.id===id,sword.id);
   await page.goto(base+'skills/swordsmanship/');await page.locator('.skill-node').first().waitFor();const swordItems=skills.items.filter(i=>i.tree==='剑术');
   assert.deepEqual(await page.locator('.tree-edges path').evaluateAll(es=>es.map(e=>[e.dataset.parent,e.dataset.child]).sort()),swordItems.flatMap(i=>i.prerequisites.map(p=>[p.id,i.id])).sort());
   const root=skills.items.find(i=>i.id==='skill-shared_omniblock'),child=skills.items.find(i=>i.prerequisites.some(p=>p.id===root.id));const plus=id=>page.locator(`[data-node="${id}"] [data-change="1"]`),minus=id=>page.locator(`[data-node="${id}"] [data-change="-1"]`);
   assert(await plus(child.id).evaluate(e=>e.disabled));await plus(root.id).click();await plus(child.id).click();await minus(root.id).click();assert.equal(await page.locator('.point-total strong').innerText(),'0');assert((await page.locator('#allocation-notice').innerText()).includes(child.cn));await page.locator('#undo-points').click();assert.equal(await page.locator('.point-total strong').innerText(),String(root.ranks[0].pointCost+child.ranks[0].pointCost));
   const view=await page.locator('.tree-canvas').getAttribute('style');await open(root.id);await page.locator('#dialog-content [data-change="1"]').click();assert((await page.locator('.preview-label').innerText()).includes('2 级'));await close();assert.equal(await page.locator(`[data-node="${root.id}"] .rank-diamonds`).getAttribute('aria-label'),'2 / 4 级');assert.equal(await page.locator('.tree-canvas').getAttribute('style'),view);
   await open(child.id);const historyLength=await page.evaluate(()=>history.length);await page.locator('.card-related a').first().click();await page.waitForFunction(()=>document.querySelector('.inspection-card').dataset.item==='skill-shared_omniblock');assert.equal(await page.evaluate(()=>history.length),historyLength);await close();await page.locator('#clear-points').click();await page.locator('#undo-points').click();assert.notEqual(await page.locator('.point-total strong').innerText(),'0');await page.locator('#clear-points').click();
   await page.goto(base+'skills/witchcraft/');const boil=skills.items.find(i=>i.id==='skill-combatfocus_boilingblood');await fill(page.locator('#search'),boil.en);await page.locator(`[data-locate="${boil.id}"]`).click();await open(boil.id);await select(page.locator('#skill-level'),'1');assert((await page.locator('.skill-rank').first().innerText()).includes(boil.ranks[0].levelEffects[0].effects[0]));
   for(let k=0;k<12;k++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('wa-dialog')),'Focus escaped item dialog');}await page.mouse.click(8,100);await page.waitForFunction(()=>!document.querySelector('#item-dialog').open);assert.equal(await value(page.locator('#character-level')),'1');
   for(const slug of ['craftable','non-craftable']){
    await page.goto(base+'consumables/'+slug+'/');await page.locator('.item-card').first().waitFor();const rows=consumables.items.filter(i=>i.craftable===(slug==='craftable'));
    for(const g of await page.locator('.reference-group').all()){const ids=await g.locator('.item-card').evaluateAll(es=>es.map(e=>e.dataset.id));assert.deepEqual(ids,ids.map(id=>consumables.items.find(i=>i.id===id)).sort(consumableOrder).map(i=>i.id));}
    for(const phase of ['anytime','day','night']){await select(page.locator('#use-phase'),phase);assert.equal(await page.locator('.item-card').count(),rows.filter(i=>i.usePhase===phase).length);}await page.locator('#reset').click();
   }
   await page.goto(base+'consumables/craftable/');const potion=consumables.items.find(i=>i.recipes.length);await open(potion.id);for(const m of potion.recipes[0].materials)assert((await page.locator('.recipe').first().innerText()).includes(m.cn));await close();
   for(const [kind,d] of Object.entries(datasets))for(const item of d.items){await page.evaluate(href=>{const link=document.createElement('a');link.href=href;document.body.append(link);link.click();link.remove();},kind+'/'+item.id+'/');await page.waitForFunction(id=>document.querySelector('.inspection-card')?.dataset.item===id&&document.querySelector('#item-dialog').open,item.id);assert(page.url().endsWith('/'+kind+'/'+item.id+'/'));assert.equal(await page.locator('.inspection-card').count(),1);}
   await close();await page.goto(base+'equipment/'+sword.id+'/');await page.waitForFunction(()=>document.querySelector('#item-dialog').open);await page.reload();await page.waitForFunction(()=>document.querySelector('#item-dialog').open);await close();assert(page.url().endsWith('/equipment/weapons/'));assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);await context.close();
   const nojs=await browser.newContext({javaScriptEnabled:false}),np=await nojs.newPage();for(const [kind,d] of Object.entries(datasets)){const item=d.items.find(i=>i.manuals?.length||i.recipes?.length||i.acquisition?.length);await np.goto(base+kind+'/'+item.id+'/');assert(await np.locator('.inspection-card').isVisible());const detail=np.locator('details').first();if(await detail.count()){await detail.locator('summary').click();assert(await detail.evaluate(e=>e.open));}assert.equal(await np.locator('.rank-change').first().isVisible().catch(()=>false),false);}await nojs.close();
   for(const width of [390,768]){
    const mobile=await browser.newContext({viewport:{width,height:844},hasTouch:true}),p=await mobile.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'equipment/upper-body/');await p.locator('.item-card').first().waitFor();await select(p.locator('#armor-type'),'重型');const link=p.locator('.item-card').nth(10);await link.scrollIntoViewIfNeeded();const y=await p.evaluate(()=>scrollY);await link.click();await p.waitForFunction(()=>document.querySelector('#item-dialog').open);const rect=await p.locator('#item-dialog').locator('dialog').boundingBox();assert(rect.width<=width&&rect.height<=844);await p.locator('#close-item').click();await p.waitForFunction(()=>!document.querySelector('#item-dialog').open);await p.waitForFunction(y=>Math.abs(scrollY-y)<4,y);assert.equal(await value(p.locator('#armor-type')),'重型');
    await p.locator('[data-section=skills]').tap();await p.locator('.poster-link[href="skills/witchcraft/"]').click();const viewport=p.locator('.tree-viewport');await viewport.waitFor();await viewport.scrollIntoViewIfNeeded();await p.waitForTimeout(80);const box=await viewport.boundingBox(),cdp=await mobile.newCDPSession(p),x=box.x+box.width*.7,ty=box.y+box.height-6,before=await viewport.locator('.tree-canvas').getAttribute('style');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-80,y:ty}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(before=>document.querySelector('.tree-canvas').getAttribute('style')!==before,before);
    const zoom=await p.locator('[data-zoom-label]').innerText(),cx=box.x+box.width/2;
    const pinchY=await p.evaluate(({box,cx})=>{for(let y=Math.max(12,box.y+12);y<Math.min(innerHeight-12,box.y+box.height-12);y+=20){if([cx-35,cx+35].every(x=>{const el=document.elementFromPoint(x,y);return el?.closest('.tree-viewport')&&!el.closest('.panzoom-exclude');}))return y;}throw Error('No blank area for pinch');},{box,cx});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-35,y:pinchY},{x:cx+35,y:pinchY}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:pinchY},{x:cx+65,y:pinchY}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(zoom=>document.querySelector('[data-zoom-label]').textContent!==zoom,zoom);await cdp.detach();await p.locator('[data-zoom=fit]').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.close();
   }
   const retry=await browser.newContext(),rp=await retry.newPage();let failed=false;await rp.route('**/equipment.json',async r=>{if(!failed){failed=true;await r.fulfill({status:503,body:'unavailable'});}else await r.continue();});await rp.goto(base+'equipment/');await rp.locator('#retry-reference').click();await rp.locator('.poster-link').first().waitFor();assert.equal(await rp.locator('.poster-link').count(),7);await rp.locator('.poster-link[href="equipment/weapons/"]').click();await rp.locator('.item-card').first().waitFor();
   await rp.route('**/skills.json',async r=>{await new Promise(resolve=>setTimeout(resolve,200));await r.continue();});await rp.locator('[data-section=skills]').hover();await rp.locator('[data-page="skills/witchcraft/"]').click();await rp.locator('[data-section=consumables]').hover();await rp.locator('[data-page="consumables/craftable/"]').click();await rp.waitForFunction(()=>document.querySelectorAll('.item-card').length===44);await rp.waitForTimeout(250);assert.equal(await rp.locator('.item-card').count(),44);await rp.route('**/catalog/consumables/**',r=>r.fulfill({status:404,body:''}));await rp.locator('.item-card').first().click();await rp.waitForFunction(()=>document.querySelector('#item-dialog').open);assert(await rp.locator('#reading-title').isVisible());await retry.close();assert.deepEqual(errors,[]);
   console.log('PASS sorting, combined filters, all 734 modals, planner, focus, history, no-JS, touch and retry at',prefix);
  }
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
