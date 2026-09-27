'use strict';
Dawnwalker.createRouter = (model,reader,catalog) => {
  const {data,$,entries,quests,esc,mobile,imageFallback}=model;
  const {renderHome,renderEntry,renderQuest,topLine,bindDisclosure,buildStory,enhanceStory,animateIn}=reader;
  const {renderCatalog}=catalog;
  let current='',currentEntry='',directoryScroll=0,directoryFocus=null;
  // Navigation state is kept in memory for this tab, never in browser storage.
  const views=new Map();let viewKey=0,serial=0,lastHash=null;
  let pendingFrame=0;
  history.scrollRestoration='manual';
  function remember() {
    cancelAnimationFrame(pendingFrame);pendingFrame=0;
    if(!viewKey)return;
    views.set(viewKey,{y:scrollY,side:$('directory').scrollTop,search:$('search').value,category:$('category').value,open:!!$('reader').querySelector('.story-disclosure[open]')});
  }
  function scheduleRemember() {
    if(!pendingFrame) pendingFrame=requestAnimationFrame(remember);
  }

  function route(restore=false) {
    // A queued scroll from the previous view must not overwrite restored state.
    cancelAnimationFrame(pendingFrame);pendingFrame=0;
    const oldReading=document.body.classList.contains('reading');
    const saved=restore ? views.get(history.state?.guideView) : null;
    viewKey=restore && history.state?.guideView || ++serial;
    history.replaceState({...history.state,guideView:viewKey},'');
    lastHash=location.hash;
    if(saved){$('search').value=saved.search;$('category').value=saved.category;}
    let raw='',context='';
    try { const parts=location.hash.slice(1).split('?');raw=decodeURIComponent(parts[0]);context=new URLSearchParams(parts[1]||'').get('in')||''; } catch {raw='invalid';}
    if(raw==='reader') { document.body.classList.add('reading'); $('reader').focus();return; }
    const id=data.aliases[raw]||raw;
    current=id;currentEntry=entries.has(id)?id:'';
    const q=quests.get(id),e=entries.get(id);
    if(q) currentEntry=q.entryIds.includes(context)?context:q.entryIds[0];
    let html;
    if(q) html=renderQuest(q,context);
    else if(e) html=renderEntry(e);
    else if(!id) html=renderHome();
    else html=`${topLine('任务指南')}<div class="no-route"><h1>未找到这个故事</h1><p>可以返回目录，按任务名称继续查找。</p><a href="#">返回目录</a></div>`;
    $('reader').innerHTML=`<div class="reader-inner">${html}</div>`;
    document.title=q?`${q.cn} · 《黎明行者之血》中文任务指南`:e?`${e.title} · 《黎明行者之血》中文任务指南`:'《黎明行者之血》中文任务指南';
    document.body.classList.toggle('reading',!!id);
    const details=$('reader').querySelector('.story-disclosure');
    if(details) bindDisclosure(details,target=>buildStory(q,target),'阅读完整故事（含剧透）');
    $('reader').querySelector('.mobile-back')?.addEventListener('click',()=>navigate(''));
    if(e && !q) {
      const backgrounds=e.sections.filter(s=>s.background.length);
      if(backgrounds.length) {
        const disclosure=document.createElement('details');
        disclosure.className='story-disclosure collection-background';
        disclosure.innerHTML='<summary>阅读集合背景（含剧透）</summary><div class="story"></div>';
        bindDisclosure(disclosure,target=>{target.innerHTML=backgrounds.map(s=>`<section><h2>${esc(s.title)}</h2>${s.background.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('');enhanceStory(target);},'阅读集合背景（含剧透）');
        $('reader').querySelector('.reader-inner').append(disclosure);
      }
    }
    imageFallback($('reader'));
    if(saved) renderCatalog();
    else $('catalog').querySelectorAll('.catalog-link').forEach(a=>{
      if(a.dataset.id===current || a.dataset.id===currentEntry) a.setAttribute('aria-current','page');
      else a.removeAttribute('aria-current');
    });
    animateIn(mobile()&&!id ? $('directory') : $('reader').firstElementChild,mobile()?(id?12:oldReading?-12:0):0);
    if(saved) {
      const disclosure=$('reader').querySelector('.story-disclosure');if(disclosure&&saved.open)disclosure.open=true;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{window.scrollTo(0,saved.y);$('directory').scrollTop=saved.side;}));
    } else if(mobile() && !id) {
      requestAnimationFrame(()=>{window.scrollTo(0,directoryScroll); const target=directoryFocus&&[...$('catalog').querySelectorAll('a')].find(a=>a.getAttribute('href')===directoryFocus);target?.focus({preventScroll:true});});
    } else if(id) {
      window.scrollTo(0,0); $('reader').focus({preventScroll:true});
    }
  }
  $('catalog').addEventListener('click',event=>{const a=event.target.closest('a');if(a){directoryScroll=window.scrollY;directoryFocus=a.getAttribute('href');if(a.hash===location.hash){document.body.classList.add('reading');$('reader').focus();}}});
  function navigate(hash) {
    remember();history.pushState(null,'',hash||location.pathname+location.search);route();
  }
  document.addEventListener('click',event=>{
    const a=event.target.closest('a[href^="#"]');if(!a||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0)return;
    if(a.getAttribute('href')==='#reader')return;
    event.preventDefault();navigate(a.getAttribute('href'));
  });
  window.addEventListener('scroll',scheduleRemember,{passive:true});
  $('directory').addEventListener('scroll',scheduleRemember,{passive:true});
  window.addEventListener('popstate',()=>route(true));
  window.addEventListener('hashchange',()=>{if(lastHash!==location.hash)route();});
  return {remember,getSelection:()=>({current,currentEntry}),start:()=>route()};
};
