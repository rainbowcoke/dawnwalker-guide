'use strict';
Dawnwalker.createReader = (model,remember) => {
  const {entries,quests,types,esc,link,href,portraitList,questRelations}=model;
  function topLine(label) {
    return `<div class="reader-topline"><span class="desktop-label">桑格拉山谷 / 任务指南</span><span>${esc(label)}</span></div>`;
  }
  function card(qid,context) {
    const q=quests.get(qid);
    return `<a class="quest-card" href="${href(qid,context)}"><span class="card-title">${esc(q.cn)}</span><span class="card-en" lang="en">${esc(q.en)}</span><span class="card-intro">${esc(q.intro)}</span></a>`;
  }
  function renderHome() {
    return Dawnwalker.overview.renderHome(model.data,DawnwalkerCounts);
  }
  function renderEntry(e) {
    return `${topLine(e.category)}<p class="eyebrow">${types[e.type]}</p><h1 id="reading-title">${esc(e.title)}</h1><div class="intro-block"><p class="eyebrow">故事开端 · 无剧透简介</p><p class="intro">${esc(e.intro)}</p></div>${portraitList(e.npcs)}<div class="ornament" aria-hidden="true">✧</div>${e.sections.map(s=>`<section class="entry-section"><h2>${esc(s.title)}</h2>${s.intro?`<p class="section-intro">${esc(s.intro)}</p>`:''}${s.questIds.map(qid=>card(qid,e.id)).join('')}</section>`).join('')}${e.related.length?`<div class="related">${e.related.map(id=>link(id,entries.get(id).title)).join('')}</div>`:''}`;
  }
  function renderQuest(q,context) {
    const e=entries.get(q.entryIds.includes(context)?context:q.entryIds[0]);
    const parents=q.entryIds.filter(id=>id!==q.id);
    return `${topLine(e.category)}<p class="eyebrow">任务</p><h1 id="reading-title">${esc(q.cn)}</h1><p class="english" lang="en">${esc(q.en)}</p><div class="intro-block"><p class="eyebrow">故事开端 · 无剧透简介</p><p class="intro">${esc(q.intro)}</p></div>${portraitList(q.npcs)}${parents.length?`<div class="related" aria-label="所属任务线与集合">${parents.map(id=>link(id,'返回 · '+entries.get(id).title)).join('')}</div>`:''}<details class="story-disclosure"><summary>阅读完整故事（含剧透）</summary><div class="story"></div></details>${storyRelations(q)}`;
  }
  function storyRelations(q) {
    const related=questRelations.get(q.id);
    return related.length ? `<section class="story-relations" aria-label="故事关联"><h2>故事关联</h2><div class="related">${related.map(r=>{const id=r.from===q.id?r.to:r.from;return link(id,'相关任务 · '+quests.get(id).cn);}).join('')}</div></section>` : '';
  }
  function buildStory(q, target) {
    target.innerHTML=q.sections.map(s=>`<section><h2>${esc(s.title)}</h2>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')+
      (q.outcomes.length?`<section><h2>结局与不同结果</h2><ul class="outcomes">${q.outcomes.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></section>`:'');
    enhanceStory(target);
  }
  const reduced = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches)document.getAnimations().forEach(a=>a.finish());});
  function animateIn(el, direction=0) {
    if(!reduced()) el.animate([{opacity:0,transform:`translate(${direction}px, ${direction?0:5}px)`},{opacity:1,transform:'none'}],{duration:200,easing:'cubic-bezier(.2,.7,.2,1)'});
  }
  function enhanceStory(target) {
    const headings=[...target.querySelectorAll('section > h2')];
    headings.forEach((h,i)=>{h.id='chapter-'+i;h.tabIndex=-1;});
    if(headings.length>1) {
      const nav=document.createElement('nav');nav.className='chapter-nav';nav.setAttribute('aria-label','本篇目录');
      nav.innerHTML='<span>本篇目录</span>'+headings.map((h,i)=>`<wa-button appearance="plain" data-chapter="${i}">${esc(h.textContent)}</wa-button>`).join('');
      nav.addEventListener('click',event=>{const b=event.target.closest('wa-button');if(!b)return;const h=headings[Number(b.dataset.chapter)];h.focus({preventScroll:true});h.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});});
      target.prepend(nav);
    }
    const close=document.createElement('wa-button');close.appearance='outlined';close.className='close-story';close.textContent='收起故事，返回简介';
    close.addEventListener('click',()=>{const details=target.closest('details');const summary=details.querySelector('summary');summary.scrollIntoView({block:'start'});summary.focus({preventScroll:true});collapse(details);});
    target.append(close);
  }
  function collapse(details) {
    if(details.dataset.closing)return;
    const target=details.querySelector('.story');
    if(reduced()){details.open=false;return;}
    details.dataset.closing='true';
    target.animate([{opacity:1},{opacity:0}],{duration:140,easing:'ease-out'}).finished.then(()=>{if(details.isConnected)details.open=false;delete details.dataset.closing;});
  }
  function bindDisclosure(details,build,closedLabel) {
    details.querySelector('summary').addEventListener('click',event=>{if(details.open){event.preventDefault();collapse(details);}});
    details.addEventListener('toggle',()=>{
      const target=details.querySelector('.story'),summary=details.querySelector('summary');
      if(details.open) {build(target);summary.textContent='收起完整故事';animateIn(target);}
      else {const top=summary.getBoundingClientRect().top;target.replaceChildren();summary.textContent=closedLabel;if(top<0)summary.scrollIntoView({block:'start'});}
      remember();
    });
  }
  return {renderHome,renderEntry,renderQuest,topLine,bindDisclosure,buildStory,enhanceStory,animateIn};
};
