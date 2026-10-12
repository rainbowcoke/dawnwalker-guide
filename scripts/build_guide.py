"""Validate the guide source and generate the task reader data."""
import json
import os
import tempfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def load(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
def build():
    source=load('data/guide-source.json')
    assert source['schemaVersion']==1
    assert set(source)=={'schemaVersion','quests','navigation','npcs'}
    raw=source['quests']; inventory={q['id']:q for q in raw}
    assert len(inventory)==len(raw)
    narratives={q['id']:q['narrative'] for q in raw}
    assert narratives.keys()==inventory.keys()
    nav=source['navigation']; entries=nav['entries']; entry_ids={e['id'] for e in entries}
    assert len(entry_ids)==len(entries)
    memberships,summaries={},{}
    for e in entries:
        assert e['category'] in nav['categories'] and e['type'] in ['quest','line','collection']
        assert all(i in entry_ids for i in e['related'])
        for s in e['sections']:
            assert s['questIds'] and len(set(s['questIds']))==len(s['questIds'])
            for qid in s['questIds']:
                assert qid in inventory
                memberships.setdefault(qid,[]).append(e['id'])
            for qid in s.get('summaryIds',[]):
                assert qid in inventory and qid not in summaries
                summaries[qid]=e['id']
        if e['type']=='quest': assert [i for s in e['sections'] for i in s['questIds']]==[e['id']]
    archived=set(nav['archiveOnly'])
    assert not (memberships.keys() & summaries.keys() or memberships.keys() & archived or summaries.keys() & archived)
    assert memberships.keys() | summaries.keys() | archived == inventory.keys(), 'Every record needs a disposition'
    for r in nav['relations']: assert r['from'] in memberships and r['to'] in memberships
    npc_data=source['npcs']; used_npcs={n for e in entries for n in e['npcs']}
    assert used_npcs <= npc_data.keys()
    npcs={n:{'en':npc_data[n]['en'],'img':npc_data[n].get('portrait',''),'aliases':npc_data[n].get('aliases',[])} for n in sorted(used_npcs)}
    for npc in npcs.values():
        if npc['img']:
            image=(ROOT/npc['img']).resolve()
            assert image.is_relative_to((ROOT/'assets/npcs').resolve()) and image.is_file(), npc['img']
    public_quests=[]
    for q in raw:
        qid=q['id']
        if qid not in memberships: continue
        n=narratives[qid]; assert n['intro'] and n['story'],qid
        sections=n.get('sections',[{'title':'任务流程','paragraphs':n['story']}])
        assert all(s['paragraphs'] for s in sections)
        outcomes=list(dict.fromkeys(o['text'] for o in q['outcomes'] if o.get('text')))
        public_quests.append({'id':qid,'cn':q['cn'] or q['en'],'en':q['en'],
            'intro':n['intro'],'sections':sections,'outcomes':outcomes,'entryIds':memberships[qid],
            'npcs':list(dict.fromkeys(name for e in entries if e['id'] in memberships[qid] for name in e['npcs']))})
    public_entries=[]
    for e in entries:
        out={k:e[k] for k in ['id','title','intro','type','category','npcs','related']}
        out['sections']=[{'title':s['title'],'questIds':s['questIds'],'intro':s.get('intro',' '.join(narratives[i]['intro'] for i in s.get('summaryIds',[]))),
            'background':[p for i in s.get('summaryIds',[]) for p in narratives[i]['story']]} for s in e['sections']]
        out['searchAliases']=[inventory[i]['cn']+' '+inventory[i]['en'] for i,target in summaries.items() if target==e['id']]
        public_entries.append(out)
    public={'categories':nav['categories'],'entries':public_entries,'quests':public_quests,'npcs':npcs,'relations':nav['relations']}
    payload=json.dumps(public,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    # Replace only after validation and a complete write in the same filesystem.
    output=ROOT/'assets/guide-data.js'
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='\n',
                                         dir=output.parent,suffix='.tmp',delete=False) as handle:
            temporary=Path(handle.name)
            handle.write('window.DawnwalkerData='+payload+';\n')
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f'Built {len(public_quests)} stories / {len(entries)} entries; all {len(raw)} records accounted for.')
if __name__=='__main__': build()
