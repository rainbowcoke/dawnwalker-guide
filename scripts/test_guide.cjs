const {fill,value}=require('./test_controls.cjs');
/* Task reader HTTP integration tests. Run with Playwright on NODE_PATH. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {createHash}=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const {serve}=require('./server.cjs');
const os=require('node:os');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'dawnwalker-qa-'));
console.log('QA output:',output);
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const archiveHashes=()=>Object.fromEntries(fs.readdirSync(path.join(root,'data')).filter(n=>fs.statSync(path.join(root,'data',n)).isFile()).sort().map(name=>[name,hash(path.join(root,'data',name))]));
const before=archiveHashes();
assert(Object.keys(before).includes('guide-source.json'));
const python=process.env.GUIDE_PYTHON||'python';
const build=()=>execFileSync(python,[path.join(root,'scripts/build_guide.py')],{stdio:'pipe'});
build();const builtHash=hash(path.join(root,'assets/guide-data.js'));build();
assert.equal(hash(path.join(root,'assets/guide-data.js')),builtHash,'Build is not deterministic');
assert.deepEqual(archiveHashes(),before,'Build changed source archives');
// Invalid source data and missing resources must preserve the last good output.
const fixture=path.join(output,'build-fixture');
fs.mkdirSync(path.join(fixture,'scripts'),{recursive:true});
fs.copyFileSync(path.join(root,'scripts/build_guide.py'),path.join(fixture,'scripts/build_guide.py'));
for(const dir of ['data','assets'])fs.cpSync(path.join(root,dir),path.join(fixture,dir),{recursive:true});
const fixtureData=path.join(fixture,'data/guide-source.json');
const original=fs.readFileSync(fixtureData);
const invalid=JSON.parse(original);invalid.quests.push(invalid.quests[0]);fs.writeFileSync(fixtureData,JSON.stringify(invalid));
const failedBuild=()=>{
 const result=spawnSync(python,[path.join(fixture,'scripts/build_guide.py')],{encoding:'utf8'});
 assert.ifError(result.error);assert.notEqual(result.status,0);
 assert.equal(hash(path.join(fixture,'assets/guide-data.js')),builtHash,'Failed build replaced output');
 assert(!fs.readdirSync(path.join(fixture,'assets')).some(n=>n.endsWith('.tmp')));
};
failedBuild();fs.writeFileSync(fixtureData,original);
const read=n=>JSON.parse(fs.readFileSync(path.join(root,n),'utf8').replace(/^\uFEFF/,''));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'assets/guide-data.js'),'utf8'),sandbox);
const data=JSON.parse(JSON.stringify(sandbox.window.DawnwalkerData));
const source=read('data/guide-source.json'),raw=source.quests,nav=source.navigation;
const publicText=html+JSON.stringify(data)+fs.readdirSync(path.join(root,'js')).map(n=>fs.readFileSync(path.join(root,'js',n),'utf8')).join('');
assert(!html.includes('<style>')&&!html.includes('__GUIDE_DATA__'));
assert.equal(source.schemaVersion,1);assert.deepEqual(Object.keys(source),['schemaVersion','quests','navigation','npcs']);
const passed=[];const ok=n=>{passed.push(n);console.log('PASS',n);};
assert.equal(raw.length,205);assert.equal(data.quests.length+nav.archiveOnly.length+nav.entries.flatMap(e=>e.sections.flatMap(s=>s.summaryIds||[])).length,raw.length);
assert.equal(new Set(data.quests.map(q=>q.id)).size,data.quests.length);
assert.equal(data.entries.filter(e=>e.category==='宫廷活动').length,3);

assert.equal(data.quests.length,193);
assert(data.quests.every(q=>/^q-[a-z]+(?:-[0-9]+)?$/.test(q.id)));
assert(raw.every(q=>!Object.hasOwn(q,'legacyNames')));
assert(data.quests.every(q=>!Object.hasOwn(q,'legacyNames')));
assert(data.relations.every(r=>!Object.hasOwn(r,'label')));
assert(!Object.hasOwn(data,'aliases'));
assert(data.quests.some(q=>q.id==='q-apfp'));assert(data.quests.some(q=>q.id==='q-fa'));
assert.deepEqual(data.quests.find(q=>q.id==='q-bpff').entryIds,['vasil','court-bakir']);
for(const q of data.quests){assert(q.sections.length);assert(q.entryIds.every(id=>data.entries.some(e=>e.id===id)));}
for(const e of data.entries){for(const s of e.sections)assert(s.questIds.every(id=>data.quests.some(q=>q.id===id)));}
for(const word of ['localStorage','sessionStorage','dwq:','导入进度','导出进度','任务线等级','已勾选','内容依据','收录口径','patch2','CL-258504','source-note','dialogueNamespaces','sha256','"tier"','"scores"','"gameId"','本页收录条目'])assert(!publicText.includes(word),word);
for(const npc of Object.values(data.npcs))if(npc.img)assert(fs.existsSync(path.join(root,npc.img)));
const portraits=[...new Set(Object.values(data.npcs).map(n=>n.img).filter(Boolean))].sort();
assert.equal(portraits.length,20);
const walk=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
assert.deepEqual(walk('assets/npcs').sort(),portraits,'Unused or missing portraits');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^[a-z]+:/i.test(match[1]))assert(fs.existsSync(path.join(root,match[1]))||fs.existsSync(path.join(root,'dist',match[1],'index.html')),`Missing ${match[1]}`);
const catalogImages=[...new Set(['equipment','skills','consumables'].flatMap(kind=>{const d=read('data/catalog/'+kind+'.json');return [...Object.values(d.uiIcons),...d.items.flatMap(i=>[i.icon,i.illustration,...(i.recipes||[]).flatMap(r=>r.materials.map(m=>m.icon))].filter(Boolean))];}))];
assert.deepEqual(walk('assets').sort(),['assets/guide-data.js','assets/poster-versions.js','assets/vendor/guide-ui.js','assets/vendor/guide-ui.css',...portraits,...['equipment','skills','consumables','quest-rewards','search-index'].map(n=>'assets/data/'+n+'.json'),...catalogImages,...require('../js/overview.js').posterFiles].sort());
const missingPortrait=path.resolve(fixture,portraits[0]);
const portraitRelative=path.relative(path.resolve(fixture),missingPortrait);
assert(portraitRelative&&!portraitRelative.startsWith('..')&&!path.isAbsolute(portraitRelative),'Deletion target is outside the test fixture');
console.log('Delete test fixture file:',missingPortrait);
fs.unlinkSync(missingPortrait);failedBuild();
ok('Source hashes unchanged, deterministic build, failed builds preserve output, runtime references and clean inventory');
ok('Inventory preserved, explicit dispositions, three courts, shared quests, public metadata whitelist');
(async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,ignoreDefaultArgs:['--hide-scrollbars'],...(process.env.GUIDE_BROWSER?{channel:process.env.GUIDE_BROWSER}:{})});
  for(const prefix of ['/','/dawnwalker-guide/']){
   const base=server.base(prefix),errors=[],remote=[];
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.addInitScript(()=>{for(const k of ['localStorage','sessionStorage'])Object.defineProperty(window,k,{get(){throw Error('Unexpected storage access');}});});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==new URL(base).origin)remote.push(r.url());});
   await page.goto(base);await page.locator('.feature').first().waitFor();assert.equal(await page.locator('#directory').count(),0);
   assert.equal(await page.locator('.repo-link').getAttribute('href'),'https://github.com/rainbowcoke/dawnwalker-guide');
   assert.equal(await page.locator('.repo-link').getAttribute('target'),'_blank');assert((await page.locator('.repo-link').getAttribute('rel')).includes('noopener'));
   await page.locator('.feature[href="quests/"]').click();assert.equal(await page.locator('.poster-link').count(),5);await page.locator('.poster-link[href="quests/standalone/"]').click();await page.locator('.catalog-link').first().waitFor();assert.equal(await page.locator('.catalog-link').count(),32);
   await fill(page.locator('#search'),'Home Sweet Home');assert.equal(await page.locator('.catalog-link').count(),1);
   await page.locator('.catalog-link').click();await page.locator('#reading-title').getByText('甜蜜之家').waitFor();assert.equal(await page.locator('.story p').count(),0);
   const summary=page.locator('.story-disclosure>summary');await summary.focus();await page.keyboard.press('Enter');await page.locator('.story').getByText(/艾林提醒/).waitFor();assert.equal(await page.locator('.outcomes li').count(),3);
   await summary.click();await page.waitForFunction(()=>document.querySelectorAll('.story p').length===0);
   await page.goBack();await page.locator('#search').waitFor();assert.equal(await value(page.locator('#search')),'Home Sweet Home');
   await fill(page.locator('#search'),'艾林提醒');assert(await page.locator('#empty').isVisible());await fill(page.locator('#search'),'<img src=x onerror=alert(1)>');assert(await page.locator('#empty').isVisible());
   await page.goto(base+'quests/character-lines/');await fill(page.locator('#search'),'Ascar');const ascar=await page.locator('.catalog-link').allTextContents();assert(ascar.length);await fill(page.locator('#search'),'Askar');assert.deepEqual(await page.locator('.catalog-link').allTextContents(),ascar);
   await page.locator('[data-section=quests]').hover();await page.locator('[data-page="quests/court-activities/"]').click();await page.waitForFunction(()=>document.querySelectorAll('.catalog-link').length===3);
   await page.locator('[data-id="court-bakir"]').click();await page.locator('.quest-card[href="'+prefix+'#q-bpff?in=court-bakir"]').click();await page.locator('#reading-title').getByText('巴基尔的耻辱架：熟悉的面孔').waitFor();
   assert.equal(await page.locator('.related a[href="'+prefix+'#vasil"]').count(),1);
   await page.goBack();await page.locator('#reading-title').getByText('巴基尔的宫廷活动').waitFor();await page.goForward();await page.locator('#reading-title').getByText('巴基尔的耻辱架：熟悉的面孔').waitFor();
   ok('Task search, aliases, spoiler boundaries, keyboard disclosure and cross-entry history at '+prefix);
   for(const id of ['q001','q020','local-sq725_blood_hunger','group-story-q001','group-home','equipment','skills','consumables','equipment/eq-sworddawnwalker5a','does-not-exist']){await page.goto(base+'#'+id);assert(await page.getByText('未找到这个故事').isVisible());}
   const linked=data.quests.find(q=>data.relations.some(r=>r.from===q.id||r.to===q.id)&&q.sections.length>1);
   await page.goto(base+'#'+linked.id);assert(await page.locator('.story-relations').isVisible());await page.locator('.story-disclosure>summary').click();await page.locator('.chapter-nav wa-button').last().click();await page.waitForFunction(()=>document.activeElement?.id?.startsWith('chapter-'));
   await page.evaluate(()=>scrollTo(0,700));await page.waitForTimeout(80);const y=await page.evaluate(()=>scrollY);await page.locator('.story-relations a').first().evaluate(a=>a.click());await page.waitForFunction(()=>!document.querySelector('.story-disclosure[open]'));await page.goBack();await page.waitForFunction(()=>!!document.querySelector('.story-disclosure[open]'));await page.waitForFunction(y=>Math.abs(scrollY-y)<4,y);
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.close-story').click();assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
   for(const q of data.quests){await page.evaluate(id=>{location.hash=id;},q.id);await page.waitForFunction(cn=>document.getElementById('reading-title')?.textContent===cn,q.cn);assert.equal(await page.locator('.story p').count(),0);await page.locator('.story-disclosure').evaluate(d=>{d.open=true;});await page.waitForFunction(()=>document.querySelectorAll('.story p').length>0);assert.equal(await page.locator('.outcomes li').count(),q.outcomes.length);}
   for(const e of data.entries.filter(e=>e.type!=='quest')){await page.evaluate(id=>{location.hash=id;},e.id);await page.waitForFunction(title=>document.getElementById('reading-title')?.textContent===title,e.title);}
   await page.goto(base+'#court-ambrus');await page.locator('.collection-background>summary').click();await page.locator('.story').getByText(/水蛭分泌物/).waitFor();
   await page.goto(base+'#anca');const imgs=await page.locator('.npc img').evaluateAll(async nodes=>Promise.all(nodes.map(async img=>{img.loading='eager';try{await img.decode();return img.naturalWidth>0;}catch{return false;}})));assert(imgs.length&&imgs.every(Boolean));
   const avatar=page.locator('.npc .avatar').first();await avatar.locator('img').evaluate(img=>img.dispatchEvent(new Event('error')));assert.equal(await avatar.locator('img').count(),0);assert((await avatar.innerText()).trim());
   for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.goto(base+'quests/character-lines/');await fill(page.locator('#search'),'马拉特');await page.locator('[data-id="marat"]').click();await page.locator('.quest-card[href="'+prefix+'#q-acl?in=marat"]').click();await page.locator('.story-disclosure>summary').click();await page.locator('.story').getByText(/父亲得知后/).waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' overflow');await page.locator('.task-back').click();await page.locator('#search').waitFor();assert.equal(await value(page.locator('#search')),'马拉特');assert.equal(await page.locator('#directory').count(),0);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);await context.close();ok('All stories, collections, disclosure history, portraits and responsive task pages at '+prefix);
  }
  assert.deepEqual(archiveHashes(),before);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({passed},null,2));
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
