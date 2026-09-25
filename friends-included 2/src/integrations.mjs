import { createSign, randomUUID } from 'node:crypto';
import { EMPLOYEES, PROJECTS } from './domain.mjs';
const SALES_HEADERS = ['Reference','Submission time','Salesperson','Customer','Project','Description','Amount EUR','Proposed Richard %','Proposed Anastasia %','Proposed Jean-Claude %','Approved Richard %','Approved Anastasia %','Approved Jean-Claude %','Richard earned EUR','Anastasia earned EUR','Jean-Claude earned EUR','Commission pool EUR','Status','Source','Decision time'];
const EXPENSE_HEADERS = ['Reference','Submission time','Reporter','Description','Category','Amount EUR','Proposed allocation','Final allocation','Status','Source','Decision time'];
export function sheetValues(r) {
  const name = EMPLOYEES.find(e => e.id === r.employee).name;
  return r.kind === 'sale'
    ? [r.reference,r.submitted_at,name,r.customer,PROJECTS[r.project],r.description,r.amount_cents/100,...r.proposed_split.map(v=>v/100),...(r.approved_split?.map(v=>v/100)||['','','']),...r.earned.map(v=>v/100),r.pool/100,r.status,r.source,r.approved_at||'']
    : [r.reference,r.submitted_at,name,r.description,r.category,r.amount_cents/100,PROJECTS[r.proposed_allocation],PROJECTS[r.final_allocation]||'',r.status,r.source,r.approved_at||''];
}
export class TelegramClient {
  constructor(env = process.env, fetcher = fetch) { this.env=env; this.fetcher=fetcher; }
  async call(method, body) {
    if (!this.env.TELEGRAM_BOT_TOKEN) throw new Error('Telegram bot token is not configured.');
    const res = await this.fetcher(`https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/${method}`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(6000) });
    const value = await res.json();
    if (!res.ok || !value.ok) throw new Error(`Telegram delivery failed (${value.error_code || res.status}). Check that the recipient started the bot and has not blocked it.`);
    return value.result;
  }
  send(chat, message) { return this.call('sendMessage',{chat_id:chat,text:message}); }
}
export class SheetsClient {
  constructor(env = process.env, fetcher = fetch) { this.env=env; this.fetcher=fetcher; this.token=null; this.ready=false; }
  async accessToken() {
    if (this.token && this.token.until>Date.now()) return this.token.value;
    const email=this.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key=this.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n');
    if (!email || !key || !this.env.GOOGLE_SHEET_ID) throw new Error('Google Sheets service account is not configured.');
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now=Math.floor(Date.now()/1000);
    const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
    const sign=createSign('RSA-SHA256'); sign.update(unsigned); sign.end();
    const assertion=`${unsigned}.${sign.sign(key).toString('base64url')}`;
    const res=await this.fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(5000)});
    const data=await res.json();
    if (!res.ok || !data.access_token) throw new Error('Google authorization failed. Check the service account email and private key.');
    this.token={value:data.access_token,until:Date.now()+3300000}; return data.access_token;
  }
  async request(suffix, body) {
    const token=await this.accessToken();
    const res=await this.fetcher(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.env.GOOGLE_SHEET_ID)}${suffix}`, {method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});
    if (!res.ok) throw new Error(`Sheets update failed (${res.status}). Enable the Sheets API and share the spreadsheet with the service account as Editor.`);
    return res.json();
  }
  async prepare() {
    if (this.ready) return;
    let sheet=await this.request('?fields=sheets.properties');
    const requests=['Sales','Expenses'].filter(t=>!sheet.sheets?.some(s=>s.properties.title===t)).map(title=>({addSheet:{properties:{title,gridProperties:{rowCount:1000,columnCount:20,frozenRowCount:1}}}}));
    if (requests.length) {
      await this.request(':batchUpdate',{requests});
      sheet=await this.request('?fields=sheets.properties');
    }
    const formatting=[];
    for(const {properties:p} of sheet.sheets.filter(s=>['Sales','Expenses'].includes(s.properties.title))) {
      formatting.push({updateSheetProperties:{properties:{sheetId:p.sheetId,gridProperties:{frozenRowCount:1,columnCount:Math.max(p.gridProperties.columnCount,20)}},fields:'gridProperties.frozenRowCount,gridProperties.columnCount'}});
      formatting.push({repeatCell:{range:{sheetId:p.sheetId,startRowIndex:0,endRowIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:0.09,green:0.18,blue:0.27},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}}}},fields:'userEnteredFormat'}});
      const ranges=p.title==='Sales'?[[6,7],[13,17]]:[[5,6]];
      for(const [startColumnIndex,endColumnIndex] of ranges)formatting.push({repeatCell:{range:{sheetId:p.sheetId,startRowIndex:1,startColumnIndex,endColumnIndex},cell:{userEnteredFormat:{numberFormat:{type:'CURRENCY',pattern:'"€"#,##0.00'}}},fields:'userEnteredFormat.numberFormat'}});
    }
    if(formatting.length)await this.request(':batchUpdate',{requests:formatting});
    this.ready=true;
  }
  async sync(row) {
    await this.prepare();
    const tab=row.data.kind==='sale'?'Sales':'Expenses';
    // Each reference owns an immutable database row number. Retry and approval
    // overwrite that exact row with RAW values; user text is never a formula.
    const properties=await this.request('?fields=sheets.properties');
    const target=properties.sheets.find(s=>s.properties.title===tab).properties;
    if (target.gridProperties.rowCount<row.row_number || target.gridProperties.columnCount<20) await this.request(':batchUpdate',{requests:[{updateSheetProperties:{properties:{sheetId:target.sheetId,gridProperties:{rowCount:Math.max(target.gridProperties.rowCount,row.row_number+100),columnCount:Math.max(target.gridProperties.columnCount,20)}},fields:'gridProperties.rowCount,gridProperties.columnCount'}}]});
    await this.request('/values:batchUpdate',{valueInputOption:'RAW',data:[{range:`'${tab}'!A1`,values:[tab==='Sales'?SALES_HEADERS:EXPENSE_HEADERS]},{range:`'${tab}'!A${row.row_number}`,values:[sheetValues(row.data)]}]});
  }
}
export async function deliver(store, sheets, telegram, { local=false }={}) {
  if (local) return { local:true, message:'Local preview: external delivery is not connected.' };
  const token=randomUUID();
  if (!await store.lock(token)) return { busy:true };
  const started=Date.now(); let synced=0,sent=0,failed=0;
  try {
    for (const row of (await store.pendingRows()).slice(0,2)) {
      if (Date.now()-started>18000) break;
      try { await sheets.sync(row); await store.syncDone(row.reference,row.version,'Synced'); synced++; }
      catch (error) { await store.syncDone(row.reference,row.version,'Sync failed',safeError(error)); failed++; }
    }
    for (const job of await store.pendingNotifications()) {
      if (Date.now()-started>35000) break;
      try { await telegram.send(job.chat_id,job.message); await store.notificationDone(job.id,'Sent'); sent++; }
      catch (error) { await store.notificationDone(job.id,'Failed',safeError(error)); failed++; }
    }
    return {synced,sent,failed};
  } finally { await store.unlock(token); }
}
function safeError(error) {
  // Never expose raw network URLs (Telegram URLs contain the bot token).
  return /^(Telegram|Google|Sheets)/.test(error.message) ? error.message.slice(0,250) : 'Delivery interrupted. Check the connection and retry.';
}
