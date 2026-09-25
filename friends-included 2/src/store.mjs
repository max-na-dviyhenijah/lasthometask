import { AppError } from './domain.mjs';

export class SupabaseStore {
  constructor(env = process.env, fetcher = fetch) { this.env = env; this.fetcher = fetcher; }
  async request(path, options = {}) {
    const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = this.env;
    if (!url || !key) throw new AppError('Supabase is not configured. Follow docs/SETUP.md.', 503);
    const res = await this.fetcher(`${url.replace(/\/$/, '')}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.code === '23505') throw new AppError('This reference already exists. Use a unique reference.', 409);
      if (body.message === 'Permission denied') throw new AppError(body.message, 403);
      throw new AppError('Database request failed. Check Supabase schema and server configuration.', 503);
    }
    const body = await res.text(); return body ? JSON.parse(body) : null;
  }
  rpc(name, body) { return this.request(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }); }
  async all(table, query = '') {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.request(`${table}?select=*&${query}${query ? '&' : ''}limit=500&offset=${offset}`);
      rows.push(...page); if (page.length < 500) return rows;
    }
  }
  async records(employee) { return this.all('fi_transactions', `order=row_number.asc${employee ? `&data->>employee=eq.${encodeURIComponent(employee)}` : ''}`); }
  async get(ref) { return (await this.request(`fi_transactions?reference=eq.${encodeURIComponent(ref)}&select=*`))[0]; }
  links() { return this.all('fi_links', 'order=user_id.asc'); }
  async link(user, employee) { return this.rpc('fi_link', { p_actor: 'svetlana', p_user: user, p_employee: employee }); }
  save(actor, record, expected, message, chat) { return this.rpc('fi_save', { p_actor: actor, p_data: record, p_expected: expected, p_message: message, p_chat: chat }); }
  async notifications(refs) {
    if (refs && !refs.length) return [];
    if (!refs) return this.all('fi_notifications', 'order=id.asc');
    const out = [];
    for (let i = 0; i < refs.length; i += 50) out.push(...await this.all('fi_notifications', `reference=in.(${refs.slice(i, i + 50).map(encodeURIComponent).join(',')})&order=id.asc`));
    return out;
  }
  async pendingRows() { return this.request('fi_transactions?select=*&sync_status=neq.Synced&order=sync_attempted_at.asc.nullsfirst,row_number.asc&limit=10'); }
  async pendingNotifications() { return this.request('fi_notifications?select=*&status=in.(Pending,Failed)&order=attempted_at.asc.nullsfirst,id.asc&limit=10'); }
  syncDone(ref, version, status, error = null) { return this.rpc('fi_sync_done', { p_ref: ref, p_version: version, p_status: status, p_error: error }); }
  notificationDone(id, status, error = null) { return this.request(`fi_notifications?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status, error, attempted_at: new Date().toISOString(), sent_at: status === 'Sent' ? new Date().toISOString() : null }) }); }
  lock(token) { return this.rpc('fi_lock', { p_token: token }); }
  unlock(token) { return this.rpc('fi_unlock', { p_token: token }); }
}

// Only used by the explicit local preview and by tests. Never used on Vercel.
export class MemoryStore {
  constructor() { this.rows = []; this.people = []; this.jobs = []; this.busy = false; }
  async records(employee) { return structuredClone(this.rows.filter(r => !employee || r.data.employee === employee)); }
  async get(ref) { return structuredClone(this.rows.find(r => r.reference === ref)); }
  async links() { return structuredClone(this.people); }
  async link(user, employee) { this.people = this.people.filter(p => p.user_id !== user && p.employee !== employee); this.people.push({ user_id: user, chat_id: user, employee }); }
  async save(actor, data, expected, message, chat) {
    const old = this.rows.find(r => r.reference === data.reference);
    if (!expected && old) throw new AppError('This reference already exists. Use a unique reference.', 409);
    if (expected && old && !['Pending approval', 'Awaiting allocation'].includes(old.data.status)) return structuredClone(old);
    if (expected && (!old || old.version !== expected)) throw new AppError('Transaction changed; refresh and retry.', 409);
    const row = { reference: data.reference, row_number: old?.row_number || this.rows.length + 2, data: structuredClone(data), version: data.version, sync_status: 'Sync pending', sync_error: null };
    if (old) this.rows[this.rows.indexOf(old)] = row; else this.rows.push(row);
    this.jobs.push({ id: this.jobs.length + 1, reference: data.reference, event: expected ? 'decision' : 'submission', chat_id: chat, message, status: chat ? 'Pending' : 'No Telegram recipient linked', error: null });
    return structuredClone(row);
  }
  async notifications(refs) { return structuredClone(this.jobs.filter(j => !refs || refs.includes(j.reference))); }
  async pendingRows() { return structuredClone(this.rows.filter(r => r.sync_status !== 'Synced').slice(0, 10)); }
  async pendingNotifications() { return structuredClone(this.jobs.filter(j => ['Pending', 'Failed'].includes(j.status)).slice(0, 10)); }
  async syncDone(ref, version, status, error = null) { const row = this.rows.find(r => r.reference === ref && r.version === version); if (row) Object.assign(row, { sync_status: status, sync_error: error }); }
  async notificationDone(id, status, error = null) { Object.assign(this.jobs.find(j => j.id === id), { status, error }); }
  async lock() { if (this.busy) return false; this.busy = true; return true; }
  async unlock() { this.busy = false; }
}
