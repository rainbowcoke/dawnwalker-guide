const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const site=path.resolve(__dirname,'../dist');
async function serve(port=0){
 const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  if(pathname.startsWith('/dawnwalker-guide/'))pathname=pathname.slice('/dawnwalker-guide'.length);
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(site,'.'+pathname),relative=path.relative(site,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.xml':'application/xml; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(body);});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {base:prefix=>`http://127.0.0.1:${server.address().port}${prefix}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={serve,site};
