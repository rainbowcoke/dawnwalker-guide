'use strict';
window.Dawnwalker = {};
Dawnwalker.createModel = data => {
  const $ = id => document.getElementById(id);
  const entries = new Map(data.entries.map(e => [e.id, e]));
  const quests = new Map(data.quests.map(q => [q.id, q]));
  const types = {quest:'任务', line:'任务线', collection:'集合'};
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold = v => v.normalize('NFKC').toLocaleLowerCase().trim();
  const mobile = () => matchMedia('(max-width:760px)').matches;
  const href = (id, context = '') => '#' + encodeURIComponent(id) + (context ? '?in=' + encodeURIComponent(context) : '');
  const link = (id, title, context = '') => `<a href="${href(id,context)}">${esc(title)}</a>`;
  function avatar(name) {
    const n = data.npcs[name];
    return `<span class="avatar" aria-hidden="true">${esc(name.slice(0,1))}${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy" width="80" height="80">` : ''}</span>`;
  }
  function portraitList(names) {
    return names.length ? `<div class="npc-list" aria-label="主要人物">${names.map(name=>`<div class="npc">${avatar(name)}<span class="name">${esc(name)}<small lang="en">${esc(data.npcs[name].en)}</small></span></div>`).join('')}</div>` : '';
  }
  function imageFallback(root) {
    root.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
  }
  const npcText = names => names.flatMap(n=>[n,data.npcs[n].en,...(data.npcs[n].aliases||[])]).join(' ');
  const entryText = new Map(data.entries.map(e=>[e.id,fold([e.title,e.intro,...e.searchAliases,npcText(e.npcs)].join(' '))]));
  const questText = new Map(data.quests.map(q=>[q.id,fold([q.id,q.cn,q.en,q.intro,...q.legacyNames,npcText(q.npcs)].join(' '))]));
  const categoryEntries = new Map(data.categories.map(cat => [cat, data.entries.filter(e => e.category === cat)]));
  const entryQuests = new Map(data.entries.map(e => [e.id, [...new Set(e.sections.flatMap(s => s.questIds))]]));
  const questRelations = new Map(data.quests.map(q => [q.id, []]));
  for (const relation of data.relations) {
    questRelations.get(relation.from).push(relation);
    if (relation.to !== relation.from) questRelations.get(relation.to).push(relation);
  }
  return {data,$,entries,quests,types,esc,fold,mobile,href,link,avatar,portraitList,imageFallback,entryText,questText,categoryEntries,entryQuests,questRelations};
};
