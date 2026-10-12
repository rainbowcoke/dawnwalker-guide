/* Capture CLI stdout through a pipe, as the Python site build does. */
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),render=path.join(__dirname,'render_catalog.cjs');
const output=flag=>execFileSync(process.execPath,[render,...(flag?[flag]:[])],{encoding:'utf8',maxBuffer:16*1024*1024});
const index=JSON.parse(output('--search-index'));
assert.equal(index.schemaVersion,1);assert(Array.isArray(index.items));
const saved=JSON.parse(fs.readFileSync(path.join(root,'dist/assets/data/search-index.json'),'utf8'));
assert.deepEqual(index,saved,'Piped search index differs from the built index');
assert(index.items.some(item=>item.en==='Home Sweet Home'));
assert.equal(JSON.parse(output('--posters')).length,34);
assert.deepEqual(JSON.parse(output('--counts')),{equipment:542,skills:90,consumables:102});
assert.equal(JSON.parse(output()).length,755);
const home=output('--home'),navigation=output('--navigation');
assert.equal((home.match(/class="poster-link/g)||[]).length,4);assert(home.endsWith('</div></div>'));
assert.equal((navigation.match(/class="nav-group"/g)||[]).length,4);assert(navigation.endsWith('</div></div>'));
console.log('PASS complete piped catalog, search index, poster, count, home and navigation output');
