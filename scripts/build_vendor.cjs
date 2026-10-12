const path=require('node:path');
require('esbuild').buildSync({
 entryPoints:[path.join(__dirname,'vendor-entry.js')],
 outfile:path.join(__dirname,'../assets/vendor/guide-ui.js'),
 bundle:true,minify:true,format:'iife',target:['es2022'],legalComments:'eof',
});
console.log('Built local Web Awesome, Lucide and Panzoom bundle.');
