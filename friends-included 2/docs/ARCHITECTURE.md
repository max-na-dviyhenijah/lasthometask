# Implementation notes

## Trust and storage

The browser sends a selected fictional employee ID in `x-demo-role`. This is the explicitly requested demonstration mechanism, not secure authentication. Server-side role checks still apply to every action. Do not use the application for real financial information.

Telegram requests must have the configured secret header. The sender's numeric ID is looked up in `fi_links`; message text cannot select the actor. Linking accounts requires both the Svetlana role and the private manager setup key. The browser does not receive existing Telegram IDs unless that key is provided. Transaction responses omit chat IDs and originating Telegram message identifiers.

Supabase is the sole live source of truth. Tables have RLS enabled and no anonymous/authenticated grants. Only server-side service-role requests can access them. The database stores employees, current Telegram links, immutable submission fields, final decisions, stable spreadsheet row positions and separate delivery jobs.

## Shared processing

Both website actions and parsed Telegram commands call `FinanceService`. Validation handles required fields, positive two-decimal euro amounts, allowed categories/projects, role permissions and exact 100% split totals. Integer cents and basis points avoid binary-decimal rounding surprises. The 10% commission pool and individual amounts round to cents; the residual is assigned to the largest share with the required tie order.

`fi_save` writes the financial record and notification job in one PostgreSQL transaction. Unique references prevent duplicates. Approvals lock the row, check its state/version and preserve original submission fields. A repeated or racing approval cannot create another decision or commission. Totals are computed from current records; no mutable balance counter can accidentally be incremented twice.

Website submissions capture a linked recipient if available. At website approval, the employee's current linked chat is preferred, then the captured chat is used as fallback. This supports the homework's instruction to link Jean-Claude/ Kevin before Test 2 decisions. Telegram submissions always use the immutable original submitting chat, regardless of later role relinking.

## Delivery outbox

After a successful financial commit, the request processes a bounded delivery batch. Sheets sync status and notification status are independent from financial status. A database lease serializes workers; version-aware completion prevents an old Sheets write from marking a newer decision synchronized. Retry candidates are ordered by oldest attempt so persistent failures do not permanently block newer entries.

Google uses a service-account RS256 JWT and Sheets API. RAW input prevents descriptions beginning with `=` from becoming spreadsheet formulas. Each database reference owns one permanent row; no append operation is used. An interrupted write can safely be repeated on the same row. The two tabs include separate proposed percentages, approved percentages and individual earned commissions.

Telegram uses `sendMessage`. Recording confirmations and manager decisions are queued only after a successful database transaction. Successful HTTP/API responses mark jobs Sent; exceptions mark Failed. Exact redelivery of the same Telegram submission message does not record another transaction. A new message reusing the reference is rejected.

As with most external messaging APIs, if Telegram accepts a message but the network response is lost before the database acknowledges it, a retry can deliver that message twice. Financial records and commission totals remain idempotent. Telegram provides no general sendMessage idempotency key; exactly-once messaging across that failure window is not claimed.

Normal submissions/decisions trigger delivery automatically. A manual retry handles reported failures. An optional external authenticated scheduler can process pending work when nobody uses the application. Batches may need multiple retry calls after a prolonged outage. A hard function interruption can hold the delivery lease for up to 90 seconds; records remain saved.

## Local mode

`npm run preview` uses an explicit memory store and fills it from the same test inputs and approval functions. It never talks to external services or labels delivery as successful. The application refuses local-memory mode on Vercel. The runtime has no external npm dependencies; the optional database verifier uses PGlite only for development.

## Deliberate scope

No VAT, commission-payment tracking, editing approved transactions, arbitrary deletion, real-company authentication, AI model, spreadsheet-to-database import or automatic course submission is included. These are outside the homework scope. Source sheet rows should not be moved; filter views are safe.
