import { SupabaseStore, MemoryStore } from './store.mjs';
import { FinanceService } from './service.mjs';
import { TelegramClient, SheetsClient, deliver } from './integrations.mjs';
export const local = process.env.LOCAL_DEMO==='true' && !process.env.VERCEL;
export const store=local ? new MemoryStore() : new SupabaseStore();
export const service=new FinanceService(store);
export const telegram=new TelegramClient();
export const sheets=new SheetsClient();
export const retry=()=>deliver(store,sheets,telegram,{local});
export const syncTests=async()=>{
  const rows=(await store.records()).filter(r=>r.data.test_mode);
  let synced=0,failed=0,sheetId=null;
  for(const row of rows){
    try { sheetId=await sheets.syncTest(row); await store.syncDone(row.reference,row.version,'Synced to Public Tests'); synced++; }
    catch(error){ await store.syncDone(row.reference,row.version,'Sync failed',error.message?.slice(0,250)||'Sheets update failed.'); failed++; }
  }
  return {synced,failed,sheetId};
};
