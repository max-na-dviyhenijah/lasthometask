const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_WEBHOOK_SECRET','GOOGLE_SERVICE_ACCOUNT_EMAIL','GOOGLE_PRIVATE_KEY','GOOGLE_SHEET_ID','APP_URL','PUBLIC_BOT_USERNAME','PUBLIC_GITHUB_URL','PUBLIC_AUTHOR_NAME','MANAGER_SETUP_KEY'];
let missing=0;for(const key of required){const ok=Boolean(process.env[key])&&!/YOUR_PROJECT|REPLACE_ME/.test(process.env[key]);console.log(`${ok?'OK':'MISSING'} ${key}`);if(!ok)missing++;}
if(process.env.LOCAL_DEMO==='true')console.log('LOCAL_DEMO is enabled locally. It is never used on Vercel.');
console.log('Values are intentionally not printed.');process.exitCode=missing?1:0;
