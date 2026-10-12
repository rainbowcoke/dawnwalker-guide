/* Shared route definitions for browser navigation and the static build. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Dawnwalker.navigation=factory();
})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  const labels={quests:'任务',equipment:'装备',skills:'技能',consumables:'消耗品'};
  const definitions={
    quests:[['main-story','主线与结局'],['character-lines','人物任务线'],['standalone','独立任务'],['court-activities','宫廷活动'],['exploration','探索集合']],
    equipment:[['weapons','武器'],['upper-body','上装'],['lower-body','下装'],['gloves','护手'],['boots','靴子'],['necklaces','项链'],['rings','戒指']],
    skills:[['witchcraft','巫术','witchcraft'],['swordsmanship','剑术','swordmastery'],['vampirism','血族','vampirism']],
    consumables:[['craftable','制作'],['non-craftable','非制作']]
  };
  const pages=Object.entries(definitions).flatMap(([section,rows])=>rows.map(([slug,label,icon])=>({section,slug,label,icon,path:`${section}/${slug}/`})));
  const fold=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().trim();
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function parse(raw){
    const parts=raw.replace(/index\.html$/,'').split('/').filter(Boolean),section=parts[0];
    if(!labels[section])return null;
    if(parts.length>2)return null;
    const page=pages.find(p=>p.section===section&&p.slug===parts[1]);
    return {section,slug:page?.slug||'',id:page?'':parts[1]||'',page};
  }
  function matches(page,item){
    if(!page)return true;
    if(page.section==='quests')return item.category===page.label;
    if(page.section==='equipment')return item.slot===page.label;
    if(page.section==='skills')return item.tree===page.label;
    return item.craftable===(page.slug==='craftable');
  }
  function forItem(section,item){return pages.find(p=>p.section===section&&matches(p,item));}
  function menu(uiIcons={}){
    return Object.keys(labels).map(section=>{
      const children=pages.filter(p=>p.section===section);
      const content=p=>`${p.icon&&uiIcons[p.icon]?`<img src="${esc(uiIcons[p.icon])}" alt="" class="game-symbol" slot="icon">`:''}<span>${p.label}</span>`;
      return `<div class="nav-group"><wa-dropdown class="nav-dropdown" placement="bottom-start" distance="6"><a slot="trigger" class="nav-label" data-section="${section}" href="${section}/">${labels[section]}</a>${children.map(p=>`<wa-dropdown-item href="${p.path}" data-page="${p.path}">${content(p)}</wa-dropdown-item>`).join('')}</wa-dropdown><div class="nav-fallback">${children.map(p=>`<a href="${p.path}">${content(p)}</a>`).join('')}</div></div>`;
    }).join('');
  }
  function tasks(data,page,term='',person=''){
    const needle=fold(term),used=new Set(),rows=[];
    const npcs=names=>names.flatMap(n=>[n,data.npcs[n]?.en,...(data.npcs[n]?.aliases||[])]);
    for(const entry of data.entries.filter(e=>matches(page,e))){
      const text=fold([entry.title,entry.intro,...entry.searchAliases,...npcs(entry.npcs)].join(' '));
      const hit=(!needle||text.includes(needle))&&(!person||entry.npcs.includes(person));
      if(hit&&!used.has(entry.id)){used.add(entry.id);rows.push({id:entry.id,title:entry.title,intro:entry.intro,category:entry.category,type:entry.type,npcs:entry.npcs,href:'#'+encodeURIComponent(entry.id)});}
      if(needle||person)for(const id of new Set(entry.sections.flatMap(s=>s.questIds))){
        const q=data.quests.find(q=>q.id===id);
        if(!q||used.has(id))continue;
        if((!needle||hit||fold([q.cn,q.en,q.intro,...npcs(q.npcs)].join(' ')).includes(needle))&&(!person||q.npcs.includes(person))){
          used.add(id);rows.push({id,title:q.cn,en:q.en,intro:q.intro,category:entry.category,type:'quest',npcs:q.npcs,href:'#'+encodeURIComponent(id)+'?in='+encodeURIComponent(entry.id)});
        }
      }
    }
    return rows;
  }
  function taskCards(rows,data){
    return rows.map(row=>`<a class="catalog-link task-list-card" href="${esc(row.href)}" data-id="${esc(row.id)}">${row.npcs[0]&&data.npcs[row.npcs[0]]?.img?`<span class="avatar" aria-hidden="true">${esc(row.npcs[0].slice(0,1))}<img src="${esc(data.npcs[row.npcs[0]].img)}" alt="" loading="lazy"></span>`:'<span class="index-mark" aria-hidden="true">◇</span>'}<span class="catalog-copy"><strong>${esc(row.title)}</strong><small>${esc(row.en||row.category)}</small><span class="card-intro">${esc(row.intro)}</span></span><span class="arrow" aria-hidden="true"><i data-lucide="arrow-right" aria-hidden="true"></i></span></a>`).join('');
  }
  function start(navigate){
    let timer;
    const groups=[...document.querySelectorAll('.nav-group')];
    const states=new Map(groups.map(g=>[g,{hiding:false,pending:false,focusEdge:null}]));
    function close(except){clearTimeout(timer);for(const g of groups){if(g===except)continue;states.get(g).pending=false;g.classList.remove('expanded');g.querySelector('wa-dropdown').open=false;}}
    function open(g){close(g);const state=states.get(g);g.classList.add('expanded');if(state.hiding)state.pending=true;else{state.pending=false;g.querySelector('wa-dropdown').open=true;}}
    for(const g of groups){
      const dropdown=g.querySelector('wa-dropdown');
      g.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){clearTimeout(timer);open(g);}});
      g.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){clearTimeout(timer);timer=setTimeout(close,150);}});
      dropdown.addEventListener('wa-show',()=>{clearTimeout(timer);g.classList.add('expanded');});
      dropdown.addEventListener('wa-hide',()=>{states.get(g).hiding=true;g.classList.remove('expanded');});
      dropdown.addEventListener('wa-after-hide',()=>{const state=states.get(g);state.hiding=false;if(state.pending)open(g);});
      dropdown.addEventListener('wa-after-show',()=>{
        const state=states.get(g);if(!state.focusEdge)return;
        const items=[...dropdown.querySelectorAll('wa-dropdown-item')];
        (state.focusEdge==='last'?items.at(-1):items[0])?.focus();state.focusEdge=null;
      });
      g.addEventListener('focusout',e=>{if(!g.contains(e.relatedTarget))close();});
      const label=g.querySelector('.nav-label');
      label.addEventListener('click',e=>{
        close();e.stopPropagation();
        if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button!==0)return;
        e.preventDefault();navigate(label.getAttribute('href'));
      });
      label.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.stopPropagation();if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();close();navigate(label.getAttribute('href'));}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){
          e.preventDefault();e.stopPropagation();states.get(g).focusEdge=e.key==='ArrowUp'?'last':'first';open(g);
        }
      });
      let modified=false,newTab=false;
      const record=e=>{modified=!!(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey);newTab=!!(e.ctrlKey||e.metaKey||e.shiftKey);};
      dropdown.addEventListener('click',record,{capture:true});
      dropdown.addEventListener('keydown',record,{capture:true});
      dropdown.addEventListener('pointerdown',e=>{if(e.button===1&&e.composedPath().some(el=>el instanceof Element&&el.matches('wa-dropdown-item[href]')))e.preventDefault();});
      dropdown.addEventListener('auxclick',e=>{
        const item=e.composedPath().find(el=>el instanceof Element&&el.matches('wa-dropdown-item[href]'));
        if(e.button!==1||!item||item.disabled)return;e.preventDefault();close();window.open(new URL(item.href,document.baseURI).href,'_blank','noopener');
      });
      dropdown.addEventListener('wa-select',e=>{
        const item=e.detail?.item;
        if(!item?.href)return;
        if(newTab){e.preventDefault();close();window.open(new URL(item.href,document.baseURI).href,'_blank','noopener');return;}
        if(modified)return;
        e.preventDefault();close();navigate(item.href);
      });
    }
    window.addEventListener('popstate',close);
  }
  function mark(section,path=''){
    document.querySelectorAll('.nav-label').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    document.querySelectorAll('[data-page]').forEach(a=>{if(a.dataset.page===path)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }
  return {labels,pages,fold,esc,parse,matches,forItem,menu,tasks,taskCards,start,mark};
});
