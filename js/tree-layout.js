/* Deterministic coordinate transform and orthogonal node avoidance. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.Dawnwalker.treeLayout=factory();
})(typeof window==='undefined'?globalThis:window,()=>{
  'use strict';
  function compactTree(items,dims){
    const nodeWidth=140,nodeHeight=176,traits=items.filter(i=>i.layout.kind!=='ability'),abilities=items.filter(i=>i.layout.kind==='ability');
    const minX=Math.min(...traits.map(i=>i.layout.canvasX)),minY=Math.min(...items.map(i=>i.layout.canvasY));
    let nearest=Infinity;
    for(const y of new Set(traits.map(i=>i.layout.canvasY))){
      const xs=traits.filter(i=>i.layout.canvasY===y).map(i=>i.layout.canvasX).sort((a,b)=>a-b);
      for(let n=1;n<xs.length;n++)if(xs[n]>xs[n-1])nearest=Math.min(nearest,xs[n]-xs[n-1]);
    }
    const scaleX=Math.min(1,148/nearest),x=value=>94+(value-minX)*scaleX;
    const y=value=>130+(value-minY)*240/387.5+(value>=dims.ultimateY?36:0);
    const offsets=new Map(items.map(i=>[i.id,i.tree==='巫术'&&(i.id==='skill-human_fountainofyouth'||i.layout.kind==='ability')?148:0]));
    const traitX=i=>x(i.layout.canvasX)+(offsets.get(i.id)||0);
    const traitRight=Math.max(...traits.map(i=>traitX(i)))+nodeWidth/2;
    const abilityColumns=[...new Set(abilities.map(i=>i.layout.canvasX))].sort((a,b)=>a-b);
    const abilityX=traitRight+32;
    const coordinates=new Map(items.map(i=>[i.id,{x:i.layout.kind==='ability'?abilityX+nodeWidth/2+148*abilityColumns.indexOf(i.layout.canvasX):traitX(i),y:y(i.layout.canvasY)}]));
    const width=Math.ceil(Math.max(...[...coordinates.values()].map(c=>c.x))+94),height=Math.ceil(Math.max(...[...coordinates.values()].map(c=>c.y))+112);
    const bounds=[...coordinates].map(([id,c])=>({id,l:c.x-nodeWidth/2-8,r:c.x+nodeWidth/2+8,t:c.y-nodeHeight/2-8,b:c.y+nodeHeight/2+8}));
    return {coordinates,nodeWidth,nodeHeight,scaleX,width,height,abilityX,ultimateY:y(dims.ultimateY),bounds,offsets};
  }
  function crosses(a,b,rect){
    const e=.001;
    if(Math.abs(a.x-b.x)<e)return a.x>rect.l+e&&a.x<rect.r-e&&Math.max(a.y,b.y)>rect.t+e&&Math.min(a.y,b.y)<rect.b-e;
    return a.y>rect.t+e&&a.y<rect.b-e&&Math.max(a.x,b.x)>rect.l+e&&Math.min(a.x,b.x)<rect.r-e;
  }
  function routeEdge(layout,parent,child){
    const a=layout.coordinates.get(parent),b=layout.coordinates.get(child);
    if(!a||!b)return [];
    const start={x:a.x,y:a.y+layout.nodeHeight/2+8},end={x:b.x,y:b.y-layout.nodeHeight/2-8};
    const middle=parent==='skill-human_bloodcost'?end.y-16:(start.y+end.y)/2,direct=[start,{x:start.x,y:middle},{x:end.x,y:middle},end];
    const clear=(p,q)=>!layout.bounds.some(rect=>crosses(p,q,rect));
    if(direct.slice(1).every((p,i)=>clear(direct[i],p)))return simplify(direct);
    const xs=[...new Set([16,layout.width-16,start.x,end.x,...layout.bounds.flatMap(r=>[r.l,r.r])])].sort((a,b)=>a-b);
    const ys=[...new Set([16,layout.height-16,start.y,end.y,...layout.bounds.flatMap(r=>[r.t,r.b])])].sort((a,b)=>a-b);
    const columns=xs.length,point=id=>({x:xs[id%columns],y:ys[Math.floor(id/columns)]});
    const source=ys.indexOf(start.y)*columns+xs.indexOf(start.x),target=ys.indexOf(end.y)*columns+xs.indexOf(end.x);
    const inside=p=>layout.bounds.some(r=>p.x>r.l+.001&&p.x<r.r-.001&&p.y>r.t+.001&&p.y<r.b-.001);
    const valid=new Map(),allowed=id=>{if(!valid.has(id))valid.set(id,!inside(point(id)));return valid.get(id);};
    const better=(a,b)=>a.length<b.length-.001||(Math.abs(a.length-b.length)<.001&&(a.turns<b.turns||(a.turns===b.turns&&a.key<b.key)));
    const heap=[];
    function push(v){heap.push(v);let n=heap.length-1;while(n){const p=(n-1)>>1;if(!better(heap[n],heap[p]))break;[heap[n],heap[p]]=[heap[p],heap[n]];n=p;}}
    function pop(){const v=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let n=0;while(true){let k=n;for(const c of [n*2+1,n*2+2])if(c<heap.length&&better(heap[c],heap[k]))k=c;if(k===n)break;[heap[n],heap[k]]=[heap[k],heap[n]];n=k;}}return v;}
    const initial={id:source,dir:0,length:0,turns:0,key:source*3},best=new Map([[initial.key,initial]]);push(initial);
    while(heap.length){
      const current=pop();if(best.get(current.key)!==current)continue;
      if(current.id===target){const points=[];for(let c=current;c;c=c.previous)points.push(point(c.id));return simplify(points.reverse());}
      const col=current.id%columns,row=Math.floor(current.id/columns),neighbors=[];
      if(col)neighbors.push([current.id-1,1]);if(col<columns-1)neighbors.push([current.id+1,1]);if(row)neighbors.push([current.id-columns,2]);if(row<ys.length-1)neighbors.push([current.id+columns,2]);
      for(const [id,dir] of neighbors){
        if(!allowed(id)||!clear(point(current.id),point(id)))continue;
        const p=point(current.id),q=point(id),key=id*3+dir;
        const next={id,dir,key,length:current.length+Math.abs(p.x-q.x)+Math.abs(p.y-q.y),turns:current.turns+(current.dir&&current.dir!==dir?1:0),previous:current};
        if(!best.has(key)||better(next,best.get(key))){best.set(key,next);push(next);}
      }
    }
    throw Error(`Cannot route skill edge ${parent} -> ${child}`);
  }
  function simplify(points){return points.filter((p,i)=>{if(i&&p.x===points[i-1].x&&p.y===points[i-1].y)return false;if(!i||i===points.length-1)return true;const a=points[i-1],b=points[i+1];return !(a.x===p.x&&p.x===b.x||a.y===p.y&&p.y===b.y);});}
  const path=points=>points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
  return {compactTree,routeEdge,crosses,path};
});
