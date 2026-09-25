import { TelegramClient } from '../src/integrations.mjs';
const {APP_URL,TELEGRAM_WEBHOOK_SECRET}=process.env;
if(!APP_URL||!/^https:\/\//.test(APP_URL))throw new Error('Set APP_URL to your public HTTPS Vercel URL.');
if(!/^[A-Za-z0-9_-]{32,256}$/.test(TELEGRAM_WEBHOOK_SECRET||''))throw new Error('Set TELEGRAM_WEBHOOK_SECRET to 32–256 letters, digits, underscores or hyphens.');
const tg=new TelegramClient();
try{
 const bot=await tg.call('getMe',{});
 await tg.call('setWebhook',{url:`${APP_URL.replace(/\/$/,'')}/api/telegram`,secret_token:TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message']});
 await tg.call('setMyCommands',{commands:[{command:'start',description:'Show your ID and setup instructions'},{command:'help',description:'Show sale and expense examples'},{command:'sale',description:'Submit a sale and commission proposal'},{command:'expense',description:'Submit an expense'},{command:'status',description:'Show your recent transaction statuses'}]});
 const info=await tg.call('getWebhookInfo',{});
 console.log(`Bot: https://t.me/${bot.username}`);console.log(`Webhook: ${info.url}`);console.log(`Pending updates: ${info.pending_update_count}`);
 if(info.last_error_message)console.log(`Last webhook error: ${info.last_error_message}`);
 console.log('Start the bot in a private chat, then link your user ID in Manager setup.');
}catch(error){console.error(error.message.startsWith('Telegram')?error.message:'Setup failed. Check the network and environment variables.');process.exitCode=1;}
