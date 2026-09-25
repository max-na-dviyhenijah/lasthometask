import { EMPLOYEES, requireRole, AppError } from '../src/domain.mjs';
import { service, store, retry, local } from '../src/runtime.mjs';
import { json, body, failure, secretMatches } from '../src/http.mjs';
export default async function handler(req,res) {
  try {
    const url=new URL(req.url,'http://localhost');
    const action=url.searchParams.get('action')||'state';
    if (req.method==='GET' && action==='config') {
      return json(res,200,{employees:EMPLOYEES,local,author:process.env.PUBLIC_AUTHOR_NAME||'Maksims Paņuškins',botUsername:process.env.PUBLIC_BOT_USERNAME||'',github:process.env.PUBLIC_GITHUB_URL||'',sheet:process.env.GOOGLE_SHEET_ID?`https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`:'',configured:local||Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)});
    }
    // Deliberate public fictional demonstration roles, as required by the brief.
    // This is not authentication for a real company's financial records.
    const actor=req.headers['x-demo-role'];
    if (req.method==='POST' && action==='retry' && secretMatches(req.headers.authorization,`Bearer ${process.env.RETRY_SECRET||''}`) && process.env.RETRY_SECRET) return json(res,200,await retry());
    requireRole(actor);
    if (req.method==='GET' && action==='state') return json(res,200,await service.state(actor));
    if (req.method!=='POST') throw new AppError('Method not allowed.',405);
    const input=await body(req);
    if (action==='submit' || action==='approve') {
      const record=action==='submit' ? await service.submit(actor,input) : await service.approve(actor,input.reference,input);
      // Failure after commit must never appear as a rejected financial operation.
      let delivery;
      try { delivery=await retry(); } catch { delivery={pending:true}; }
      return json(res,200,{saved:true,reference:record.reference,delivery});
    }
    requireRole(actor,'manager');
    if (action==='retry') return json(res,200,await retry());
    if (action==='link' || action==='links') {
      if (!local && !secretMatches(req.headers['x-setup-key'],process.env.MANAGER_SETUP_KEY)) throw new AppError('Enter the manager setup key to manage Telegram links.',403);
      if (action==='link') await service.link(actor,input.userId,input.employee);
      return json(res,200,{links:await store.links()});
    }
    throw new AppError('Unknown action.',404);
  } catch(error) { failure(res,error); }
}
