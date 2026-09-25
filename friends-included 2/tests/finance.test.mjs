import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStore } from '../src/store.mjs';
import { FinanceService } from '../src/service.mjs';
import { commission, amountCents, splitBasisPoints } from '../src/domain.mjs';
import { sales,expenses,decisions1,decisions2 } from './fixtures.mjs';
const fresh=()=>new FinanceService(new MemoryStore());
async function insert(service,entries){for(const {actor,input} of entries)await service.submit(actor,input);}
async function approve(service,entries){for(const [ref,input] of entries)await service.approve('svetlana',ref,input);}
test('homework Test 1 before approval, after approval, and cumulative Test 2',async()=>{
 const service=fresh();
 await insert(service,[...sales.slice(0,2),...expenses.slice(0,3)]);
 let t=(await service.state('svetlana')).totals;
 assert.equal(t.company.result,-30000);assert.equal(t.company.income,0);assert.equal(t.company.commission,0);assert.equal(t.A.result,0);assert.equal(t.B.result,0);
 await approve(service,decisions1);t=(await service.state('svetlana')).totals;
 assert.deepEqual(t.A,{income:100000,commission:10000,expenses:20000,result:70000});
 assert.deepEqual(t.B,{income:200000,commission:20000,expenses:0,result:180000});
 assert.equal(t.company.result,240000);assert.deepEqual(t.earned,[9000,11000,10000]);
 await insert(service,[...sales.slice(2),...expenses.slice(3)]);await approve(service,decisions2);
 t=(await service.state('svetlana')).totals;
 assert.deepEqual(t.A,{income:250000,commission:25000,expenses:20000,result:205000});
 assert.deepEqual(t.B,{income:280000,commission:28000,expenses:34000,result:218000});
 assert.deepEqual(t.company,{income:530000,commission:53000,expenses:84000,result:393000,overhead:16000,awaiting:14000});
 assert.deepEqual(t.earned,[14000,17500,21500]);assert.equal(t.pendingSales,60000);assert.equal(t.pendingCount,2);
 const state=await service.state('svetlana');assert.equal(state.records.find(r=>r.reference==='S05').pool,0);
 assert.deepEqual(state.records.find(r=>r.reference==='S02').proposed_split,[0,5000,5000]);
 assert.deepEqual(state.records.find(r=>r.reference==='S02').approved_split,[2000,4000,4000]);
 assert.equal(state.records.find(r=>r.reference==='E02').proposed_allocation,'B');
 const snapshot=JSON.stringify(state.totals);
 for(const [ref,input] of [...decisions1,...decisions2])await service.approve('svetlana',ref,input);
 assert.equal(JSON.stringify((await service.state('svetlana')).totals),snapshot);
 assert.equal((await service.store.records()).length,12);assert.equal((await service.store.notifications()).length,20);
 // Additional instructor transactions legitimately change the results.
 await service.submit('kevin',{...expenses[0].input,reference:'E99',amount:'12.34'});
 assert.equal((await service.state('svetlana')).totals.company.result,391766);
});
test('all six required denied or idempotent operations leave totals intact',async()=>{
 const service=fresh();await insert(service,[sales[0],expenses[0]]);await service.approve('svetlana','S01',{split:[50,30,20]});
 const before=(await service.state('svetlana')).totals;
 await assert.rejects(()=>service.submit('richard',{...sales[0].input,reference:'BAD',split:[60,30,20]}),/100%/);
 await assert.rejects(()=>service.approve('richard','S01',{split:[100,0,0]}),/not allowed/);
 await assert.rejects(()=>service.submit('kevin',{...sales[0].input,reference:'BAD'}),/not allowed/);
 for(const amount of [undefined,'',0,-1,'1.001','Infinity','NaN'])await assert.rejects(()=>service.submit('kevin',{...expenses[0].input,reference:'BAD',amount}));
 await service.approve('svetlana','S01',{split:[100,0,0]});
 await assert.rejects(()=>service.submit('richard',sales[0].input),/already exists/);
 assert.deepEqual((await service.state('svetlana')).totals,before);
 assert.equal((await service.store.records()).length,2);
});
test('staff can see only their own records, never company totals or chat IDs',async()=>{
 const service=fresh();await insert(service,[sales[0],sales[1],expenses[0]]);
 for(const actor of ['richard','anastasia','jean-claude','kevin']){
 const state=await service.state(actor);assert.equal(state.totals,null);assert(state.records.every(r=>r.employee===actor));assert(state.records.every(r=>r.original_chat_id===undefined));}
 await assert.rejects(()=>service.state('intruder'),/not allowed/);
});
test('bot submission identity and recipient survive role relinking',async()=>{
 const service=fresh();await service.link('svetlana','123456','richard');
 await service.submit('richard',sales[0].input,{source:'telegram',chatId:'123456',messageKey:'123456:1'});
 await service.link('svetlana','123456','kevin');await service.submit('kevin',expenses[0].input,{source:'telegram',chatId:'123456'});
 await approve(service,[decisions1[0],decisions1[2]]);
 assert.equal((await service.store.get('S01')).data.employee,'richard');
 const jobs=await service.store.notifications();assert(jobs.every(j=>j.chat_id==='123456'));
 await assert.rejects(()=>service.link('richard','888','richard'),/not allowed/);
});
test('website decision can resolve a newly linked recipient; missing links are explicit',async()=>{
 const service=fresh();await insert(service,[sales[2],expenses[4]]);
 assert((await service.store.notifications()).every(j=>j.status==='No Telegram recipient linked'));
 await service.link('svetlana','123456','jean-claude');await service.approve('svetlana',...decisions2[0]);
 let job=(await service.store.notifications()).find(j=>j.event==='decision');assert.equal(job.chat_id,'123456');assert.match(job.message,/split changed/);assert.match(job.message,/€150\.00/);assert.match(job.message,/€75\.00/);
 await service.link('svetlana','123456','kevin');await service.approve('svetlana','E05',{allocation:'B'});
 job=(await service.store.notifications()).find(j=>j.reference==='E05'&&j.event==='decision');assert.match(job.message,/allocation changed/);assert.match(job.message,/€90\.00/);
});
test('rounding is cent-exact and tie order is deterministic',()=>{
 assert.equal(amountCents('1.01'),101);assert.deepEqual(splitBasisPoints(['33.33','33.33','33.34']),[3333,3333,3334]);
 assert.deepEqual(commission(10,[5000,5000,0]),{pool:1,earned:[0,1,0]});
 assert.deepEqual(commission(20,[3333,3333,3334]),{pool:2,earned:[1,1,0]});
 for(let cents=1;cents<1000;cents++)for(const split of [[3333,3333,3334],[5000,5000,0],[10000,0,0],[0,5000,5000]]){const c=commission(cents,split);assert.equal(c.earned.reduce((a,b)=>a+b),c.pool);assert(c.earned.every(n=>Number.isInteger(n)&&n>=0));}
});
test('concurrent approvals create only one decision',async()=>{
 const service=fresh();await insert(service,[sales[0]]);
 await Promise.all([service.approve('svetlana','S01',{split:[50,30,20]}),service.approve('svetlana','S01',{split:[100,0,0]})]);
 assert.equal((await service.store.notifications()).filter(j=>j.event==='decision').length,1);
 assert.equal((await service.state('svetlana')).totals.company.commission,10000);
});
