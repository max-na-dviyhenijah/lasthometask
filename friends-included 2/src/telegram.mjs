import { AppError, requireRole } from './domain.mjs';
export function parseCommand(message) {
  const match=message.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (!match) throw new AppError('Use /sale or /expense. Send /help for examples.');
  const command=match[1].toLowerCase(), parts=(match[2]||'').split('|').map(s=>s.trim());
  if (command==='sale') {
    if (parts.length!==8) throw new AppError('Use /sale REF | CUSTOMER | A or B | AMOUNT | DESCRIPTION | RICHARD % | ANASTASIA % | JEAN-CLAUDE %');
    return {kind:'sale',reference:parts[0],customer:parts[1],project:parts[2].toUpperCase(),amount:parts[3],description:parts[4],split:parts.slice(5)};
  }
  if (command==='expense') {
    if (parts.length!==5) throw new AppError('Use /expense REF | AMOUNT | Materials, Travel or Other | A, B or overhead | DESCRIPTION');
    const allocation=parts[3].toLowerCase();
    return {kind:'expense',reference:parts[0],amount:parts[1],category:parts[2][0]?.toUpperCase()+parts[2].slice(1).toLowerCase(),allocation:['overhead','company overhead'].includes(allocation)?'overhead':allocation.toUpperCase(),description:parts[4]};
  }
  return {command};
}
export async function handleTelegram(update, service, telegram, appUrl) {
  const message=update?.message;
  if (!message || message.chat?.type!=='private' || !message.from || message.from.is_bot) return;
  const chat=String(message.chat.id), user=String(message.from.id);
  if (typeof message.text!=='string') { await telegram.send(chat,'Please send a text command. Use /help for examples.'); return; }
  try {
    const input=parseCommand(message.text);
    if (['start','help','id'].includes(input.command)) {
      await telegram.send(chat,`Friends Included finance\nYour Telegram user ID: ${user}\nAsk the manager to link this ID to an employee in Manager setup. You cannot choose a role here.\n\n/sale S01 | Olivia Rose | A | 1000 | One proud uncle and an emotional grandmother | 50 | 30 | 20\n\n/expense E01 | 120 | Materials | A | Rented suit and fake pearl necklace for the relatives\n\n/status — your recorded transactions\nWebsite: ${appUrl || 'Ask the manager for the website link.'}`); return;
    }
    const link=(await service.store.links()).find(l=>l.user_id===user);
    if (!link) throw new AppError(`Your Telegram account is not linked. Ask the manager to link user ID ${user}.`);
    requireRole(link.employee);
    if (input.command==='status') {
      const {records}=await service.state(link.employee);
      await telegram.send(chat,records.length ? records.slice(-20).map(r=>`${r.reference}: ${r.status}`).join('\n') : 'No transactions recorded for your current role.'); return;
    }
    if (input.command) throw new AppError('Unknown command. Use /help for available commands.');
    // Telegram may redeliver a webhook. Recognise the exact originating message,
    // while rejecting a new message that attempts to reuse an existing reference.
    const ref=String(input.reference).toUpperCase();
    const old=await service.store.get(ref);
    const submissionKey=`${chat}:${message.message_id}`;
    if (old?.data.telegram_message_key===submissionKey) return;
    const origin={source:'telegram',chatId:chat,messageKey:submissionKey};
    await service.submit(link.employee,input,origin);
    // The saved submission confirmation is delivered by the durable outbox.
  } catch (error) {
    if (!(error instanceof AppError) || error.status>=500) throw error;
    await telegram.send(chat,`Not recorded: ${error.message}`);
  }
}
