import http from 'node:http';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
const base = process.argv[2] || 'http://127.0.0.1:15000';
for (const path of ['/api/games','/styles.css?v=5.0.0','/app.js?v=5.0.0','/scramjet/scramjet.wasm']) {
  const response = await new Promise((resolve,reject)=>{http.get(base+path,{headers:{'Accept-Encoding':'br, gzip'}},res=>{const parts=[];res.on('data',part=>parts.push(part));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts)}));res.on('error',reject)}).on('error',reject)});
  const encoding=response.headers['content-encoding'];
  const decoded=encoding==='br'?brotliDecompressSync(response.body):encoding==='gzip'?gunzipSync(response.body):response.body;
  console.log(JSON.stringify({path,status:response.status,encoding:encoding||'identity',transferred:response.body.length,decoded:decoded.length}));
}
