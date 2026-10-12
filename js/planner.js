'use strict';
// Pure allocation logic; browser views share one instance for the current tab.
Dawnwalker.createPlanner = items => {
  const byId=new Map(items.map(i=>[i.id,i]));
  let ranks={},previous=null;
  const rank=id=>ranks[id]||0;
  const cost=(item,n)=>item.ranks.slice(0,n).reduce((sum,r)=>sum+r.pointCost,0);
  function totals(state=ranks){
    const result={total:0,巫术:0,剑术:0,血族:0,pools:{}};
    for(const item of items){const spent=cost(item,state[item.id]||0);result.total+=spent;result[item.tree]+=spent;result.pools[item.pointPool]=(result.pools[item.pointPool]||0)+spent;}
    return result;
  }
  function reason(item,n,state=ranks){
    if(n<1||n>item.ranks.length)return '已达到最高等级';
    const parents=item.prerequisites;
    if(parents.length&&!parents.some(p=>(state[p.id]||0)>=1))return '需先学习：'+parents.map(p=>byId.get(p.id).cn).join('或');
    const t=totals(state),req=item.ranks[n-1].requirements;
    const own=cost(item,state[item.id]||0);
    if(t.total-own<req.minSpent)return `其他技能需投入至少 ${req.minSpent} 点`;
    if((t.pools[item.pointPool]||0)<req.minTreeSpent)return `${item.pointPool==='CombatFocus'?'主动能力':item.tree+'特性'}需投入至少 ${req.minTreeSpent} 点`;
    if(item.ultimate&&items.some(i=>i.id!==item.id&&i.ultimate&&i.pointPool===item.pointPool&&(state[i.id]||0)>0))return '此技能树只能学习一个终极特性';
    return '';
  }
  function change(id,delta){
    const item=byId.get(id),before={...ranks};if(!item)return {ok:false,message:'未找到技能'};
    const n=rank(id);
    if(delta>0){const why=reason(item,n+1);if(why)return {ok:false,message:why};ranks[id]=n+1;}
    else {
      if(!n)return {ok:false,message:'尚未投入点数'};
      ranks[id]=n-1;
      // Remove the last purchased rank before checking its original access cost.
      // This prevents a rank from satisfying its own threshold during refunds.
      let changed;
      do{changed=false;for(const candidate of items){
        let current=rank(candidate.id);
        while(current>0){const trial={...ranks,[candidate.id]:current-1};if(!reason(candidate,current,trial))break;ranks[candidate.id]=--current;changed=true;}
      }}while(changed);
    }
    previous=before;
    const affected=items.filter(i=>(ranks[i.id]||0)<(before[i.id]||0)).map(i=>({id:i.id,cn:i.cn,from:before[i.id],to:rank(i.id)}));
    return {ok:true,affected,refund:totals(before).total-totals().total};
  }
  function clear(){if(!totals().total)return false;previous={...ranks};ranks={};return true;}
  function undo(){if(!previous)return false;ranks=previous;previous=null;return true;}
  return {rank,totals,reason,change,clear,undo,canUndo:()=>previous!==null,snapshot:()=>({...ranks})};
};
