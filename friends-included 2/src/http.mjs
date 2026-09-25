import { timingSafeEqual } from 'node:crypto';
import { AppError } from './domain.mjs';
export function secretMatches(actual, expected) {
  if (!expected || typeof actual!=='string') return false;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
export function json(res, status, value) {
  res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
  res.statusCode=status; res.end(JSON.stringify(value));
}
export async function body(req) {
  if (req.body && typeof req.body==='object') return req.body;
  if (typeof req.body==='string') return JSON.parse(req.body);
  let raw='';
  for await (const chunk of req) { raw+=chunk; if (raw.length>20000) throw new AppError('Request too large.',413); }
  try { return JSON.parse(raw||'{}'); } catch { throw new AppError('Invalid JSON request.'); }
}
export function failure(res,error) { json(res,error.status||503,{error:error instanceof AppError?error.message:'Service temporarily unavailable. Your saved records are retained; refresh before retrying.'}); }
