// Optional deeper verification: npm install --no-save @electric-sql/pglite
// Then: node scripts/verify-database.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { SupabaseStore } from '../src/store.mjs';
import { FinanceService } from '../src/service.mjs';
import { sales,expenses,decisions1,decisions2 } from '../tests/fixtures.mjs';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
await db.exec(await readFile('supabase/001_schema.sql','utf8'));
class SqlStore extends SupabaseStore {
 async rpc(name,body){const args=Object.values(body);const query=`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`;return (await db.query(query,args)).rows[0].value;}
 async records(employee){return (await db.query(`select * from public.fi_transactions ${employee?"where data->>'employee'=$1":''} order by row_number`,employee?[employee]:[])).rows;}
 async get(ref){return (await db.query('select * from public.fi_transactions where reference=$1',[ref])).rows[0];}
 async links(){return (await db.query('select * from public.fi_links')).rows;}
 async notifications(refs){return (await db.query('select * from public.fi_notifications order by id')).rows.filter(r=>!refs||refs.includes(r.reference));}
}
const store=new SqlStore(), service=new FinanceService(store);
await db.exec('set role service_role');
await service.link('svetlana','123','richard');
for(const {actor,input} of [...sales.slice(0,2),...expenses.slice(0,3)])await service.submit(actor,input);
assert.equal((await service.state('svetlana')).totals.company.result,-30000);
for(const [ref,input] of decisions1)await service.approve('svetlana',ref,input);
assert.equal((await service.state('svetlana')).totals.company.result,240000);
for(const {actor,input} of [...sales.slice(2),...expenses.slice(3)])await service.submit(actor,input);
for(const [ref,input] of decisions2)await service.approve('svetlana',ref,input);
const t=(await service.state('svetlana')).totals;
assert.equal(t.company.result,393000);assert.deepEqual(t.earned,[14000,17500,21500]);
await assert.rejects(()=>service.submit('richard',sales[0].input),/duplicate key/);
await service.approve('svetlana','S01',{split:[0,0,100]});
assert.equal((await store.notifications()).length,20);
const row=await store.get('S05');
await assert.rejects(()=>store.save('richard',{...row.data,status:'Approved'},1,'bad',null),/Permission denied/);
await assert.rejects(()=>store.save('svetlana',{...row.data,amount_cents:1,status:'Approved',approved_by:'svetlana',version:2},1,'bad',null),/Original submission/);
assert.equal(await store.lock('worker-one'),true);assert.equal(await store.lock('worker-two'),false);await store.unlock('worker-two');assert.equal(await store.lock('worker-three'),false);await store.unlock('worker-one');assert.equal(await store.lock('worker-two'),true);await store.unlock('worker-two');
await store.syncDone('S01',1,'Synced');assert.equal((await store.get('S01')).sync_status,'Sync pending');await store.syncDone('S01',2,'Synced');assert.equal((await store.get('S01')).sync_status,'Synced');
await service.link('svetlana','123','kevin');assert.equal((await store.links())[0].employee,'kevin');
await db.exec('reset role; set role anon');
await assert.rejects(()=>db.query('select * from public.fi_transactions'),/permission denied/);
await assert.rejects(()=>db.query("select public.fi_lock('anonymous')"),/permission denied/);
await db.close();
console.log('PostgreSQL schema, role grants, atomic decisions, original data preservation, duplicate protection, locks, sync version guards and both homework scenarios: PASS');
