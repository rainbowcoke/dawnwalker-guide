'use strict';
Dawnwalker.createCatalog=(model,references)=>{
  const {$,data,esc}=model,N=Dawnwalker.navigation;
  const states=new Map(),tools=$('directory-tools'),home=$('tools-home');
  let active=false,page=null,key='';
  const capture=()=>active?{key,search:$('search').value,person:$('task-person')?.value||'',y:scrollY}:null;
  function save(){if(active)states.set(key,capture());}
  function leave(){if(active){save();home.append(tools);active=false;}}
  function renderCatalog(){
    if(references.active()){references.renderCatalog();return;}
    if(!active||!page)return;
    const rows=N.tasks(data,page,$('search').value,$('task-person')?.value||'');
    $('catalog').innerHTML=N.taskCards(rows,data).replaceAll('href="#','href="'+new URL('.',document.baseURI).pathname+'#');
    Dawnwalker.ui.enhance($('catalog'));
    $('empty').hidden=!!rows.length;
    $('search-status').textContent=`显示 ${rows.length} 项任务、任务线或集合`;
    model.imageFallback($('catalog'));save();model.remember?.();
  }
  function enter(route,restored){
    leave();page=route.page||null;key=page?.path||'quests/';active=true;
    const prior=restored?.key===key?restored:states.get(key)||{search:'',person:'',y:0};
    const title=page?.label||'任务总览';
    if(!page){
      if(!$('reader').querySelector('[data-overview="quests"]'))$('reader').innerHTML=Dawnwalker.overview.renderOverview('quests',data);
      home.append(tools);$('equipment-level').hidden=true;
      N.mark('quests','quests/');Dawnwalker.ui.enhance($('reader'));return prior.y||0;
    }
    $('reader').innerHTML=`<div class="task-index">${Dawnwalker.overview.breadcrumb('quests',page)}<h1>${title}</h1><p class="intro">查找任务、人物与关键选择。完整故事和结局需进入任务后展开。</p><div id="task-toolbar"></div><p id="search-status" role="status" aria-live="polite"></p><div id="catalog"></div><p id="empty" class="empty" hidden>未找到相符的故事。<wa-button appearance="outlined" size="s" type="button" data-reset-filters>重置筛选</wa-button></p></div>`;
    $('task-toolbar').append(tools);$('equipment-level').hidden=true;
    $('search').value=prior.search;$('search').placeholder='搜索任务名称或人物';
    const people=[...new Set(data.entries.filter(e=>N.matches(page,e)).flatMap(e=>e.npcs))];
    $('reference-filters').innerHTML=`<div class="filter-field"><span class="field-label" id="task-person-label">人物</span><wa-select size="s" id="task-person" aria-label="人物" aria-labelledby="task-person-label"><wa-option value="">全部人物</wa-option>${people.map(p=>`<wa-option value="${esc(p)}">${esc(p)}</wa-option>`).join('')}<i slot="expand-icon" data-lucide="chevron-down" aria-hidden="true"></i></wa-select></div>`;
    $('task-person').value=prior.person;$('task-person').addEventListener('change',renderCatalog);
    Dawnwalker.ui.enhance($('reader'));
    N.mark('quests',page?.path);renderCatalog();return prior.y||0;
  }
  function start(){
    $('search').addEventListener('input',renderCatalog);
    $('reset').addEventListener('click',()=>{if(!active)return;$('search').value='';if($('task-person'))$('task-person').value='';renderCatalog();$('search').focus();});
    document.addEventListener('click',e=>{if(e.target.closest('[data-reset-filters]'))$('reset').click();});
  }
  return {renderCatalog,start,enter,leave,capture};
};
