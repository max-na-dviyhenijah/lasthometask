import { SupabaseStore, MemoryStore } from './store.mjs';
import { FinanceService } from './service.mjs';
import { TelegramClient, SheetsClient, deliver } from './integrations.mjs';
export const local = process.env.LOCAL_DEMO==='true' && !process.env.VERCEL;
export const store=local ? new MemoryStore() : new SupabaseStore();
export const service=new FinanceService(store);
export const telegram=new TelegramClient();
export const sheets=new SheetsClient();
export const retry=()=>deliver(store,sheets,telegram,{local});
