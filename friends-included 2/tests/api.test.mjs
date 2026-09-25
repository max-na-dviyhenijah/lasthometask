import test from 'node:test';import assert from 'node:assert/strict';
process.env.LOCAL_DEMO='true';delete process.env.VERCEL;
const {default:handler}=await import('../api/app.js');
const {default:webhook}=await import('../api/telegram.js');
function invoke(fn,action,role,input,headers={}) {return new Promise(resolve=>{const req={url:`/api/app?action=${action}`,method:input===undefined?'GET':'POST',headers:{'x-demo-role':role,...headers},body:input};const res={statusCode:200,setHeader(){},end(raw){resolve({status:this.statusCode,data:JSON.parse(raw)});}};fn(req,res);});}
test('HTTP API enforces role permissions independently of buttons',async()=>{
 const sale={kind:'sale',reference:'API01',customer:'HTTP test',project:'A',description:'Processing layer',amount:'1.01',split:[50,30,20]};
 assert.equal((await invoke(handler,'submit','kevin',sale)).status,403);
 assert.equal((await invoke(handler,'submit','richard',sale)).status,200);
 assert.equal((await invoke(handler,'approve','richard',{reference:'API01',split:[50,30,20]})).status,403);
 assert.equal((await invoke(handler,'approve','svetlana',{reference:'API01',split:[50,30,20]})).status,200);
 assert.equal((await invoke(handler,'submit','richard',sale)).status,409);
 assert.equal((await invoke(handler,'state','kevin')).data.records.length,0);
 assert.equal((await invoke(handler,'state','unknown')).status,403);
 assert.equal((await invoke(handler,'state','richard')).data.totals,null);
 assert.equal((await invoke(handler,'config')).data.author,'Maksims Paņuškins');
});
test('Telegram webhook rejects missing and incorrect secrets',async()=>{
 process.env.TELEGRAM_WEBHOOK_SECRET='correct_secret';
 assert.equal((await invoke(webhook,'','',{})).status,401);
 assert.equal((await invoke(webhook,'','',{}, {'x-telegram-bot-api-secret-token':'wrong'})).status,401);
 assert.equal((await invoke(webhook,'','',{}, {'x-telegram-bot-api-secret-token':'correct_secret'})).status,200);
});
