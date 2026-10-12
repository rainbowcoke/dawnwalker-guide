"""Test public snapshot invariants, invalid data and catalog regressions."""
import copy
import json
import unittest
from build_catalog import ROOT, KINDS, CRAFT_CATEGORIES, validate

class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data={kind:json.loads((ROOT/'data/catalog'/f'{kind}.json').read_text(encoding='utf-8')) for kind in KINDS}
        source=json.loads((ROOT/'data/guide-source.json').read_text(encoding='utf-8'))
        cls.quests={q['id'] for q in source['quests']}

    def test_inventory(self):validate(self.data,self.quests)

    def test_player_filters_match_game_fields(self):
        for item in self.data['equipment']['items']:
            fields={f['label']:f['value'] for f in item['fields']}
            self.assertEqual(item['slot'],fields['装备槽位'])
            self.assertEqual(item['armorType'],fields.get('护甲类型',''))
            self.assertEqual(item['weaponType'],item['category'] if item['slot']=='武器' else '')

    def test_tree_order_and_dependencies(self):
        by_id={i['id']:i for i in self.data['skills']['items']}
        for item in by_id.values():
            self.assertEqual(item['layout']['row'],item['row'])
            self.assertAlmostEqual(item['layout']['x'],item['order']/2400,places=5)
            for p in item['prerequisites']:
                parent=by_id[p['id']]
                self.assertEqual(parent['tree'],item['tree'])
                self.assertLess(parent['layout']['row'],item['layout']['row'])

    def test_verified_manuals_and_public_fields(self):
        by_id={i['id']:i for i in self.data['skills']['items']}
        life=by_id['skill-combatfocus_lifelock']['manuals'][0]
        self.assertTrue(any('梅瓦瑟' in a['text'] and '西拉之书' in a['text'] for a in life['acquisition']))
        flock=by_id['skill-combatfocus_stonemandisease']['manuals'][0]
        self.assertEqual(len(flock['acquisition']),4)
        self.assertTrue(all('力量的巡礼' in a['text'] for a in flock['acquisition']))

    def test_noctis_keeps_official_name(self):
        item=next(i for i in self.data['equipment']['items'] if i['en']=='Noctis Scapulare')
        self.assertEqual(item['cn'],'Noctis Scapulare')

    def test_price_unit_matches_game_localization(self):
        fields=[f for kind in ['equipment','consumables'] for item in self.data[kind]['items'] for f in item['fields'] if '价格' in f['label']]
        self.assertTrue(fields)
        self.assertTrue(all(f['value'].endswith(' 第纳尔') for f in fields))

    def test_every_entry_has_official_image(self):
        for kind,data in self.data.items():
            for item in data['items']:
                self.assertTrue((ROOT/item['icon']).is_file())
                if kind=='skills':self.assertTrue((ROOT/item['illustration']).is_file())

    def test_percentage_precision_is_preserved(self):
        item=next(i for i in self.data['equipment']['items'] if i['id']=='eq-sworddawnwalker5a')
        self.assertIn('武器暴击伤害 +19.5%',item['levels'][39]['effects'])
        self.assertIn('对超自然敌人伤害 +20.8%',item['levels'][39]['effects'])

    def test_complete_game_canvas_and_passive_ability_shapes(self):
        data=self.data['skills'];items=data['items']
        self.assertEqual(sum(i['layout']['region']=='ultimate' for i in items),9)
        self.assertEqual(sum(i['layout']['region']=='trait' for i in items),54)
        self.assertEqual(sum(i['layout']['region']=='ability' for i in items),27)
        self.assertEqual(sum(i['layout']['kind']=='ability' and i['layout']['frame']=='circle' for i in items),10)
        for tree in data['treeCanvases']:
            nodes=[i for i in items if i['tree']==tree]
            for row in range(5):
                self.assertEqual(len({i['layout']['canvasY'] for i in nodes if i['layout']['kind']=='trait' and i['row']==row}),1)
            abilities=[i for i in nodes if i['layout']['kind']=='ability']
            self.assertTrue(all(i['layout']['column'] in [0,1] for i in abilities))
            self.assertEqual(len({(i['layout']['canvasX'],i['layout']['canvasY']) for i in nodes}),len(nodes))

    def test_crafting_order_and_phase_fields(self):
        items=self.data['consumables']['items']
        self.assertEqual(sum(i['craftable'] for i in items),44)
        self.assertEqual([sum(i['craftingCategory']==c for i in items) for c in CRAFT_CATEGORIES],[12,6,10,7,9])
        for category in CRAFT_CATEGORIES:
            ordered=sorted([i for i in items if i['craftingCategory']==category],key=lambda i:i['craftingOrder'])
            self.assertEqual([i['craftingOrder'] for i in ordered],list(range(len(ordered))))
            for phase in ['anytime','day','night']:
                filtered=[i for i in ordered if i['usePhase']==phase]
                self.assertEqual([i['craftingOrder'] for i in filtered],sorted(i['craftingOrder'] for i in filtered))
        for item in items:
            field=next(f for f in item['conditions'] if '形态' in f)
            self.assertEqual(item['usePhase'],{'仅人类形态可使用':'day','仅血族形态可使用':'night','人类和血族形态均可使用':'anytime'}[field])

    def test_bad_data_is_rejected(self):
        for change in ['placeholder','missing-level','private-field','cumulative-cost','missing-material','bad-quest','missing-image','unsafe-image','armor-type','bad-pool','bad-parent','bad-layout']:
            data=copy.deepcopy(self.data)
            if change=='placeholder':data['skills']['items'][0]['ranks'][0]['effects']=['造成{AbilityDamage}伤害']
            elif change=='missing-level':data['equipment']['items'][0]['levels'].pop()
            elif change=='private-field':data['equipment']['items'][0]['evidence']='/Game/private'
            elif change=='cumulative-cost':data['skills']['items'][0]['ranks'][0]['totalPoints']+=1
            elif change=='missing-material':next(i for i in data['consumables']['items'] if i['recipes'])['recipes'][0]['materials']=[]
            elif change=='bad-quest':data['equipment']['items'][0]['acquisition'].append({'text':'任务奖励','questId':'q-invalid'})
            elif change=='missing-image':data['equipment']['items'][0]['icon']='assets/catalog/equipment/'+'0'*20+'.webp'
            elif change=='unsafe-image':data['equipment']['items'][0]['icon']='../private.webp'
            elif change=='armor-type':next(i for i in data['equipment']['items'] if i['armorType'])['armorType']='轻甲'
            elif change=='bad-pool':data['skills']['items'][0]['pointPool']='CombatFocus'
            elif change=='bad-parent':data['skills']['items'][0]['prerequisites']=[{k:data['skills']['items'][0][k] for k in ['id','cn','en']}]
            elif change=='bad-layout':data['skills']['items'][0]['layout']['x']=0.9
            with self.subTest(change=change),self.assertRaises(ValueError):validate(data,self.quests)

    def test_dynamic_skill_endpoints(self):
        item=next(i for i in self.data['skills']['items'] if i['id']=='skill-combatfocus_boilingblood')
        self.assertIn('19',item['ranks'][0]['levelEffects'][0]['effects'][0])
        self.assertIn('343',item['ranks'][0]['levelEffects'][-1]['effects'][0])
        item=next(i for i in self.data['skills']['items'] if i['id']=='skill-combatfocus_purulentlimbs')
        self.assertIn('12',item['ranks'][0]['levelEffects'][0]['effects'][0])
        self.assertIn('209',item['ranks'][0]['levelEffects'][-1]['effects'][0])

    def test_poison_consumable_uses_character_level(self):
        items=[i for i in self.data['consumables']['items'] if i.get('levelEffects')]
        self.assertTrue(items)
        for item in items:
            self.assertEqual(len(item['levelEffects']),50)
            self.assertTrue(any('利爪毒素伤害/每秒 +3；' in t for t in item['levelEffects'][0]['effects']))
            self.assertTrue(any('利爪毒素伤害/每秒 +57；' in t for t in item['levelEffects'][-1]['effects']))
            self.assertEqual(item['effects'],item['levelEffects'][-1]['effects'])

if __name__=='__main__':unittest.main()
