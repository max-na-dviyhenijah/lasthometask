if(process.env.VERCEL)throw new Error('Local sample preview must not run on Vercel.');
process.env.LOCAL_DEMO='true';
const {service}=await import('../src/runtime.mjs');
const {sales,expenses,decisions1,decisions2}=await import('../tests/fixtures.mjs');
for(const {actor,input} of [...sales,...expenses])await service.submit(actor,input);
for(const [ref,input] of [...decisions1,...decisions2])await service.approve('svetlana',ref,input);
console.log('LOCAL SAMPLE ONLY: sample records use the website processing path. No live Telegram, Supabase or Sheets test has been performed.');
await import('./dev.mjs');
