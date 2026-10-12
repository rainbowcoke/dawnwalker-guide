const fs=require('node:fs'),path=require('node:path');
const P=require('../js/presentation.js');
const root=path.resolve(__dirname,'..');
const N=require('../js/navigation.js'),O=require('../js/overview.js'),vm=require('node:vm');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/guide-data.js'),'utf8'),sandbox);
const guide=JSON.parse(JSON.stringify(sandbox.window.DawnwalkerData));
const datasets=Object.fromEntries(Object.keys(P.labels).map(s=>[s,JSON.parse(fs.readFileSync(path.join(root,'data/catalog',s+'.json'),'utf8'))]));
if(process.argv.includes('--posters')){process.stdout.write(JSON.stringify(O.posterFiles));process.exit(0);}
if(process.argv.includes('--home')){process.stdout.write(O.renderHome(guide,Object.fromEntries(Object.entries(datasets).map(([k,d])=>[k,d.items.length]))));process.exit(0);}
if(process.argv.includes('--navigation')){process.stdout.write(N.menu(datasets.skills.uiIcons));process.exit(0);}
if(process.argv.includes('--counts')){process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(datasets).map(([k,d])=>[k,d.items.length]))));process.exit(0);}
if(process.argv.includes('--search-index')){
 const rows=[],seen=new Set();
 const people=names=>names.flatMap(n=>[n,guide.npcs[n]?.en,...(guide.npcs[n]?.aliases||[])]);
 for(const entry of guide.entries){
  const quest=guide.quests.find(q=>q.id===entry.id);
  rows.push({section:'quests',name:entry.title,en:quest?.en||'',category:entry.category,href:'#'+entry.id,description:entry.intro.slice(0,120),terms:[entry.title,quest?.en||'',entry.intro,...entry.searchAliases,...people(entry.npcs)].join(' ')});seen.add(entry.id);
 }
 for(const q of guide.quests)if(!seen.has(q.id)){
  const entry=guide.entries.find(e=>e.id===q.entryIds[0]);
  rows.push({section:'quests',name:q.cn,en:q.en,category:entry.category,href:'#'+q.id+'?in='+entry.id,description:q.intro.slice(0,120),terms:[q.cn,q.en,q.intro,...people(q.npcs)].join(' ')});
 }
 for(const [section,d] of Object.entries(datasets))for(const i of d.items){
  const effects=[...(i.effects||[]),...(i.ranks||[]).flatMap(r=>r.effects||[]),...(i.levels||[]).flatMap(l=>l.effects||[]),...(i.levelEffects||[]).flatMap(l=>l.effects||[]),...(i.ranks||[]).flatMap(r=>(r.levelEffects||[]).flatMap(l=>l.effects||[]))];
  rows.push({section,name:i.cn,en:i.en,category:N.forItem(section,i).label,href:section+'/'+i.id+'/',description:(i.description||effects.join('；')).slice(0,120),terms:[i.cn,i.en,i.description,...new Set(effects)].join(' ')});
 }
 process.stdout.write(JSON.stringify({schemaVersion:1,items:rows}));process.exit(0);
}
const source=JSON.parse(fs.readFileSync(path.join(root,'data/guide-source.json'),'utf8'));
const questNames=Object.fromEntries(source.quests.map(q=>[q.id,q.cn]));
const pages=[];
for(const section of ['equipment','skills','consumables']){
 const data=datasets[section];
 const summary=section==='equipment'?'按部位、稀有度与等级查找装备属性和获取方式。':section==='skills'?'查找特性、能力和绝招，规划技能点，查询手册获取方式。':'查找可制作与不可制作的物品、使用效果、昼夜限制和制作配方。';
 const intro=`<div class="reference-intro"><p class="eyebrow">桑格拉山谷</p><h1>${P.labels[section]}</h1><p>${summary}</p><p>${data.items.length} 项${P.labels[section]}</p></div>`;
 const options={root:'../',uiIcons:data.uiIcons,questNames,level:50,characterLevel:50};
 pages.push({path:section+'/',section,title:P.labels[section],description:summary,body:`<div class="reference-shell">${O.renderOverview(section,data)}</div>`,card:''});
 for(const page of N.pages.filter(p=>p.section===section)){
  const title=page.label;const body=`<div class="reference-shell"><div class="reference-intro">${O.breadcrumb(section,page)}<h1>${title}</h1><p>${summary}</p></div><div id="reference-content">${P.catalog(section,data,{...options,root:'',category:section==='skills'?title:'',match:i=>N.matches(page,i)})}</div></div>`;
  pages.push({path:page.path,section,title,description:title+' · '+summary,body,card:''});
 }
 for(const item of data.items){
  const options={root:'../../',uiIcons:data.uiIcons,questNames,level:50,characterLevel:50};
  pages.push({path:section+'/'+item.id+'/',section,title:item.cn+' · '+P.labels[section],description:(item.description||P.effects(item,options).join('；')).slice(0,150),body:`<div class="reference-shell">${intro}<p><a href="../../${section}/">浏览全部${P.labels[section]} →</a></p><div class="item-grid">${section==='skills'?`<a href="../../${N.forItem(section,item).path}">查看${item.tree}技能树</a>`:P.itemCard(section,item,options)}</div></div>`,card:P.card(section,item,options),name:item.cn});
 }
}
for(const page of [null,...N.pages.filter(p=>p.section==='quests')]){
 const title=page?.label||'任务总览';
 pages.push({path:page?.path||'quests/',section:'quests',title,description:title+'：查找任务、人物与无剧透简介。',body:page?`<div class="task-index">${O.breadcrumb('quests',page)}<h1>${title}</h1><div id="catalog">${N.taskCards(N.tasks(guide,page),guide)}</div></div>`:O.renderOverview('quests',guide),card:''});
}
process.stdout.write(JSON.stringify(pages));
