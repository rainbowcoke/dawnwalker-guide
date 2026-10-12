"""Validate canonical snapshots and emit only the public catalog fields."""
import json
import math
import os
import re
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
KINDS=('equipment','skills','consumables')
EXPECTED={'equipment':542,'skills':90,'consumables':102}
COMMON={'id','cn','en','category','description','fields','acquisition','icon'}
# Public snapshot fields needed by the website build.
UI_ICONS={'day','night','anytime','skillPoint','learningTime','weight','currency','manual','lock','charge','health','mutation','rank','witchcraft','swordmastery','vampirism'}
CRAFT_CATEGORIES=('治疗物品','强化物品·耐力','强化物品·近战攻击','辅助物品','强化物品·主动能力')

def image_path(image,kind):
    require(isinstance(image,str) and re.fullmatch(r'assets/catalog/'+kind+r'/[a-f0-9]{20}\.webp',image),'Invalid public image path')
    target=(ROOT/image).resolve()
    require(target.is_relative_to((ROOT/'assets/catalog').resolve()),'Image outside site assets')
    require(target.is_file(),'Missing catalog image: '+image)
    with target.open('rb') as handle:header=handle.read(16)
    require(header[:4]==b'RIFF' and header[8:12]==b'WEBP','Invalid WebP image: '+image)

def require(condition,message):
    if not condition:raise ValueError(message)

def keys(value,allowed,required=None):
    require(isinstance(value,dict),'Expected object')
    require(set(value)<=set(allowed),'Unexpected public fields: '+str(set(value)-set(allowed)))
    require(set(required or allowed)<=set(value),'Missing fields: '+str(set(required or allowed)-set(value)))

def positive(value,allow_zero=False):
    require(isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)
            and (value>=0 if allow_zero else value>0),'Invalid numeric value')

def strings(rows):
    require(isinstance(rows,list),'Expected list')
    for value in rows:require(isinstance(value,str) and bool(value.strip()),'Empty text')

def level_rows(rows,equipment=False):
    require(isinstance(rows,list) and len(rows)==50,'Expected all 50 levels')
    for level,row in enumerate(rows,1):
        keys(row,{'level','effects','damage','armor','buy','sell'} if equipment else {'level','effects'}, {'level','effects'})
        require(row['level']==level,'Invalid level order')
        strings(row['effects'])
        if 'damage' in row:
            require(len(row['damage'])==2 and row['damage'][0]<=row['damage'][1],'Invalid damage interval')
            for value in row['damage']:positive(value,True)
        for key in ['armor','buy','sell']:
            if key in row:positive(row[key],True)

def validate(datasets,quests):
    ids={}
    for kind,data in datasets.items():
        keys(data,{'schemaVersion','categories','items','uiIcons'}|({'treeCanvases'} if kind=='skills' else set()))
        require(data['schemaVersion']==3,'Unsupported schema')
        keys(data['uiIcons'],UI_ICONS)
        for image in data['uiIcons'].values():image_path(image,'ui')
        if kind=='skills':
            keys(data['treeCanvases'],{'巫术','剑术','血族'})
            for canvas in data['treeCanvases'].values():
                keys(canvas,{'width','height','traitWidth','ultimateY','abilityX'})
                for value in canvas.values():positive(value)
                require(canvas['traitWidth']==canvas['abilityX']<canvas['width'] and canvas['ultimateY']<canvas['height'],'Invalid canvas geometry')
        strings(data['categories']);require(len(set(data['categories']))==len(data['categories']),'Duplicate categories')
        require(len(data['items'])==EXPECTED[kind],f'{kind}: incomplete inventory')
        ids[kind]={i['id'] for i in data['items']}
        require(len(ids[kind])==len(data['items']),'Duplicate ID')
        for item in data['items']:
            extra={'quality','levels','slot','weaponType','armorType','rarityOrder'} if kind=='equipment' else ({'row','order','ranks','prerequisites','illustration','tree','pointPool','ultimate','layout','manuals','usePhase'} if kind=='skills' else {'quality','effects','conditions','recipes','levelEffects','rarityOrder','usePhase','craftable','craftingCategory','craftingOrder'})
            keys(item,COMMON|extra,(COMMON|extra)-{'levelEffects','illustration'})
            for role in ['icon','illustration']:
                if role not in item:continue
                image_path(item[role],kind)
            require(re.fullmatch(r'(eq|skill|use)-[a-z0-9_]+',item['id']),'Invalid stable ID')
            for key in ['cn','en']:require(isinstance(item[key],str) and bool(item[key].strip()),'Missing name')
            require(re.search(r'[\u3400-\u9fff]',item['cn']) is not None or item['cn']==item['en']=='Noctis Scapulare','Missing Chinese name')
            require(item['category'] in data['categories'],'Unknown category')
            for field in item['fields']:
                keys(field,{'label','value'});strings([field['label'],field['value']])
            for acquisition in item['acquisition']:
                keys(acquisition,{'text','questId'},{'text'});strings([acquisition['text']])
                if 'questId' in acquisition:require(acquisition['questId'] in quests,'Invalid quest link')
            if kind in ['equipment','consumables']:
                require(item['rarityOrder']=={'传说':5,'史诗':4,'大师':3,'卓越':2,'常见':1,'任务':0}.get(item['quality']),'Invalid rarity order')
            if kind in ['skills','consumables']:require(item['usePhase'] in ['anytime','day','night'],'Invalid use phase')
            if kind=='equipment':
                level_rows(item['levels'],True)
                require(item['slot'] in ['武器','上装','下装','护手','靴子','项链','戒指'],'Invalid slot')
                require(item['weaponType']==(item['category'] if item['slot']=='武器' else ''),'Invalid weapon type')
                require(item['armorType'] in ['','轻型','中型','重型'],'Invalid armor type')
                require(bool(item['armorType'])==(item['slot'] in ['上装','下装','护手','靴子']),'Missing armor type')
            elif kind=='skills':
                positive(item['row'],True);positive(item['order'],True)
                require(bool(item['ranks']),'Missing skill ranks');total=0
                require(item['tree'] in ['巫术','剑术','血族'] and item['tree']==item['category'][:2],'Invalid tree')
                require(item['pointPool'] in ['Shared','Human','Vampire','CombatFocus'],'Invalid point pool')
                require(isinstance(item['ultimate'],bool),'Invalid ultimate flag')
                keys(item['layout'],{'row','x','kind','region','canvasX','canvasY','column','frame'})
                positive(item['layout']['row'],True);positive(item['layout']['x'],True)
                require(item['layout']['x']<=1 and item['layout']['kind'] in ['trait','ability'],'Invalid placement')
                require(item['layout']['row']==item['row'] and abs(item['layout']['x']-item['order']/2400)<0.000001,'Layout differs from game positions')
                require(item['layout']['region'] in ['trait','ultimate','ability'] and item['layout']['frame'] in ['circle','diamond'],'Invalid region or frame')
                canvas=data['treeCanvases'][item['tree']]
                positive(item['layout']['canvasX'],True);positive(item['layout']['canvasY'],True)
                require(item['layout']['canvasX']<canvas['width'] and item['layout']['canvasY']<canvas['height'],'Node outside canvas')
                require(isinstance(item['layout']['column'],int) and item['layout']['column']>=0,'Invalid node column')
                require((item['layout']['kind']=='ability')==(item['layout']['region']=='ability'),'Incorrect ability region')
                require((item['layout']['canvasX']>=canvas['abilityX'])==(item['layout']['kind']=='ability'),'Incorrect canvas side')
                require(item['pointPool']==('CombatFocus' if item['layout']['kind']=='ability' else {'巫术':'Human','剑术':'Shared','血族':'Vampire'}[item['tree']]),'Point pool differs from native tree')
                for manual in item['manuals']:
                    keys(manual,{'cn','en','ranks','acquisition'});strings([manual['cn'],manual['en']])
                    require(bool(manual['ranks']) and all(n in range(1,len(item['ranks'])+1) for n in manual['ranks']),'Invalid manual ranks')
                    for acquisition in manual['acquisition']:
                        keys(acquisition,{'text','questId'},{'text'});strings([acquisition['text']])
                        if 'questId' in acquisition:require(acquisition['questId'] in quests,'Invalid manual quest link')
                for rank,row in enumerate(item['ranks'],1):
                    keys(row,{'rank','effects','pointCost','totalPoints','learningTime','conditions','levelEffects','requirements'}, {'rank','effects','pointCost','totalPoints','learningTime','conditions','requirements'})
                    keys(row['requirements'],{'minSpent','minTreeSpent'})
                    for value in row['requirements'].values():positive(value,True)
                    require(row['rank']==rank,'Invalid rank order');positive(row['pointCost'],True);positive(row['learningTime'],True)
                    total+=row['pointCost'];require(row['totalPoints']==total,'Wrong cumulative skill cost')
                    strings(row['effects']);strings(row['conditions']);require(bool(row['effects']),'Missing skill effects')
                    if 'levelEffects' in row:level_rows(row['levelEffects'])
                order=[(data['categories'].index(i['category']),i['row'],i['order']) for i in data['items']]
                require(order==sorted(order),'Skill tree is out of order')
            else:
                strings(item['effects']);strings(item['conditions']);require(bool(item['effects']),'Missing consumable effects')
                require(isinstance(item['craftable'],bool) and item['craftable']==bool(item['recipes']),'Incorrect craftability')
                if item['craftable']:
                    require(item['craftingCategory'] in CRAFT_CATEGORIES and isinstance(item['craftingOrder'],int) and item['craftingOrder']>=0,'Invalid crafting display order')
                else:require(item['craftingCategory']=='' and item['craftingOrder']==-1,'Unexpected crafting category')
                if 'levelEffects' in item:level_rows(item['levelEffects'])
                for recipe in item['recipes']:
                    keys(recipe,{'materials','output','limit','conditions'});positive(recipe['output']);positive(recipe['limit'],True);strings(recipe['conditions'])
                    require(bool(recipe['materials']),'Empty recipe')
                    for material in recipe['materials']:
                        keys(material,{'cn','en','count','icon'});strings([material['cn'],material['en']]);positive(material['count']);image_path(material['icon'],'ingredients')
        if kind=='consumables':
            require(sum(i['craftable'] for i in data['items'])==44,'Incomplete crafting inventory')
            for category in CRAFT_CATEGORIES:
                order=sorted(i['craftingOrder'] for i in data['items'] if i['craftingCategory']==category)
                require(order==list(range(len(order))),'Non-contiguous crafting display order')
    for item in datasets['skills']['items']:
        for prerequisite in item['prerequisites']:
            keys(prerequisite,{'id','cn','en'});require(prerequisite['id'] in ids['skills'],'Missing prerequisite')
            parent=next(i for i in datasets['skills']['items'] if i['id']==prerequisite['id'])
            require(parent['tree']==item['tree'] and parent['layout']['row']<item['layout']['row'],'Invalid parent placement')
    for data in datasets.values():
        text=json.dumps(data,ensure_ascii=False)
        require(not re.search(r'\{[^{}"]+\}|\|plural\(|/Game/|/Script/|\.uasset|\.locres|DA_Trait_|GE_|MMC_|OBSOLETE|TEMP_|\[DB\]',text),'Unresolved text or internal resource reference')
    return ids

def build():
    datasets={kind:json.loads((ROOT/'data/catalog'/f'{kind}.json').read_text(encoding='utf-8')) for kind in KINDS}
    source=json.loads((ROOT/'data/guide-source.json').read_text(encoding='utf-8'))
    quests={qid for entry in source['navigation']['entries'] for section in entry['sections'] for qid in section['questIds']}
    ids=validate(datasets,quests)
    rewards=json.loads((ROOT/'data/catalog/quest-rewards.json').read_text(encoding='utf-8'))
    expected={}
    for kind,data in datasets.items():
        for item in data['items']:
            for acquisition in item['acquisition']:
                if acquisition.get('questId'):
                    expected.setdefault(acquisition['questId'],[]).append({'section':kind,**{k:item[k] for k in ['id','cn','en']},'condition':acquisition['text']})
    require(rewards==expected,'Quest reward index is not bidirectional')
    datasets['quest-rewards']=rewards
    target=ROOT/'assets/data';target.mkdir(parents=True,exist_ok=True)
    for kind,data in datasets.items():
        output=target/f'{kind}.json'
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',newline='\n',dir=target,suffix='.tmp',delete=False) as handle:
            temp=Path(handle.name);json.dump(data,handle,ensure_ascii=False,separators=(',',':'));handle.write('\n');handle.flush();os.fsync(handle.fileno())
        temp.replace(output)
    print('Validated catalogs: '+', '.join(f'{kind} {len(ids[kind])}' for kind in KINDS))

if __name__=='__main__':build()
