'use strict';
Dawnwalker.createReferences=(model,remember)=>{
  const {$,esc,fold,data}=model,P=Dawnwalker.presentation,N=Dawnwalker.navigation;
  const cache=new Map(),states=new Map(),treeViews=new Map(),panzooms=new Map();
  const tools=$('directory-tools'),toolHome=$('tools-home'),levelControl=$('equipment-level');
  let page=null,pageKey='';
  let section='',selected='',level=50,characterLevel=50,generation=0,planner=null,notice='',opener=null,openerId='',modalTicket=0;
  const root=()=>new URL('.',document.baseURI).pathname;
  const value=id=>$(id)?.value||'';
  const focusReady=el=>Promise.resolve(el?.updateComplete).then(()=>{if(el?.isConnected&&!el.disabled)el.focus({preventScroll:true});});
  const currentPayload=()=>states.get(pageKey)?.payload;
  const opts=()=>({root:root(),level,characterLevel,planner,uiIcons:currentPayload()?.uiIcons||{},questNames:Object.fromEntries([...model.quests].map(([id,q])=>[id,q.cn]))});
  async function load(name){
    if(!cache.has(name))cache.set(name,fetch(new URL(`assets/data/${name}.json`,document.baseURI)).then(r=>{if(!r.ok)throw new Error('load');return r.json();}).catch(e=>{cache.delete(name);throw e;}));
    return cache.get(name);
  }
  function captureTrees(){for(const [g,p] of panzooms){const xy=p.getPan();treeViews.set(g,{zoom:p.getScale(),x:xy.x,y:xy.y});}}
  function capture(){
    captureTrees();
    return section?{section,key:pageKey,search:value('search'),category:value('category'),kind:value('skill-kind'),quality:value('quality'),weapon:value('weapon-type'),armor:value('armor-type'),craft:value('craft-mode'),phase:value('use-phase'),level,characterLevel,y:scrollY,treeViews:Object.fromEntries(treeViews)}:null;
  }
  function save(){if(section)states.set(pageKey,{...states.get(pageKey),...capture()});}
  function parseRoute(raw){const route=N.parse(raw);return route&&route.section!=='quests'?route:null;}
  const parseLocation=()=>parseRoute(location.pathname.slice(root().length));
  function select(id,label,options){return `<div class="filter-field"><span class="field-label" id="${id}-label">${label}</span><wa-select size="s" id="${id}" aria-label="${label}" aria-labelledby="${id}-label"><wa-option value="">全部</wa-option>${options.map(o=>`<wa-option value="${esc(o.value??o)}">${esc(o.label??o)}</wa-option>`).join('')}<i slot="expand-icon" data-lucide="chevron-down" aria-hidden="true"></i></wa-select></div>`;}
  function filters(prior,payload){
    const subset=payload.items.filter(i=>N.matches(page,i));
    let html='';
    if(section==='skills')html=select('skill-kind','技能类型',[{value:'trait',label:'特性'},{value:'ability',label:'能力'},{value:'ultimate',label:'绝招'}])+`<div class="filter-field"><span class="field-label" id="character-level-label">角色等级</span><wa-select size="s" id="character-level" aria-label="角色等级" value="${characterLevel}" aria-labelledby="character-level-label">${Array.from({length:50},(_,i)=>`<wa-option value="${i+1}">${i+1}级</wa-option>`).join('')}<i slot="expand-icon" data-lucide="chevron-down" aria-hidden="true"></i></wa-select></div>`;
    else{
      html=select('quality','稀有度',P.qualities.filter(q=>subset.some(i=>i.quality===q)));
      if(section==='equipment'){
        if(!page||page.label==='武器')html+=select('weapon-type','武器类型',['大剑','长剑','短剑','类刀剑锐器']);
        if(!page||['上装','下装','护手','靴子'].includes(page.label))html+=select('armor-type','护甲类型',['重型','中型','轻型']);
      }else{
        if(!page)html+=select('craft-mode','制作',[{value:'yes',label:'制作'},{value:'no',label:'非制作'}]);
        if(!page||page.slug==='craftable')html+=select('category','制作分类',P.craftCategories);
        html+=select('use-phase','使用时段',Object.entries(P.phases).map(([value,label])=>({value,label})));
      }
    }
    $('reference-filters').innerHTML=html;
    for(const [id,key] of [['category','category'],['skill-kind','kind'],['quality','quality'],['weapon-type','weapon'],['armor-type','armor'],['craft-mode','craft'],['use-phase','phase']])if($(id))$(id).value=prior[key]||'';
    Dawnwalker.ui.enhance($('reference-filters'));
    $('reference-filters').querySelectorAll('wa-select').forEach(el=>el.addEventListener('change',()=>{
      if(el.id==='character-level'){characterLevel=Number(el.value);if(selected)renderModal();}
      renderCatalog();save();remember();
    }));
  }
  function matches(item){
    const term=fold(value('search')),cat=value('category');
    return N.matches(page,item)&&(!cat||P.groupOf(section,item)===cat)
      &&(section!=='skills'||!value('skill-kind')||item.layout.region===value('skill-kind'))&&(!value('quality')||item.quality===value('quality'))
      &&(section!=='equipment'||item.slot!=='武器'||!value('weapon-type')||item.weaponType===value('weapon-type'))
      &&(section!=='equipment'||!item.armorType||!value('armor-type')||item.armorType===value('armor-type'))
      &&(section!=='consumables'||(!value('craft-mode')||(value('craft-mode')==='yes')===item.craftable)&&(!value('use-phase')||item.usePhase===value('use-phase')))
      &&(!term||fold(JSON.stringify([item.cn,item.en,item.description,item.effects,item.ranks,item.levels?.[level-1]?.effects])).includes(term));
  }
  function plannerSummary(){
    const t=planner.totals();
    return `<div class="point-total">${P.ui('skillPoint',opts(),'技能点')}<span>已投入</span><strong>${t.total}</strong><span>技能点</span></div><div class="tree-totals">${P.trees.map(g=>`<span class="${P.treeClass[g]}">${g} <b>${t[g]}</b></span>`).join('')}</div><div class="planner-actions"><wa-button appearance="outlined" size="s" type="button" id="undo-points" ${!planner.canUndo()?'disabled':''}>${P.icon('undo-2')}撤销</wa-button><wa-button appearance="outlined" size="s" type="button" id="clear-points" ${!t.total?'disabled':''}>${P.icon('rotate-ccw')}清空方案</wa-button></div><p id="allocation-notice" role="status" aria-live="polite">${esc(notice)}</p>`;
  }
  function renderCatalog(){
    const payload=currentPayload();if(!payload||!$('reference-content'))return;
    captureTrees();for(const p of panzooms.values())p.destroy();panzooms.clear();
    const filtered=payload.items.filter(matches),subset=payload.items.filter(i=>N.matches(page,i));
    $('reference-content').innerHTML=P.catalog(section,payload,{...opts(),search:value('search')||value('skill-kind'),category:section==='skills'?page?.label||'':value('category'),match:matches});
    $('reference-empty').hidden=!!filtered.length;
    $('reference-results').textContent=section==='skills'&&(value('search')||value('skill-kind'))?`找到 ${filtered.length} 项技能，已在树中标记。`:`显示 ${filtered.length} / ${subset.length} 项${P.labels[section]}`;
    if(section==='skills'){
      $('planner-summary').innerHTML=plannerSummary();
      $('skill-search-results').innerHTML=(value('search')||value('skill-kind'))?filtered.map(i=>`<wa-button appearance="outlined" size="s" type="button" data-locate="${esc(i.id)}">${esc(i.cn)} · ${esc(i.tree)}</wa-button>`).join(''):'';
      Dawnwalker.ui.enhance($('reader'));
      bindTrees();
      $('skill-search-results').querySelectorAll('[data-locate]').forEach(b=>b.addEventListener('click',()=>locate(b.dataset.locate)));
    }
    Dawnwalker.ui.enhance($('reference-content'));
    model.imageFallback($('reference-content'));window.GuideUI?.icons();

    save();remember();
  }
  function shell(){
    toolHome.append(tools);
    const title=page?.label||P.labels[section];
    $('reader').innerHTML=`<div class="reference-shell"><div id="reference-body"><div class="reference-intro">${Dawnwalker.overview.breadcrumb(section,page)}<h1>${title}</h1><p>${section==='skills'?'查找特性、能力和绝招，规划你的技能点。':section==='equipment'?'浏览装备，选择等级查看属性与获取方式。':'查找物品效果、使用时段与获取方式。'}</p></div><div id="reference-toolbar"></div><p id="reference-results" role="status" aria-live="polite"></p>${section==='skills'?'<div id="planner-summary" class="planner-summary"></div><div id="skill-search-results" class="skill-search-results" aria-label="技能搜索结果"></div>':''}<div id="reference-content"></div><p id="reference-empty" class="empty" hidden>未找到相符的条目。<wa-button appearance="outlined" size="s" type="button" data-reset-filters>重置筛选</wa-button></p></div></div>`;
    $('reference-toolbar').append(tools);
    Dawnwalker.ui.enhance($('reader')); 
  }
  const dialog=$('item-dialog');let routeClosing=false;
  function closeDialog(){routeClosing=true;for(const tooltip of dialog.querySelectorAll('wa-tooltip'))tooltip.open=false;dialog.open=false;}
  async function renderModal(){
    const ticket=++modalTicket;
    if(!selected){closeDialog();document.body.classList.remove('has-item-dialog');updateMetadata();return;}
    if(routeClosing&&dialog.shadowRoot?.querySelector('dialog')?.open){await new Promise(resolve=>{const finish=e=>{if(e.target!==dialog)return;dialog.removeEventListener('wa-after-hide',finish);resolve();};dialog.addEventListener('wa-after-hide',finish);});if(ticket!==modalTicket)return;}
    const item=currentPayload()?.items.find(i=>i.id===selected);
    if(!item){
      dialog.label='未找到此条目';$('dialog-content').innerHTML='<article class="inspection-card"><h1>未找到此条目</h1><p>请关闭卡片，从目录重新选择。</p></article>';
      updateMetadata(null);dialog.open=true;return;
    }
    const sameItem=dialog.querySelector('.inspection-card')?.dataset.item===item.id;
    const scroll=sameItem?$('modal-scroll').scrollTop:0,active=document.activeElement?.dataset,activeId=document.activeElement?.id,openKeys=sameItem?[...dialog.querySelectorAll('[data-disclosure][open]')].map(d=>d.dataset.disclosure):[];
    if(!dialog.open){opener=document.activeElement;openerId=opener?.dataset.id||item.id;}
    dialog.label=item.cn;$('dialog-label').textContent=P.labels[section]+' · '+item.cn;
    $('dialog-content').innerHTML=P.card(section,item,opts());
    for(const key of openKeys)dialog.querySelector(`[data-disclosure="${CSS.escape(key)}"]`)?.setAttribute('open','');
    Dawnwalker.ui.enhance(dialog);model.imageFallback(dialog);window.GuideUI?.icons();
    document.body.classList.add('has-item-dialog');updateMetadata(item);
    await customElements.whenDefined('wa-dialog');if(ticket!==modalTicket)return;
    const wasOpen=dialog.open;routeClosing=false;dialog.open=true;
    if(wasOpen){$('modal-scroll').scrollTop=scroll;if(!sameItem)$('close-item').focus({preventScroll:true});else if(active?.skill){const target=dialog.querySelector(`[data-skill="${active.skill}"][data-change="${active.change}"]`);focusReady(target?.disabled?$('close-item'):target);}else if(activeId)focusReady(dialog.querySelector(`#${CSS.escape(activeId)}`));}
    else $('modal-scroll').scrollTop=0;
  }
  function updateMetadata(item){
    const title=item?`${item.cn} · ${P.labels[section]}`:page?.label||P.labels[section];
    document.title=title+' · 《黎明行者之血》中文游戏指南';
    document.querySelector('meta[name=description]').content=item?(item.description||P.effects(item,opts()).join('；')).slice(0,150):`《黎明行者之血》${P.labels[section]}查询：${section==='skills'?'特性、能力、绝招与技能加点。':section==='equipment'?'部位、稀有度、等级属性与获取方式。':'制作配方、使用效果与昼夜限制。'}`;
    document.querySelector('link[rel=canonical]')?.setAttribute('href','https://rainbowcoke.github.io/dawnwalker-guide/'+(item?section+'/'+item.id+'/':pageKey));
  }
  dialog.addEventListener('wa-hide',e=>{if(e.target===dialog&&!routeClosing&&dialog.open){e.preventDefault();model.closeItem?.();}});
  dialog.addEventListener('wa-after-hide',e=>{if(e.target!==dialog)return;const target=opener?.isConnected&&opener.dataset.id?opener:openerId?document.querySelector(`[data-id="${CSS.escape(openerId)}"]`):$('search');target?.focus({preventScroll:true});opener=null;openerId='';});
  $('close-item').addEventListener('click',()=>model.closeItem?.());
  document.addEventListener('keydown',e=>{
    if(!dialog.open||!selected)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();model.closeItem?.();}
    if(e.key==='Tab'){
      // Native dialogs can move focus to browser chrome at either boundary.
      // Keep only those boundary transitions within the visible card controls.
      const targets=[...dialog.querySelectorAll('wa-button,wa-select,wa-input,summary,a[href]')].filter(el=>{
        if(el.disabled||!el.checkVisibility())return false;
        const disclosure=el.parentElement?.closest('details');
        return !disclosure||disclosure.open;
      });
      const active=document.activeElement;
      const target=e.shiftKey&&active===targets[0]?targets.at(-1):!e.shiftKey&&active===targets.at(-1)?targets[0]:null;
      if(target){e.preventDefault();target.focus();}
    }
  },{capture:true});
  dialog.addEventListener('change',e=>{
    if(e.target.id==='card-level'){level=Number(e.target.value);$('level').value=String(level);updateEquipmentCards();renderModal();}
    if(e.target.id==='skill-level'){characterLevel=Number(e.target.value);if($('character-level'))$('character-level').value=String(characterLevel);renderModal();}
    save();remember();
  });
  document.addEventListener('click',e=>{
    const change=e.target.closest('[data-change]');
    if(change&&planner){
      const result=planner.change(change.dataset.skill,Number(change.dataset.change));
      if(!result.ok){notice=result.message;return;}
      notice=Number(change.dataset.change)>0?'已增加一级。':`退还 ${result.refund} 点。${result.affected.map(a=>`${a.cn} ${a.from} → ${a.to}级`).join('；')}`;
      refreshAllocation(change);return;
    }
    if(e.target.closest('#undo-points')){planner.undo();notice='已撤销上一步操作。';refreshAllocation();}
    if(e.target.closest('#clear-points')){planner.clear();notice='已清空方案，可撤销恢复。';refreshAllocation();}
  });
  function refreshAllocation(button){
    const skill=button?.dataset.skill,delta=button?.dataset.change,focusId=button?.id;
    for(const item of currentPayload().items){
      const node=document.querySelector(`[data-node="${item.id}"]`);if(!node)continue;
      const n=planner.rank(item.id),reason=planner.reason(item,n+1);
      node.classList.toggle('learned',!!n);node.classList.toggle('locked-node',!!reason);node.classList.toggle('available-node',!reason);
      node.querySelector('.point-controls').outerHTML=P.controls(item,opts());
    }
    for(const edge of document.querySelectorAll('.tree-edges path'))edge.classList.toggle('allocated-edge',!!planner.rank(edge.dataset.parent)&&!!planner.rank(edge.dataset.child));
    if($('planner-summary')){$('planner-summary').innerHTML=plannerSummary();Dawnwalker.ui.enhance($('planner-summary'));}
    if(selected)renderModal();
    else {const target=skill?document.querySelector(`[data-skill="${skill}"][data-change="${delta}"]`):$(focusId);focusReady(target);}
    window.GuideUI?.icons();save();remember();
  }
  function bindTrees(){
    for(const v of document.querySelectorAll('.tree-viewport')){
      const canvas=v.querySelector('.tree-canvas'),g=v.dataset.tree,width=Number(canvas.dataset.width),height=Number(canvas.dataset.height),saved=treeViews.get(g);
      const initial=saved?.zoom||Math.min(1,v.clientWidth/width,v.clientHeight/height);
      const p=window.GuideUI.Panzoom(canvas,{canvas:true,origin:'0 0',minScale:.1,maxScale:2,startScale:initial,startX:saved?.x||0,startY:saved?.y||0,animate:false,excludeClass:'panzoom-exclude'});panzooms.set(g,p);
      canvas.addEventListener('panzoomchange',()=>{const xy=p.getPan();treeViews.set(g,{zoom:p.getScale(),x:xy.x,y:xy.y});const label=document.querySelector(`[data-zoom-label="${g}"]`);if(label)label.textContent=Math.round(p.getScale()*100)+'%';remember();});
      const label=document.querySelector(`[data-zoom-label="${g}"]`);label.textContent=Math.round(initial*100)+'%';
      v.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();p.zoomWithWheel(e);}},{passive:false});
      v.addEventListener('keydown',e=>{
        if(e.target!==v)return;const xy=p.getPan(),step=80/p.getScale(),shifts={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]};
        if(shifts[e.key]){e.preventDefault();p.pan(xy.x+shifts[e.key][0],xy.y+shifts[e.key][1]);}
        if(e.key==='+'||e.key==='='){e.preventDefault();p.zoomIn();}if(e.key==='-'){e.preventDefault();p.zoomOut();}
        if(e.key==='Home'){e.preventDefault();fitTree(g);}
      });
      v.querySelectorAll('a,wa-button').forEach(el=>el.classList.add('panzoom-exclude'));
    }
    document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{const p=panzooms.get(b.dataset.tree);if(b.dataset.zoom==='fit')fitTree(b.dataset.tree);else if(b.dataset.zoom==='in')p.zoomIn();else p.zoomOut();}));
  }
  function fitTree(g){const v=document.querySelector(`.tree-viewport[data-tree="${g}"]`),c=v.querySelector('.tree-canvas'),p=panzooms.get(g);p.zoom(Math.min(1,v.clientWidth/Number(c.dataset.width),v.clientHeight/Number(c.dataset.height)));requestAnimationFrame(()=>p.pan(0,0));}
  function locate(id){
    const node=document.querySelector(`[data-node="${id}"]`);if(!node)return;
    const v=node.closest('.tree-viewport'),p=panzooms.get(v.dataset.tree),s=Math.max(.7,p.getScale());p.zoom(s);requestAnimationFrame(()=>{p.pan(v.clientWidth/(2*s)-Number(node.dataset.x),v.clientHeight/(2*s)-Number(node.dataset.y));node.querySelector('a').focus({preventScroll:true});});
    v.scrollIntoView({block:'center'});remember();
  }
  async function enter(route,restored){
    save();const ticket=++generation,oldSection=section,oldKey=pageKey,oldPage=page;
    section=route.section;selected=route.id;
    document.body.classList.remove('home');document.body.classList.add('references');document.body.dataset.referenceSection=section;
    try{
      const payload=await load(section);if(ticket!==generation)return;
      const item=payload.items.find(i=>i.id===selected);
      const origin=history.state?.originPath&&N.parse(history.state.originPath);
      page=route.page||(selected?((origin?.section===section?origin.page:null)||(oldSection===section&&oldPage?oldPage:N.forItem(section,item||{}))):null);
      pageKey=page?.path||section+'/';
      const prior=restored?.key===pageKey?restored:states.get(pageKey)||{search:'',category:'',level:50,y:0};
      const same=oldKey===pageKey&&!!$('reference-content');
      if(restored?.treeViews)for(const [g,v] of Object.entries(restored.treeViews))treeViews.set(g,v);
      if(section==='skills'&&!planner)planner=Dawnwalker.createPlanner(payload.items);
      if(!page&&!selected){
        for(const p of panzooms.values())p.destroy();panzooms.clear();toolHome.append(tools);levelControl.hidden=true;
        states.set(pageKey,{...prior,payload});$('reader').innerHTML=Dawnwalker.overview.renderOverview(section,payload);
        N.mark(section,section+'/');Dawnwalker.ui.enhance($('reader'));await renderModal();return;
      }
      if(!same){for(const p of panzooms.values())p.destroy();panzooms.clear();shell();}
      $('level').value=String(level);levelControl.hidden=section!=='equipment';
      $('search').value=prior.search||'';$('search').placeholder=section==='skills'?'搜索技能名称或效果':section==='equipment'?'搜索装备名称或效果':'搜索物品名称或效果';
      filters(prior,payload);states.set(pageKey,{...prior,payload});N.mark(section,page?.path);
      if(!same||restored)renderCatalog();
      await renderModal();
    }catch(e){
      if(ticket!==generation)return;
      console.error(e);toolHome.append(tools);
      $('reader').innerHTML=`<div class="reference-shell"><h1>${P.labels[section]}加载失败</h1><p>请检查网络连接后重试。</p><wa-button appearance="outlined" size="s" id="retry-reference" type="button">重新加载</wa-button></div>`;
      Dawnwalker.ui.enhance($('reader'));
      $('retry-reference').addEventListener('click',()=>enter(route,restored));
    }
  }
  function leave(){
    ++generation;++modalTicket;closeDialog();document.body.classList.remove('has-item-dialog');
    save();for(const p of panzooms.values())p.destroy();panzooms.clear();toolHome.append(tools);section='';selected='';page=null;pageKey='';
    document.body.classList.remove('references');delete document.body.dataset.referenceSection;
  }
  $('reset').addEventListener('click',()=>{
    if(!section)return;$('search').value='';for(const id of ['category','skill-kind','quality','weapon-type','armor-type','craft-mode','use-phase'])if($(id))$(id).value='';renderCatalog();$('search').focus();
  });
  function updateEquipmentCards(){for(const card of document.querySelectorAll('#reference-content .item-card')){const item=currentPayload()?.items.find(i=>i.id===card.dataset.id);if(item)card.querySelector('.list-stats').textContent=P.stats(item,opts(),true);}}
  $('level').addEventListener('change',()=>{level=Number(value('level'));updateEquipmentCards();if(selected)renderModal();save();remember();});
  async function addQuestRewards(id,isCurrent){
    try{const index=await load('quest-rewards');if(!isCurrent())return;const rows=index[id];if(!rows?.length)return;
      const block=document.createElement('section');block.className='reference-block quest-rewards';block.innerHTML=`<h2>相关物品与技能</h2><ul class="effect-list">${rows.map(r=>`<li><a href="${esc(P.href(r.section,r.id,{root:root()}))}">${esc(r.cn)} <span lang="en">${esc(r.en)}</span></a>${r.condition?`<p>${esc(r.condition)}</p>`:''}</li>`).join('')}</ul>`;
      $('reader').querySelector('.story-disclosure').before(block);
    }catch{}
  }
  return {active:()=>!!section,section:()=>section,selected:()=>selected,parseRoute,parseLocation,capture,enter,leave,renderCatalog,addQuestRewards,directoryY:()=>states.get(pageKey)?.y||0,listPath:()=>pageKey};
};
