'use strict';
Dawnwalker.createGlobalSearch=model=>{
  const {$,esc}=model,N=Dawnwalker.navigation,panel=$('global-search-results-popup'),input=$('global-search-input'),controls=$('global-search-controls'),toggle=$('global-search-toggle'),masthead=document.querySelector('.masthead');
  let index=null,loading=null,timer,ticket=0,limits={};
  const isOpen=()=>!controls.hidden;
  function close(focus=false){
    ++ticket;clearTimeout(timer);panel.hidden=true;controls.hidden=true;toggle.hidden=false;toggle.setAttribute('aria-expanded','false');masthead.classList.remove('search-expanded');
    if(focus)toggle.focus({preventScroll:true});
  }
  async function load(){
    if(index)return index;
    if(!loading)loading=fetch(new URL('assets/data/search-index.json',document.baseURI)).then(r=>{if(!r.ok)throw Error('search');return r.json();}).then(data=>index=data.items).finally(()=>loading=null);
    return loading;
  }
  function render(){
    const term=N.fold(input.value),words=term.split(/\s+/).filter(Boolean),results=$('global-search-results');results.replaceChildren();
    if(!words.length){panel.hidden=true;$('global-search-status').textContent='';return;}
    panel.hidden=false;
    const rows=index.filter(r=>words.every(w=>N.fold(r.terms).includes(w)));
    const rank=r=>[r.name,r.en].some(n=>N.fold(n)===term)?0:[r.name,r.en].some(n=>N.fold(n).startsWith(term))?1:2;
    $('global-search-status').textContent=rows.length?`找到 ${rows.length} 项结果`:'未找到相符的内容。请尝试其他名称或关键词。';
    for(const section of Object.keys(N.labels)){
      const group=rows.filter(r=>r.section===section).sort((a,b)=>rank(a)-rank(b)),limit=limits[section]||10;if(!group.length)continue;
      results.insertAdjacentHTML('beforeend',`<section class="search-result-group"><h2>${N.labels[section]} <small>${group.length}</small></h2>${group.slice(0,limit).map(r=>`<a class="search-result" href="${esc(r.href)}"><strong>${esc(r.name)}</strong><small>${esc(r.category)}${r.en?' · '+esc(r.en):''}</small><span>${esc(r.description)}</span></a>`).join('')}${group.length>limit?`<wa-button appearance="outlined" size="s" type="button" data-more="${section}">显示更多</wa-button>`:''}</section>`);
    }
    Dawnwalker.ui.enhance(results);
  }
  async function search(reset=true){
    const current=++ticket;if(reset)limits={};
    if(!input.value.trim()){panel.hidden=true;$('global-search-results').replaceChildren();$('global-search-status').textContent='';return;}
    try{await load();if(current===ticket&&isOpen())render();}
    catch{if(current!==ticket||!isOpen())return;panel.hidden=false;$('global-search-status').textContent='搜索加载失败。请检查网络连接后重试。';$('global-search-results').innerHTML='<wa-button appearance="outlined" size="s" id="retry-search" type="button">重新加载</wa-button>';Dawnwalker.ui.enhance($('global-search-results'));}
  }
  toggle.addEventListener('click',async()=>{
    if($('item-dialog').open){
      const hidden=new Promise(resolve=>{const done=e=>{if(e.target!==$('item-dialog'))return;$('item-dialog').removeEventListener('wa-after-hide',done);resolve();};$('item-dialog').addEventListener('wa-after-hide',done);});
      model.closeItem();await hidden;
    }
    panel.hidden=true;controls.hidden=false;toggle.hidden=true;toggle.setAttribute('aria-expanded','true');masthead.classList.add('search-expanded');
    await input.updateComplete;input.focus({preventScroll:true});search();
  });
  $('close-search').addEventListener('click',()=>close(true));
  input.addEventListener('input',()=>{clearTimeout(timer);++ticket;panel.hidden=true;timer=setTimeout(()=>search(),150);});
  input.addEventListener('focus',()=>{if(input.value.trim())search(false);});
  document.addEventListener('click',e=>{if(!e.composedPath().includes($('header-search')))panel.hidden=true;});
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const first=panel.querySelector('.search-result');if(first){e.preventDefault();first.focus();}}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){e.preventDefault();close(true);}});
  panel.addEventListener('click',e=>{
    const more=e.target.closest('[data-more]');if(more){limits[more.dataset.more]=(limits[more.dataset.more]||10)+10;render();return;}
    if(e.target.closest('#retry-search')){search();return;}
    const a=e.target.closest('a[href]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
    e.preventDefault();e.stopPropagation();const href=a.getAttribute('href');close();model.navigate(href);
  });
};
