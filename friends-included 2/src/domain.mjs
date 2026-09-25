export const EMPLOYEES = [
  { id: 'svetlana', name: 'Svetlana de Monte Carlo', role: 'manager' },
  { id: 'richard', name: 'Richard “Call Me Dick” Darling', role: 'salesperson' },
  { id: 'anastasia', name: 'Anastasia Ferrari', role: 'salesperson' },
  { id: 'jean-claude', name: 'Jean-Claude Bērziņš', role: 'salesperson' },
  { id: 'kevin', name: 'Kevin von Whatever', role: 'reporter' }
];
export const SALESPEOPLE = ['richard', 'anastasia', 'jean-claude'];
export const PROJECTS = { A: 'Respectable Relatives', B: 'Drunk University Friends', overhead: 'Company overhead' };
export class AppError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function requireRole(id, role) {
  const person = EMPLOYEES.find(p => p.id === id);
  if (!person || (role && person.role !== role)) throw new AppError('This role is not allowed to perform that action.', 403);
  return person;
}
export function text(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AppError(`${label} is required (maximum ${max} characters).`);
  return value.trim();
}
export function amountCents(value) {
  const s = String(value ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw new AppError('Enter a positive euro amount with at most two decimal places.');
  const [whole, decimal = ''] = s.split('.');
  const n = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (n <= 0) throw new AppError('Amount must be greater than zero.');
  return n;
}
export function splitBasisPoints(value) {
  if (!Array.isArray(value) || value.length !== 3) throw new AppError('Provide all three commission percentages.');
  const parts = value.map(v => {
    const s = String(v ?? '').trim();
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) throw new AppError('Each share must be between 0 and 100, with at most two decimal places.');
    const [whole, decimal = ''] = s.split('.');
    const n = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    if (n > 10000) throw new AppError('Each share must be between 0 and 100.');
    return n;
  });
  if (parts.reduce((a, b) => a + b, 0) !== 10000) throw new AppError('Commission shares must total exactly 100%.');
  return parts;
}
export function commission(cents, split) {
  const pool = Math.round(cents / 10);
  const earned = split.map(bps => Math.round(pool * bps / 10000));
  const largest = split.indexOf(Math.max(...split));
  earned[largest] += pool - earned.reduce((a, b) => a + b, 0);
  return { pool, earned };
}
export const money = cents => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const percent = bps => `${bps / 100}%`;
export function submission(actor, input, origin = {}, now = new Date().toISOString()) {
  const kind = input.kind;
  if (!['sale', 'expense'].includes(kind)) throw new AppError('Choose sale or expense.');
  requireRole(actor, kind === 'sale' ? 'salesperson' : 'reporter');
  const reference = text(input.reference, 'Reference', 30).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(reference)) throw new AppError('Reference may contain letters, digits, hyphens and underscores.');
  const record = { reference, kind, employee: actor, submitted_at: now, description: text(input.description, 'Description'), amount_cents: amountCents(input.amount), source: origin.source || 'website', original_chat_id: origin.chatId || null, version: 1, approved_at: null, approved_by: null, earned: [0, 0, 0], pool: 0 };
  if (kind === 'sale') {
    if (!['A', 'B'].includes(input.project)) throw new AppError('Choose project A or B.');
    Object.assign(record, { customer: text(input.customer, 'Customer', 120), project: input.project, proposed_split: splitBasisPoints(input.split), approved_split: null, status: 'Pending approval' });
  } else {
    if (!['Materials', 'Travel', 'Other'].includes(input.category)) throw new AppError('Choose Materials, Travel or Other.');
    if (!Object.hasOwn(PROJECTS, input.allocation)) throw new AppError('Choose a proposed allocation.');
    Object.assign(record, { category: input.category, proposed_allocation: input.allocation, final_allocation: input.allocation === 'overhead' ? 'overhead' : null, status: input.allocation === 'overhead' ? 'Allocated automatically' : 'Awaiting allocation' });
  }
  return record;
}
export function approval(actor, record, input, now = new Date().toISOString()) {
  requireRole(actor, 'manager');
  if (!record) throw new AppError('Transaction not found.', 404);
  if (!['Pending approval', 'Awaiting allocation'].includes(record.status)) return { record, changed: false };
  const next = { ...record, version: record.version + 1, approved_at: now, approved_by: actor, status: 'Approved' };
  if (record.kind === 'sale') {
    next.approved_split = splitBasisPoints(input.split);
    Object.assign(next, commission(record.amount_cents, next.approved_split));
  } else {
    if (!Object.hasOwn(PROJECTS, input.allocation)) throw new AppError('Choose a final allocation.');
    next.final_allocation = input.allocation;
  }
  return { record: next, changed: true };
}
export function submissionMessage(r) {
  return `${r.kind === 'sale' ? 'Sale' : 'Expense'} ${r.reference} recorded.\n${money(r.amount_cents)} · ${PROJECTS[r.project || r.proposed_allocation]}\nStatus: ${r.status}.`;
}
export function decisionMessage(r) {
  if (r.kind === 'sale') {
    const changed = r.proposed_split.some((n, i) => n !== r.approved_split[i]);
    return `Sale ${r.reference} approved — commission split ${changed ? 'changed' : 'unchanged'}.\nSale ${money(r.amount_cents)}; total commission ${money(r.pool)}.\n` + SALESPEOPLE.map((id, i) => `${EMPLOYEES.find(e => e.id === id).name}: ${percent(r.proposed_split[i])} → ${percent(r.approved_split[i])} (${money(r.earned[i])}).`).join('\n');
  }
  return `Expense ${r.reference} — allocation ${r.proposed_allocation !== r.final_allocation ? 'changed' : 'confirmed'}.\n${money(r.amount_cents)}: ${r.description}\nProposed: ${PROJECTS[r.proposed_allocation]}.\nApproved: ${PROJECTS[r.final_allocation]}.`;
}
export function totals(records) {
  const project = () => ({ income: 0, commission: 0, expenses: 0, result: 0 });
  const out = { A: project(), B: project(), company: { ...project(), overhead: 0, awaiting: 0 }, earned: [0, 0, 0], pendingSales: 0, pendingCount: 0 };
  for (const r of records) {
    if (r.kind === 'sale') {
      if (r.status !== 'Approved') { out.pendingSales += r.amount_cents; out.pendingCount++; continue; }
      out[r.project].income += r.amount_cents; out[r.project].commission += r.pool;
      out.company.income += r.amount_cents; out.company.commission += r.pool;
      r.earned.forEach((n, i) => out.earned[i] += n);
    } else {
      out.company.expenses += r.amount_cents;
      if (r.final_allocation === 'overhead') out.company.overhead += r.amount_cents;
      else if (r.final_allocation) out[r.final_allocation].expenses += r.amount_cents;
      else { out.company.awaiting += r.amount_cents; out.pendingCount++; }
    }
  }
  for (const key of ['A', 'B', 'company']) out[key].result = out[key].income - out[key].commission - out[key].expenses;
  return out;
}
