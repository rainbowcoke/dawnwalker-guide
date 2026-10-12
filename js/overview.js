/* One category overview for static exports and browser navigation. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./navigation.js'),require('../assets/poster-versions.js'));
  else root.Dawnwalker.overview=factory(root.Dawnwalker.navigation,root.DawnwalkerPosterVersions||{});
})(typeof window==='undefined'?globalThis:window,(N,versions)=>{
  'use strict';
  const copy={
    'main-story':['主线与关键选择，沿着故事继续前行。','MAIN STORY'],
    'character-lines':['走近山谷中的人物，追寻各自的故事。','CHARACTER STORIES'],
    standalone:['发现旅途中独立展开的故事。','SIDE STORIES'],
    'court-activities':['进入宫廷，了解相关人物与活动。','THE COURT'],
    exploration:['寻找遗迹、地点与山谷中的线索。','EXPLORATION'],
    weapons:['比较剑刃与伤害，选择合适的武器。','WEAPONS'],
    'upper-body':['查看上装的护甲、效果与获取方式。','UPPER BODY'],
    'lower-body':['比较下装，完善你的行旅装备。','LOWER BODY'],
    gloves:['查找护手的属性与附加效果。','GAUNTLETS'],
    boots:['选择靴子，准备踏上下一段路。','BOOTS'],
    necklaces:['查看项链效果与获取途径。','NECKLACES'],
    rings:['比较戒指，搭配所需的附加效果。','RINGS'],
    witchcraft:['研习巫术，规划特性、能力与绝招。','WITCHCRAFT'],
    swordsmanship:['磨练剑术，规划战斗与防御能力。','SWORDSMANSHIP'],
    vampirism:['掌握血族之力，规划夜间的战斗。','VAMPIRISM'],
    craftable:['查找制作效果、配方与所需材料。','ALCHEMY'],
    'non-craftable':['查看旅途补给的效果与获取方式。','PROVISIONS']
  };
  const summaries={quests:'从故事分类开始，寻找下一段旅程。',equipment:'按装备部位浏览，比较属性与获取方式。',skills:'选择技能树，规划你的能力与学习顺序。',consumables:'查看旅途所需的物品、效果与制作配方。'};
  const representatives={quests:'main-story',equipment:'weapons',skills:'witchcraft',consumables:'craftable'};
  const posterFiles=N.pages.flatMap(p=>[480,960].map(w=>`assets/posters/${p.section}-${p.slug}-${w}.webp`));
  const posterURL=file=>file+(versions[file]?'?v='+versions[file]:'');
  const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
  function breadcrumb(section,page){
    const rows=[['./','首页'],[section+'/',N.labels[section]]];if(page)rows.push([page.path,page.label]);
    return `<wa-breadcrumb aria-label="当前位置">${rows.map(([path,title],i)=>`<wa-breadcrumb-item><a href="${path}"${i===rows.length-1?' aria-current="page"':''}>${N.esc(title)}</a>${i<rows.length-1?`<span slot="separator">${icon('chevron-right')}</span>`:''}</wa-breadcrumb-item>`).join('')}</wa-breadcrumb>`;
  }
  function count(section,data,page){return section==='quests'?data.entries.filter(i=>N.matches(page,i)).length:data.items.filter(i=>N.matches(page,i)).length;}
  function posterCard(page,quantity,index=0,home=false){
    const [description,kicker]=copy[page.slug],file=`assets/posters/${page.section}-${page.slug}`,label=home?N.labels[page.section]:page.label;
    const unit=page.section==='quests'?'项任务、任务线或集合':page.section==='equipment'?'件装备':page.section==='skills'?'项技能':'种物品';
    return `<a class="poster-link${home?' feature':''}" href="${home?page.section+'/':page.path}"${!home&&page.section==='skills'?` data-accent="${page.slug}"`:''}><wa-card class="poster-card" orientation="vertical"><img class="poster-art" src="${posterURL(file+'-480.webp')}" srcset="${posterURL(file+'-480.webp')} 480w, ${posterURL(file+'-960.webp')} 960w" sizes="(min-width:1200px) 292px, (min-width:900px) calc((100vw - 96px)/3), (min-width:600px) min(360px,calc((100vw - 48px)/2)), min(360px,calc(100vw - 32px))" width="960" height="1440" alt="" ${index<2?'loading="eager"':'loading="lazy"'} ${index===0?'fetchpriority="high"':''} decoding="async"><span class="poster-shade" aria-hidden="true"></span><span class="poster-copy"><span class="poster-kicker" lang="en">${kicker}</span><h2>${N.esc(label)}</h2><span class="poster-description">${home?summaries[page.section]:description}</span><span class="poster-footer"><span>${quantity} ${unit}</span><span class="poster-enter">浏览${icon('arrow-right')}</span></span></span></wa-card></a>`;
  }
  function grid(cards){return `<div class="poster-grid" data-count="${cards.length}">${cards.join('')}</div>`;}
  function renderOverview(section,data,options={}){
    const cards=N.pages.filter(p=>p.section===section).map((p,i)=>posterCard(p,count(section,data,p),i));
    return `<div class="overview-page" data-overview="${section}">${breadcrumb(section)}<div class="overview-heading"><h1>${N.labels[section]}总览</h1><p>${summaries[section]}</p></div>${grid(cards)}</div>`;
  }
  function renderHome(guide,counts){
    const cards=Object.keys(N.labels).map((section,i)=>{const p=N.pages.find(p=>p.section===section&&p.slug===representatives[section]);return posterCard(p,section==='quests'?guide.entries.length:counts[section],i,true);});
    return `<div class="welcome home-overview">${grid(cards)}</div>`;
  }
  return {renderOverview,renderHome,breadcrumb,posterFiles,versions,copy,summaries};
});
