"""Build the Pages artifact from a strict allowlist. Never read game resources."""
import shutil
import json
import html
import re
import subprocess
from pathlib import Path
import build_catalog
import build_guide

ROOT=Path(__file__).resolve().parents[1]

def build():
    # Validate both datasets before changing any generated site data.
    build_catalog.build()
    build_guide.build()
    subprocess.run(['node', str(ROOT/'scripts/build_vendor.cjs')],check=True)
    pages=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs')],text=True,encoding='utf-8'))
    search_index=subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs'),'--search-index'],text=True,encoding='utf-8')
    (ROOT/'assets/data/search-index.json').write_text(search_index,encoding='utf-8')
    navigation=subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs'),'--navigation'],text=True,encoding='utf-8')
    counts=subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs'),'--counts'],text=True,encoding='utf-8')
    posters=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs'),'--posters'],text=True,encoding='utf-8'))
    images={item[role] for kind in build_catalog.KINDS
            for item in json.loads((ROOT/'data/catalog'/f'{kind}.json').read_text(encoding='utf-8'))['items']
            for role in ['icon','illustration'] if role in item}
    for kind in build_catalog.KINDS:
        document=json.loads((ROOT/'data/catalog'/f'{kind}.json').read_text(encoding='utf-8'))
        images.update(document['uiIcons'].values())
        for item in document['items']:
            for recipe in item.get('recipes',[]):
                images.update(m['icon'] for m in recipe['materials'])
    files=[ROOT/'index.html',ROOT/'assets/guide-data.js',*sorted((ROOT/'css').glob('*.css')),
           *sorted((ROOT/'js').glob('*.js')),*sorted((ROOT/'assets/npcs/portraits').glob('*.webp')),
           *[ROOT/'assets/data'/f'{kind}.json' for kind in (*build_catalog.KINDS,'quest-rewards')],
           *[ROOT/image for image in sorted(images)],*[ROOT/poster for poster in posters],ROOT/'assets/vendor/guide-ui.js',ROOT/'assets/vendor/guide-ui.css',ROOT/'assets/data/search-index.json']
    expected={file.relative_to(ROOT) for file in files}
    expected.update(Path(page['path'])/'index.html' for page in pages)
    expected.add(Path('sitemap.xml'))
    destination=ROOT/'dist'
    existing={file.relative_to(destination) for file in destination.rglob('*') if file.is_file()}
    unexpected=existing-expected-{Path('.nojekyll')}
    if unexpected:raise ValueError('Unexpected files in dist; inspect before removing: '+str(sorted(unexpected)))
    destination.mkdir(exist_ok=True)
    for file in files:
        target=destination/file.relative_to(ROOT);target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(file,target)
    template=(ROOT/'index.html').read_text(encoding='utf-8')
    template=re.sub(r'(<nav class="primary-navigation"[^>]*>).*?(</nav>)',lambda m:m[1]+navigation+m[2],template,count=1,flags=re.S)
    template=re.sub(r'(<script id="catalog-counts">).*?(</script>)',lambda m:m[1]+'window.DawnwalkerCounts='+counts+';'+m[2],template,count=1,flags=re.S)
    home=subprocess.check_output(['node',str(ROOT/'scripts/render_catalog.cjs'),'--home'],text=True,encoding='utf-8')
    home_template=template.replace('<body>','<body class="home">',1).replace('<section id="reader" class="reader" aria-label="游戏资料" tabindex="-1"></section>','<section id="reader" class="reader" aria-label="游戏资料" tabindex="-1"><div class="reader-inner">'+home+'</div></section>',1)
    (destination/'index.html').write_text(home_template,encoding='utf-8')
    origin='https://rainbowcoke.github.io/dawnwalker-guide/'
    for page in pages:
        depth=page['path'].count('/')
        base='../'*depth
        output=re.sub(r'(<a class="nav-label)(" data-section="'+page['section']+'")',r'\1 active\2',template,count=1)
        output=output.replace('data-page="'+page['path']+'"','data-page="'+page['path']+'" aria-current="page"')
        output=output.replace('<head>','<head>\n<base href="'+base+'">',1)
        # A base element makes all common assets and navigation resolve at the site root.
        body=page['body'].replace('href="'+base,'href="').replace('src="'+base,'src="')
        card=page['card'].replace('href="'+base,'href="').replace('src="'+base,'src="')
        output=re.sub(r'<title>.*?</title>','<title>'+html.escape(page['title'])+' · 《黎明行者之血》中文游戏指南</title>',output,count=1)
        output=re.sub(r'<meta name="description" content="[^"]*">',lambda m:'<meta name="description" content="'+html.escape(page['description'],quote=True)+'">',output,count=1)
        output=re.sub(r'<link rel="canonical" href="[^"]*">','<link rel="canonical" href="'+origin+page['path']+'">',output,count=1)
        output=output.replace('<body>','<body class="references" data-reference-section="'+page['section']+'">',1)
        output=output.replace('<section id="reader" class="reader" aria-label="游戏资料" tabindex="-1"></section>','<section id="reader" class="reader" aria-label="游戏资料" tabindex="-1">'+body+'</section>',1)
        if card:
            output=output.replace('label="物品卡片" without-header','label="'+html.escape(page['name'],quote=True)+'" open without-header',1)
            output=output.replace('<div id="dialog-content"></div>','<div id="dialog-content">'+card+'</div>',1)
        destination_file=destination/page['path']/'index.html'
        destination_file.parent.mkdir(parents=True,exist_ok=True)
        destination_file.write_text(output,encoding='utf-8')
    sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+origin+path+'</loc></url>' for path in ['',*[p['path'] for p in pages]])+'</urlset>\n'
    (destination/'sitemap.xml').write_text(sitemap,encoding='utf-8')
    (destination/'.nojekyll').write_text('',encoding='utf-8')
    print(f'Built dist with {len(files)+len(pages)+2} site files, including {len(pages)} static catalog routes.')

if __name__=='__main__':build()
