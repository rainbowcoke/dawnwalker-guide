const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sandbox={Dawnwalker:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/planner.js'),'utf8'),sandbox);
const make=sandbox.Dawnwalker.createPlanner;
const skill=(id,{parents=[],costs=[1],gate=0,pool='Shared',tree='剑术',ultimate=false}={})=>({id,cn:id,tree,pointPool:pool,ultimate,prerequisites:parents.map(id=>({id})),ranks:costs.map(pointCost=>({pointCost,requirements:{minSpent:0,minTreeSpent:gate}}))});
const a=skill('a',{costs:[1,2,3]}),b=skill('b',{parents:['a'],costs:[2,3]}),c=skill('c',{parents:['b']});
let p=make([a,b,c]);
assert(p.reason(b,1).includes('a'));assert(!p.change('b',1).ok);
assert(p.change('a',1).ok);assert(p.change('b',1).ok);assert(p.change('c',1).ok);
assert.equal(p.totals().total,4);
assert(p.change('a',1).ok);assert.equal(p.totals().total,6);assert(p.change('a',1).ok);assert.equal(p.totals().total,9);
assert(!p.change('a',1).ok);assert.equal(p.rank('a'),3);
p.change('a',-1);p.change('a',-1);const refund=p.change('a',-1);
assert.equal(refund.refund,4);assert.equal(refund.affected.length,3);assert.equal(p.totals().total,0);
p.undo();assert.equal(p.totals().total,4);assert.equal(p.rank('c'),1);assert(!p.canUndo());
p.clear();assert.equal(p.totals().total,0);p.undo();assert.equal(p.totals().total,4);
const support=skill('support',{costs:[3,2]}),u=skill('u',{gate:5,costs:[2],ultimate:true}),v=skill('v',{gate:5,ultimate:true});
p=make([support,u,v]);assert(!p.change('u',1).ok);p.change('support',1);p.change('support',1);assert(p.change('u',1).ok);assert(p.reason(v,1).includes('终极'));
const cascade=p.change('support',-1);assert.equal(cascade.refund,4);assert.equal(p.rank('u'),0);p.undo();assert.equal(p.rank('u'),1);
// Costs from a different native SkillTree do not open this tree's gate.
const other=skill('other',{costs:[10],tree:'巫术',pool:'Human'});
p=make([support,u,other]);p.change('other',1);assert(!p.change('u',1).ok);assert.equal(p.totals().巫术,10);
// ParentSkills is any purchased parent, and does not require maxing it.
p=make([a,other,skill('either',{parents:['a','other']})]);p.change('other',1);assert(p.change('either',1).ok);
// A rank must not pay its own access requirement.
p=make([skill('gate',{gate:1,costs:[4]})]);assert(!p.change('gate',1).ok);
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/catalog/skills.json'),'utf8')).items;
p=make(data);
// Explore a complete real-game build, then refund every skill. Every intermediate
// allocation must satisfy prerequisites, pool gates and ultimate exclusivity.
let changed=true;while(changed){changed=false;for(const item of data)if(p.change(item.id,1).ok)changed=true;}
assert(p.totals().total>100);
const valid=()=>{const state=p.snapshot();for(const i of data){const n=state[i.id]||0;if(n)assert.equal(p.reason(i,n,{...state,[i.id]:n-1}),'',i.id);}};
valid();
for(const item of [...data].reverse()){while(p.rank(item.id)>0){p.change(item.id,-1);valid();}}
assert.equal(p.totals().total,0);
console.log('PASS planner costs, max ranks, any-parent unlock, native point pools, ultimate exclusion, cascading refunds, undo and all real skill allocations');
