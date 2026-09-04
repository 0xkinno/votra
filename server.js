const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
http.createServer((req,res)=>{ const file = req.url === '/' ? 'index.html' : req.url.slice(1); const safe = path.normalize(file).replace(/^\.\.(\/|\\)/,''); const full = path.join(root,safe); if(!full.startsWith(root)){res.writeHead(403);return res.end();} fs.readFile(full,(e,d)=>{ if(e){res.writeHead(404);return res.end('Not found');} res.writeHead(200,{'Content-Type':mime[path.extname(full)]||'text/plain'}); res.end(d);}); }).listen(4173,()=>console.log('VOTRA demo: http://localhost:4173'));
