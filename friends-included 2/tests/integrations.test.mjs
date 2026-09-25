import test from 'node:test';import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.mjs';import { FinanceService } from '../src/service.mjs';
import { deliver,sheetValues,SheetsClient,TelegramClient } from '../src/integrations.mjs';
import { parseCommand,handleTelegram } from '../src/telegram.mjs';
import { sales,expenses } from './fixtures.mjs';
test('Sheets and Telegram failures remain visible; retries keep one row and unchanged totals',async()=>{
 const store=new MemoryStore(),service=new FinanceService(store);await service.link('svetlana','123','richard');await service.submit('richard',sales[0].input);
 const before=(await service.state('svetlana')).totals;
 const down={sync:async()=>{throw new Error('Sheets update failed (503).');}},telegramDown={send:async()=>{throw new Error('Telegram delivery failed (403).');}};
 await deliver(store,down,telegramDown);
 assert.equal((await store.get('S01')).sync_status,'Sync failed');assert.equal((await store.notifications())[0].status,'Failed');
 const spreadsheet=new Map(),messages=[];
 const up={sync:async row=>spreadsheet.set(row.row_number,sheetValues(row.data))},telegramUp={send:async(chat,text)=>messages.push({chat,text})};
 await deliver(store,up,telegramUp);await deliver(store,up,telegramUp);
 assert.equal(spreadsheet.size,1);assert.equal(messages.length,1);assert.deepEqual((await service.state('svetlana')).totals,before);
 await service.approve('svetlana','S01',{split:[20,40,40]});await deliver(store,up,telegramUp);
 assert.equal(spreadsheet.size,1);assert.equal(spreadsheet.get(2)[10],20);assert.equal(messages.length,2);
});
test('an approval during synchronization cannot mark an old version synchronized',async()=>{
 const store=new MemoryStore(),service=new FinanceService(store);await service.submit('richard',sales[0].input);
 await deliver(store,{sync:async()=>service.approve('svetlana','S01',{split:[50,30,20]})},{send:async()=>{}});
 assert.equal((await store.get('S01')).sync_status,'Sync pending');
});
test('overlapping delivery workers do not double-send',async()=>{
 const store=new MemoryStore(),service=new FinanceService(store);await service.link('svetlana','123','richard');await service.submit('richard',sales[0].input);
 let sent=0;const sheets={sync:async()=>{}},tg={send:async()=>{sent++;}};
 await Promise.all([deliver(store,sheets,tg),deliver(store,sheets,tg)]);assert.equal(sent,1);
});
test('Telegram command parser and webhook handler share processing rules',async()=>{
 const store=new MemoryStore(),service=new FinanceService(store),messages=[];const tg={send:async(chat,text)=>messages.push(text)};
 const msg=(text,id=1)=>({message:{message_id:id,text,chat:{id:123,type:'private'},from:{id:123}}});
 await handleTelegram(msg('/start'),service,tg,'https://example.test');assert.match(messages.at(-1),/123/);
 const command='/sale S01 | Olivia Rose | A | 1000 | One proud uncle and an emotional grandmother | 50 | 30 | 20';
 await handleTelegram(msg(command),service,tg);assert.match(messages.at(-1),/not linked/);assert.equal((await store.records()).length,0);
 await service.link('svetlana','123','richard');await handleTelegram(msg(command),service,tg);await handleTelegram(msg(command),service,tg);
 assert.equal((await store.records()).length,1);assert.equal((await store.notifications()).length,1);
 await handleTelegram(msg(command,2),service,tg);assert.match(messages.at(-1),/already exists/);
 await service.link('svetlana','123','kevin');await handleTelegram(msg(command.replace('S01','S99'),3),service,tg);assert.match(messages.at(-1),/not allowed/);
 const expense='/expense E01 | 120 | Materials | A | Rented suit and fake pearl necklace for the relatives';
 assert.deepEqual(parseCommand(expense),expenses[0].input);await handleTelegram(msg(expense,4),service,tg);assert.equal((await store.records()).length,2);
 await handleTelegram({message:{message_id:5,text:command,chat:{id:-5,type:'group'},from:{id:123}}},service,tg);assert.equal((await store.records()).length,2);
});
test('pending Sheets values contain no approved split and zero earned commission',async()=>{
 const store=new MemoryStore(),service=new FinanceService(store);await service.submit('richard',sales[0].input);const values=sheetValues((await store.get('S01')).data);
 assert.deepEqual(values.slice(10,13),['','','']);assert.deepEqual(values.slice(13,17),[0,0,0,0]);
});
test('Telegram non-ok responses are errors, not Sent',async()=>{
 const tg=new TelegramClient({TELEGRAM_BOT_TOKEN:'test'},async()=>new Response(JSON.stringify({ok:false,error_code:403}),{status:403}));
 await assert.rejects(()=>tg.send('123','test'),/failed \(403\)/);
});
test('Sheets requests always update stable rows with RAW input, including formula-like text',async()=>{
 const calls=[];const sheets=new SheetsClient({GOOGLE_SHEET_ID:'test'},async(url,opts)=>{calls.push({url,opts});return new Response(JSON.stringify(url.includes('?fields=')?{sheets:[{properties:{title:'Sales',sheetId:0,gridProperties:{rowCount:1000,columnCount:20}}},{properties:{title:'Expenses',sheetId:1,gridProperties:{rowCount:1000,columnCount:20}}}]}:{}));});
 sheets.token={value:'test',until:Date.now()+10000};const store=new MemoryStore(),service=new FinanceService(store);
 const row=await service.submit('richard',{...sales[0].input,description:'=IMPORTXML("bad")'});await sheets.sync(row);await sheets.sync(row);
 const writes=calls.filter(c=>c.url.endsWith('/values:batchUpdate')).map(c=>JSON.parse(c.opts.body));
 assert.equal(writes.length,2);for(const w of writes){assert.equal(w.valueInputOption,'RAW');assert.equal(w.data[1].range,"'Sales'!A2");assert.equal(w.data[1].values[0][5],'=IMPORTXML("bad")');}
 assert(!calls.some(c=>c.url.includes('append')));
});
