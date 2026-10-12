'use strict';
Dawnwalker.createRouter=(model,reader,catalog,references)=>{
  const {$,entries,quests,esc,imageFallback}=model,N=Dawnwalker.navigation;
  const {renderHome,renderEntry,renderQuest,topLine,bindDisclosure,buildStory,enhanceStory,animateIn}=reader;
  const views=new Map();let viewKey=0,serial=0,lastLocation='',generation=0,busy=false,pending=0;
  history.scrollRestoration='manual';
  const root=()=>new URL('.',document.baseURI).pathname;
  function remember(){
    cancelAnimationFrame(pending);pending=0;if(!viewKey||busy)return;
    views.set(viewKey,{y:scrollY,reference:references.capture(),task:catalog.capture(),open:!!$('reader').querySelector('.story-disclosure[open]')});
  }
  model.remember=remember;
  async function route(restore=false){
    const ticket=++generation;busy=true;cancelAnimationFrame(pending);pending=0;
    const saved=restore?views.get(history.state?.guideView):null;
    viewKey=restore&&history.state?.guideView||++serial;
    history.replaceState({...history.state,guideView:viewKey},'');
    lastLocation=location.pathname+location.hash;
    let raw='',context='';
    try{const parts=location.hash.slice(1).split('?');raw=decodeURIComponent(parts[0]);context=new URLSearchParams(parts[1]||'').get('in')||'';}catch{raw='invalid';}
    if(raw==='reader'){busy=false;$('reader').focus();return;}
    const ref=references.parseLocation();
    let y=saved?.y||0;
    if(ref){
      lastLocation=location.pathname+location.hash;
      const previousPath=references.listPath();await references.enter(ref,saved?.reference,()=>catalog.leave());
      if(ticket!==generation)return;
      y=saved?.y??(ref.id||previousPath===references.listPath()?scrollY:references.directoryY());
    }else{
      references.leave();catalog.leave();
      const path=N.parse(location.pathname.slice(root().length));
      const id=raw,q=quests.get(id),e=entries.get(id);
      const currentEntry=q?(q.entryIds.includes(context)?context:q.entryIds[0]):e?.id||'';
      const category=entries.get(currentEntry)?.category;
      const taskPage=N.pages.find(p=>p.section==='quests'&&p.label===category);
      const listing=!id&&path?.section==='quests'&&!path.id;
      document.body.classList.toggle('home',!id&&!listing);document.body.classList.toggle('reading',!!id||listing);
      if(listing){const priorY=catalog.enter(path,saved?.task);y=saved?.y??priorY;}
      else{
        const html=q?renderQuest(q,context):e?renderEntry(e):!id&&!path?renderHome():`${topLine('任务指南')}<div class="no-route"><h1>未找到这个故事</h1><p>可以返回任务列表，按名称继续查找。</p><a href="quests/">返回任务列表</a></div>`;
        if(ticket!==1||id||path||!$('reader').querySelector('.home-overview'))$('reader').innerHTML=`<div class="reader-inner">${html}</div>`;
        Dawnwalker.ui.enhance($('reader'));
        if(taskPage)$('reader').querySelector('.reader-topline')?.insertAdjacentHTML('afterbegin',`<a class="task-back" href="${taskPage.path}">${Dawnwalker.presentation.icon('arrow-left')}返回${taskPage.label}</a>`);
        if(q)references.addQuestRewards(q.id,()=>ticket===generation);
        const details=$('reader').querySelector('.story-disclosure');if(details)bindDisclosure(details,target=>buildStory(q,target),'阅读完整故事（含剧透）');
        if(e&&!q){
          const backgrounds=e.sections.filter(s=>s.background.length);
          if(backgrounds.length){
            const disclosure=document.createElement('details');disclosure.className='story-disclosure collection-background';
            disclosure.innerHTML='<summary>阅读集合背景（含剧透）</summary><div class="story"></div>';
            bindDisclosure(disclosure,target=>{target.innerHTML=backgrounds.map(s=>`<section><h2>${esc(s.title)}</h2>${s.background.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('');enhanceStory(target);},'阅读集合背景（含剧透）');
            $('reader').querySelector('.reader-inner').append(disclosure);
          }
        }
        if(saved?.open&&$('reader').querySelector('.story-disclosure'))$('reader').querySelector('.story-disclosure').open=true;
      }
      const title=q?.cn||e?.title||(listing?path.page?.label||'任务总览':'');
      document.title=(title?title+' · ':'')+'《黎明行者之血》中文游戏指南';
      document.querySelector('link[rel=canonical]').href='https://rainbowcoke.github.io/dawnwalker-guide/'+(id?'#'+encodeURIComponent(id):listing?path.page?.path||'quests/':'');
      document.querySelector('meta[name=description]').content=q?.intro||e?.intro||'《黎明行者之血》中文游戏指南：查询任务、装备、技能与消耗品。';
      N.mark(id||listing?'quests':'',taskPage?.path||path?.page?.path);imageFallback($('reader'));if(id)animateIn($('reader').firstElementChild,0);
    }
    if(ticket!==generation)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ticket!==generation)return;window.scrollTo(0,y);busy=false;remember();}));
  }
  function navigate(href,replace=false){
    remember();const destination=new URL(href||'.',document.baseURI),target=references.parseRoute(destination.pathname.slice(root().length));
    const sameModal=!!target?.id&&!!references.selected();
    const state=target?.id?{guideModal:true,originKey:sameModal?history.state?.originKey:viewKey,originPath:sameModal?history.state?.originPath:references.listPath()}:{};
    history[sameModal||replace?'replaceState':'pushState'](state,'',destination.href);route();
  }
  model.closeItem=()=>{if(history.state?.guideModal&&views.has(history.state.originKey))history.back();else navigate(root()+references.listPath(),true);};
  model.navigate=navigate;
  document.addEventListener('click',event=>{
    if(event.composedPath().some(el=>el instanceof Element&&el.matches('wa-dropdown-item')))return;
    const a=event.composedPath().find(el=>el instanceof Element&&el.matches('a[href],wa-button[href],wa-dropdown-item[href]')); if(!a||a.target==='_blank'||a.hasAttribute('download')||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||a.getAttribute('href')==='#reader')return;
    const destination=new URL(a.getAttribute('href'),document.baseURI);
    if(destination.origin!==location.origin||!destination.pathname.startsWith(root()))return;
    const path=destination.pathname.slice(root().length);
    if(destination.pathname!==root()&&!N.parse(path)&&!destination.hash)return;
    event.preventDefault();navigate(a.getAttribute('href'));
  });
  window.addEventListener('scroll',()=>{if(!pending)pending=requestAnimationFrame(remember);},{passive:true});
  window.addEventListener('popstate',()=>route(true));
  window.addEventListener('hashchange',()=>{if(lastLocation!==location.pathname+location.hash)route();});
  return {remember,start:()=>route()};
};
