'use strict';
Dawnwalker.createCatalog = (model,getSelection) => {
  const {data,$,quests,types,esc,fold,href,avatar,imageFallback,entryText,questText,categoryEntries,entryQuests}=model;
  function catalogLink(id,title,subtitle,npc,context='') {
    const {current,currentEntry} = getSelection();
    const active = id===current || id===currentEntry;
    return `<a class="catalog-link" href="${href(id,context)}" data-id="${esc(id)}" ${active?'aria-current="page"':''}>${npc?avatar(npc):'<span class="index-mark" aria-hidden="true">◇</span>'}<span class="catalog-copy"><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span><span class="arrow" aria-hidden="true">›</span></a>`;
  }
  function renderCatalog() {
    const term=fold($('search').value), category=$('category').value;
    const used=new Set(); let output='';
    for(const cat of data.categories) {
      if(category && category!==cat) continue;
      let rows='';
      for(const e of categoryEntries.get(cat)) {
        const matchesEntry=!term || entryText.get(e.id).includes(term);
        if(matchesEntry && !used.has(e.id)) {
          used.add(e.id); rows+=catalogLink(e.id,e.title,types[e.type],e.npcs[0]);
        }
        if(term) {
          for(const qid of entryQuests.get(e.id)) {
            if(used.has(qid)) continue;
            if(matchesEntry || questText.get(qid).includes(term)) {
              const q=quests.get(qid); used.add(qid);
              rows+=catalogLink(qid,q.cn,e.type==='quest'?'任务':e.title,q.npcs[0],e.id);
            }
          }
        }
      }
      if(rows) output+=`<section class="catalog-section"><h2>${esc(cat)}</h2>${rows}</section>`;
    }
    $('catalog').innerHTML=output;
    $('empty').hidden=!!output;
    $('search-status').textContent=term ? (output?'搜索已更新。选择任务查看简介。':'未找到相符的故事。') : '';
    imageFallback($('catalog'));
  }
  function start() {
    for(const cat of data.categories) {const o=document.createElement('option');o.value=cat;o.textContent=cat;$('category').append(o);}
    $('search').addEventListener('input',renderCatalog);
    $('category').addEventListener('change',renderCatalog);
    $('reset').addEventListener('click',()=>{$('search').value='';$('category').value='';renderCatalog();$('search').focus();});
    renderCatalog();
  }
  return {renderCatalog,start};
};
