/* Shared, deterministic HTML for browser views and the static export. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tree-layout.js'));
  else root.Dawnwalker.presentation=factory(root.Dawnwalker.treeLayout);
})(typeof window==='undefined'?globalThis:window,L=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={equipment:'装备',skills:'技能',consumables:'消耗品'};
  const slots=['武器','上装','下装','护手','靴子','项链','戒指'];
  const trees=['巫术','剑术','血族'];
  const qualities=['传说','史诗','大师','卓越','常见','任务'];
  const craftCategories=['治疗物品','强化物品·耐力','强化物品·近战攻击','辅助物品','强化物品·主动能力'];
  const phases={anytime:'全天',day:'仅限白天',night:'仅限夜间'};
  const treeClass={巫术:'witchcraft',剑术:'swordsmanship',血族:'vampirism'};
  const treeIcon={巫术:'witchcraft',剑术:'swordmastery',血族:'vampirism'};
  const href=(section,id='',o={})=>(o.root||'')+section+'/'+(id?encodeURIComponent(id)+'/':'');
  const image=(src,classes='',alt='',lazy=true)=>src?`<img src="${esc(src)}" class="${classes}" alt="${esc(alt)}" ${lazy?'loading="lazy"':''} decoding="async">`:'';
  const ui=(key,o={},label='')=>image(o.uiIcons?.[key],'game-symbol',label,false);
  const icon=(name,label='')=>`<i data-lucide="${name}" ${label?`aria-label="${esc(label)}"`:'aria-hidden="true"'}></i>`;
  const phase=(item,o)=>`<span class="phase-label">${ui(item.usePhase||'anytime',o,phases[item.usePhase||'anytime'])}<span>${phases[item.usePhase||'anytime']}</span></span>`;
  const effects=(item,o={},r)=>r?.levelEffects?.[(o.characterLevel||50)-1]?.effects||r?.effects||item.levelEffects?.[(o.characterLevel||50)-1]?.effects||item.effects||[];
  function effectText(text,o){return esc(text).replace(/主动能力充能/g,match=>match+ui('charge',o,'主动能力充能'));}
  const effectList=(rows,o={})=>rows?.length?`<ul class="effect-list game-effects">${rows.map(x=>`<li><span class="effect-bullet" aria-hidden="true">◇</span><span>${effectText(x,o)}</span></li>`).join('')}</ul>`:'';
  function fields(rows,o={}){
    const symbols={'重量':'weight','买入价格':'currency','卖出价格':'currency','基础买入价格':'currency','基础卖出价格':'currency','技能点':'skillPoint','本级所需技能点':'skillPoint','本级学习时间':'learningTime','学习时间':'learningTime'};
    return rows?.length?`<dl class="reference-facts">${rows.map(r=>`<div><dt>${ui(symbols[r.label],o,r.label)}${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('')}</dl>`:'';
  }
  function stats(item,o={},compact=false){
    const lv=o.level||50,s=item.levels?.[lv-1];if(!s)return '';
    const rows=[...(s.damage?[{label:'伤害',value:s.damage.join('—')}]:[]),...(s.armor!==undefined?[{label:'护甲',value:s.armor}]:[])];
    if(compact)return rows.map(x=>x.label+' '+x.value).join(' · ');
    return `<section class="equipment-stats"><p class="stat-level">${lv}级</p><dl class="primary-stats">${rows.map(x=>`<div><dt>${x.label}</dt><dd>${esc(x.value)}</dd></div>`).join('')}</dl>${effectList(s.effects,o)}</section>`;
  }
  function prices(item,o={}){
    const s=item.levels?.[(o.level||50)-1],rows=item.fields.filter(f=>f.label==='重量'||(!s&&f.label.includes('价格'))).map(f=>({...f,value:f.label==='重量'?Number(f.value).toFixed(2):f.value}));
    if(s)for(const [key,label] of [['buy','买入价格'],['sell','卖出价格']]){
      if(s[key]!==undefined)rows.push({label,value:s[key]+' 第纳尔'});
      else{const f=item.fields.find(f=>f.label===`基础${label}`);if(f)rows.push(f);}
    }
    return fields(rows,o);
  }
  function acquisitionRows(rows,o={}){
    return `<ul class="effect-list acquisition-list">${rows.map(a=>`<li>${esc(a.text)}${a.questId?` <a href="${esc((o.root||'')+'#'+a.questId)}">${esc(o.questNames?.[a.questId]||'相关任务')} ${icon('arrow-right')}</a>`:''}</li>`).join('')}</ul>`;
  }
  function disclosure(label,html,key){return `<details class="card-disclosure" data-disclosure="${key}"><summary>${label}</summary><div class="disclosure-content">${html}</div></details>`;}
  function acquisition(item,o){return item.acquisition?.length?disclosure('获取方式',acquisitionRows(item.acquisition,o),'acquisition'):'';}
  function manualInfo(item,o){
    return item.manuals?.length?disclosure(ui('manual',o,'手册')+'手册获取',item.manuals.map(m=>`<article class="manual"><h3>${esc(m.cn)}</h3><p class="muted">解锁 ${m.ranks.join('、')} 级学习</p>${m.acquisition.length?acquisitionRows(m.acquisition,o):'<p class="muted">暂无明确获取地点</p>'}</article>`).join(''),'manuals'):'';
  }
  function levelControl(o,equipment=false){
    const id=equipment?'card-level':'skill-level',lv=equipment?o.level||50:o.characterLevel||50;
    return `<div class="card-level-control js-only"><span class="field-label" id="${id}-label">${equipment?'装备':'角色'}等级</span><wa-select size="s" id="${id}" aria-label="${equipment?'装备':'角色'}等级" value="${lv}" aria-labelledby="${id}-label">${Array.from({length:50},(_,i)=>`<wa-option value="${i+1}">${i+1}级</wa-option>`).join('')}<i slot="expand-icon" data-lucide="chevron-down" aria-hidden="true"></i></wa-select></div>`;
  }
  function diamonds(item,n=0){return `<span class="rank-diamonds" role="img" aria-label="${n} / ${item.ranks.length} 级">${item.ranks.map((r,i)=>`<span class="rank-diamond ${i<n?'filled':''}" aria-hidden="true"></span>`).join('')}</span>`;}
  function controls(item,o={}){
    const n=o.planner?.rank(item.id)||0,reason=o.planner?.reason(item,n+1)||(n===item.ranks.length?'已满级':''),uid=(o.modal?'modal-':'')+item.id;
    const help=reason||`下一级需要 ${item.ranks[n]?.pointCost||0} 技能点`;
    return `<div class="point-controls" data-points="${esc(item.id)}" aria-label="${esc(item.cn)}等级规划" title="${esc(help)}"><wa-button class="rank-change panzoom-exclude js-only" appearance="plain" data-change="-1" data-skill="${esc(item.id)}" aria-label="${esc(item.cn)}减一级" ${!n?'disabled':''}>${icon('minus')}</wa-button>${diamonds(item,n)}<wa-button class="rank-change panzoom-exclude js-only" appearance="plain" data-change="1" data-skill="${esc(item.id)}" aria-label="${esc(item.cn)}加一级" aria-describedby="reason-${esc(uid)}" ${reason?'disabled':''}>${icon('plus')}</wa-button><span class="sr-only rank-help" id="reason-${esc(uid)}">${esc(help)}</span></div>`;
  }
  function card(section,item,o={}){
    let head=`<div class="reference-heading"><div><p class="eyebrow">${esc(item.quality||'')}${item.quality?' · ':''}${esc(item.weaponType||item.armorType||item.category)}</p><h1 id="reading-title">${esc(item.cn)}</h1>${item.cn!==item.en?`<p class="reference-en" lang="en">${esc(item.en)}</p>`:''}</div>${image(item.icon,'reference-detail-icon','',false)}</div>`;
    let content='';
    if(section==='equipment'){
      content=head+levelControl(o,true)+stats(item,o)+`<div class="card-footer equipment-prices">${prices(item,o)}</div>`+(item.description?`<p class="reference-description">${esc(item.description)}</p>`:'')+acquisition(item,o);
    }else if(section==='skills'){
      const n=o.planner?.rank(item.id)||0;
      content=(item.illustration?`<figure class="reference-art">${image(item.illustration,'reference-illustration',item.cn+'插画',false)}${diamonds(item,n)}</figure>`:'')+head+phase(item,o)+`<p class="preview-label">${n?`已规划 ${n} 级`:'未学习 · 1级预览'}</p>`;
      if(item.levelEffects||item.ranks.some(r=>r.levelEffects))content+=levelControl(o);
      content+=`<p class="reference-description">${effectText(item.description,o)}</p><div class="skill-preview">${controls(item,{...o,modal:true})}</div><div class="skill-ranks">${item.ranks.map(r=>`<section class="skill-rank ${r.rank===Math.max(1,n)?'current-rank':''}"><div class="rank-heading"><h2><span class="rank-diamond ${r.rank<=n?'filled':''}" aria-hidden="true"></span>${r.rank}级</h2><span class="rank-cost" title="本级技能点与学习时间">${ui('skillPoint',o,'技能点')}<span>${r.pointCost}</span>${ui('learningTime',o,'学习时间')}<span>${r.learningTime}</span><span class="sr-only">本级 ${r.pointCost} 技能点，学习 ${r.learningTime} 个时间段</span></span></div>${effectList(effects(item,o,r),o)}<p class="rank-total">升至本级累计 ${r.totalPoints} 技能点</p>${r.conditions.length?disclosure('学习条件',effectList(r.conditions,o),'rank-'+r.rank):''}</section>`).join('')}</div>`;
      if(n===item.ranks.length)content+='<p class="max-rank">已达到最高等级</p>';
      if(item.prerequisites.length)content+=`<section class="card-related"><h2>前置技能${item.prerequisites.length>1?'（学习其中一项即可）':''}</h2>${item.prerequisites.map(p=>`<a class="related-link" href="${esc(href('skills',p.id,o))}">${esc(p.cn)}</a>`).join('')}</section>`;
      content+=manualInfo(item,o)+(!item.manuals.length?acquisition(item,o):'');
    }else{
      content=head+phase(item,o);
      if(item.levelEffects)content+=levelControl(o);
      content+=`<section class="consumable-preview">${effectList(effects(item,o),o)}${effectList(item.conditions,o)}</section><div class="card-footer">${prices(item,o)}</div>`+(item.description?`<p class="reference-description">${esc(item.description)}</p>`:'');
      if(item.recipes.length)content+=`<section class="card-recipes"><h2>制作配方</h2>${item.recipes.map((r,i)=>`<article class="recipe">${item.recipes.length>1?`<h3>配方 ${i+1}</h3>`:''}<ul class="recipe-materials">${r.materials.map(m=>`<li>${image(m.icon,'material-icon','')}<span>${esc(m.cn)}<small lang="en">${esc(m.en)}</small></span><strong>× ${m.count}</strong></li>`).join('')}</ul>${fields([{label:'基础制作数量',value:r.output},{label:'基础制作上限',value:r.limit}],o)}${effectList(r.conditions,o)}</article>`).join('')}</section>`;
      content+=acquisition(item,o);
    }
    return `<article class="inspection-card ${section==='skills'?treeClass[item.tree]:''}" data-item="${esc(item.id)}">${content}</article>`;
  }
  function itemCard(section,item,o={}){
    const extra=section==='equipment'?stats(item,o,true):effects(item,o).join('；');
    return `<a class="reference-link item-card" href="${esc(href(section,item.id,o))}" data-id="${esc(item.id)}" data-quality="${esc(item.quality)}" data-type="${esc(item.weaponType||item.armorType||'')}"><span class="card-image">${image(item.icon,'reference-list-icon')}</span><span class="item-card-copy"><span class="item-badges"><span>${esc(item.quality)}</span>${section==='equipment'?`<span>${esc(item.weaponType||item.armorType||item.slot)}</span>`:phase(item,o)}</span><strong>${esc(item.cn)}</strong>${item.cn!==item.en?`<small lang="en">${esc(item.en)}</small>`:''}<span class="list-stats compact-effect">${esc(extra)}</span>${section==='equipment'&&item.description?`<span class="item-description">${esc(item.description)}</span>`:''}</span><span class="card-arrow" aria-hidden="true">${icon('arrow-up-right')}</span></a>`;
  }
  function equipmentOrder(a,b){
    const order=['大剑','长剑','短剑','类刀剑锐器','重型','中型','轻型',''];
    return order.indexOf(a.weaponType||a.armorType||'')-order.indexOf(b.weaponType||b.armorType||'')||a.cn.localeCompare(b.cn,'zh-CN')||a.id.localeCompare(b.id);
  }
  function groupOf(section,i){return section==='equipment'?i.slot:section==='skills'?i.tree:i.craftable?i.craftingCategory:'不可制作';}
  function groups(section){return section==='equipment'?slots:section==='skills'?trees:[...craftCategories,'不可制作'];}
  function sortedConsumables(items){return [...items].sort((a,b)=>a.craftable&&b.craftable?a.craftingOrder-b.craftingOrder:a.cn.localeCompare(b.cn,'zh-CN')||a.rarityOrder-b.rarityOrder||a.id.localeCompare(b.id));}
  const compactTree=L.compactTree;
  function tree(group,items,o={}){
    const dims=o.treeCanvases?.[group]||{width:2400,height:1750,traitWidth:1830,ultimateY:1650,abilityX:1830};
    const layout=compactTree(items,dims);
    const {coordinates,width,height,nodeWidth,nodeHeight,abilityX,ultimateY}=layout;
    const paths=items.flatMap(i=>i.prerequisites.map(p=>{
      const a=coordinates.get(p.id),b=coordinates.get(i.id);if(!a||!b)return '';
      const route=L.routeEdge(layout,p.id,i.id);
      return `<path class="${o.planner?.rank(p.id)&&o.planner?.rank(i.id)?'allocated-edge':''}" data-parent="${esc(p.id)}" data-child="${esc(i.id)}" d="${L.path(route)}"/>`;
    })).join('');
    const nodes=items.map(i=>{
      const n=o.planner?.rank(i.id)||0,c=coordinates.get(i.id),reason=o.planner?.reason(i,n+1)||'',hit=o.match?.(i);
      return `<article class="skill-node ${i.layout.kind==='ability'?'skill-ability':''} ${i.ultimate?'ultimate-node':''} ${n?'learned':''} ${reason?'locked-node':'available-node'} ${o.search?(hit?'search-hit':'search-dim'):''}" data-node="${esc(i.id)}" data-region="${esc(i.layout.region||'trait')}" data-x="${c.x}" data-y="${c.y}" style="left:${c.x-nodeWidth/2}px;top:${c.y-nodeHeight/2}px"><a class="reference-link skill-node-link panzoom-exclude" href="${esc(href('skills',i.id,o))}" data-id="${esc(i.id)}"><span class="skill-icon-frame circle">${image(i.icon,'reference-list-icon')}</span><strong>${esc(i.cn)}</strong></a>${controls(i,o)}</article>`;
    }).join('');
    return `<section class="reference-group skill-group ${treeClass[group]}" id="group-${group}" data-group="${group}"><div class="group-heading"><h2>${ui(treeIcon[group],o,group)}${group}</h2><span>${items.length} 项技能</span></div><div class="tree-heading"><p>拖动画布 · 双指缩放</p><div class="tree-actions js-only" aria-label="${group}技能树视图"><wa-button appearance="outlined" size="s" type="button" data-zoom="out" data-tree="${group}" aria-label="缩小${group}技能树">${icon('zoom-out')}</wa-button><output data-zoom-label="${group}">100%</output><wa-button appearance="outlined" size="s" type="button" data-zoom="in" data-tree="${group}" aria-label="放大${group}技能树">${icon('zoom-in')}</wa-button><wa-button appearance="outlined" size="s" type="button" data-zoom="fit" data-tree="${group}" aria-label="恢复${group}全图">${icon('maximize')}全图</wa-button></div></div><div class="tree-viewport" data-tree="${group}" style="--tree-aspect:${width}/${height}" tabindex="0" aria-label="${group}技能树，可拖动和缩放"><div class="tree-canvas" data-width="${width}" data-height="${height}" style="width:${width}px;height:${height}px"><h3 class="canvas-caption" style="left:24px;top:8px">特性</h3><h3 class="canvas-caption" style="left:${abilityX}px;top:8px">能力</h3><div class="ultimate-separator" style="left:24px;top:${ultimateY-158}px;width:${abilityX-48}px"><span>绝招特性</span><small>每个技能树仅能解锁一种</small></div><svg class="tree-edges" viewBox="0 0 ${width} ${height}" aria-hidden="true">${paths}</svg>${nodes}</div></div></section>`;
  }
  function catalog(section,payload,o={}){
    const items=payload.items.filter(o.match||(()=>true)),shown=groups(section).filter(g=>section==='skills'?(!o.category||o.category===g):items.some(i=>groupOf(section,i)===g));
    if(section==='skills')return shown.map(g=>tree(g,payload.items.filter(i=>i.tree===g),{...o,treeCanvases:payload.treeCanvases})).join('');
    return shown.map((g,index)=>{
      const rows=items.filter(i=>groupOf(section,i)===g);
      const heading=`<div class="group-heading"><h2>${esc(g)}</h2><span>${rows.length} 项</span></div>`;
      if(section==='consumables')return `${index===0&&shown.some(x=>x!=='不可制作')?'<h2 class="craft-section-heading">可制作</h2>':''}<section class="reference-group" id="group-${esc(g)}" data-group="${esc(g)}">${heading}<div class="item-grid">${sortedConsumables(rows).map(i=>itemCard(section,i,o)).join('')}</div></section>`;
      return `<section class="reference-group" id="group-${esc(g)}" data-group="${esc(g)}">${heading}${qualities.map(q=>{
        const tier=rows.filter(i=>i.quality===q).sort(equipmentOrder);
        return tier.length?`<section class="rarity-tier" data-quality="${esc(q)}"><h3><span>${esc(q)}</span><small>${tier.length}</small></h3><div class="item-grid">${tier.map(i=>itemCard(section,i,o)).join('')}</div></section>`:'';
      }).join('')}</section>`;
    }).join('');
  }
  return {esc,labels,slots,trees,qualities,craftCategories,phases,treeClass,href,image,ui,icon,phase,effects,effectList,fields,stats,prices,card,itemCard,controls,diamonds,equipmentOrder,sortedConsumables,groupOf,groups,catalog,compactTree};
});
