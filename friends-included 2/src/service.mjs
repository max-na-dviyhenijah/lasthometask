import { submission, approval, submissionMessage, decisionMessage, requireRole, totals, AppError, isTestEmployee } from './domain.mjs';
export class FinanceService {
  constructor(store) { this.store = store; }
  async submit(actor, input, origin = {}) {
    const record = submission(actor, input, origin);
    if (origin.messageKey) record.telegram_message_key = origin.messageKey;
    const links = await this.store.links();
    const chat = origin.source === 'telegram' ? origin.chatId : links.find(l => l.employee === actor)?.chat_id || null;
    // Website submissions retain the chat available at submission; if missing,
    // a newly linked chat can be resolved at decision time. Bot origins never change.
    record.original_chat_id = chat;
    return this.store.save(actor, record, 0, submissionMessage(record), chat);
  }
  async approve(actor, ref, input) {
    requireRole(actor, 'manager');
    const old = await this.store.get(ref);
    const { record, changed } = approval(actor, old?.data, input);
    if (!changed) return old;
    const links = await this.store.links();
    const chat = record.source === 'telegram' ? record.original_chat_id : (links.find(l => l.employee === record.employee)?.chat_id || record.original_chat_id);
    return this.store.save(actor, record, old.version, decisionMessage(record), chat || null);
  }
  async approveTest(ref, input) {
    const old = await this.store.get(ref);
    if (!old?.data?.test_mode) throw new AppError('Test transaction not found.', 404);
    return this.approve('svetlana', ref, input);
  }
  async state(actor, { onlyTest = isTestEmployee(actor) } = {}) {
    const person = requireRole(actor);
    let rows = await this.store.records(person.role === 'manager' ? null : actor);
    rows = rows.filter(r => onlyTest ? r.data.test_mode : !r.data.test_mode);
    const jobs = await this.store.notifications(rows.map(r => r.reference));
    const records = rows.map(r => ({ ...r.data, original_chat_id: undefined, telegram_message_key: undefined, sync_status: r.sync_status, sync_error: r.sync_error, notifications: jobs.filter(j => j.reference === r.reference).map(({ event, status, error }) => ({ event, status, error })) }));
    return { records, totals: person.role === 'manager' ? totals(rows.map(r => r.data)) : null };
  }
  async link(actor, user, employee) {
    requireRole(actor, 'manager'); requireRole(employee);
    if (!/^[1-9]\d{0,15}$/.test(String(user))) throw new AppError('Enter the numeric Telegram user ID shown by /start.');
    await this.store.link(String(user), employee);
  }
  async linkTest(user, kind) {
    if (!['sale', 'expense'].includes(kind)) throw new AppError('Choose the sale or expense test role.');
    await this.link('svetlana', user, kind === 'sale' ? 'test-richard' : 'test-kevin');
  }
}
