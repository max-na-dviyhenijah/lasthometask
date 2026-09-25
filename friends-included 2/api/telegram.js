import { service, telegram, retry } from '../src/runtime.mjs';
import { handleTelegram } from '../src/telegram.mjs';
import { json, body, secretMatches } from '../src/http.mjs';
export default async function handler(req,res) {
  if (req.method!=='POST') return json(res,405,{error:'Method not allowed.'});
  if (!secretMatches(req.headers['x-telegram-bot-api-secret-token'],process.env.TELEGRAM_WEBHOOK_SECRET)) return json(res,401,{error:'Unauthorized.'});
  try {
    await handleTelegram(await body(req),service,telegram,process.env.APP_URL);
    try { await retry(); } catch { /* saved jobs remain pending for retry */ }
    return json(res,200,{ok:true});
  } catch { return json(res,503,{error:'Temporary failure. Telegram can retry this update.'}); }
}
