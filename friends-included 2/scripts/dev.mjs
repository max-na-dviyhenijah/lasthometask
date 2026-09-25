import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import app from '../api/app.js';
import telegram from '../api/telegram.js';
const files={'/':'index.html','/app.js':'app.js','/styles.css':'styles.css','/favicon.svg':'favicon.svg'};
const types={html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml'};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/app')return app(req,res);if(path==='/api/telegram')return telegram(req,res);
 const file=files[path];if(!file){res.writeHead(404);res.end('Not found');return;}
 try{res.setHeader('Content-Type',types[file.split('.').pop()]);res.end(await readFile(resolve('public',file)));}catch{res.writeHead(500);res.end('Unable to read file');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`Friends Included: http://127.0.0.1:${process.env.PORT||4173} (${process.env.LOCAL_DEMO==='true'?'local preview':'Supabase mode'})`));
