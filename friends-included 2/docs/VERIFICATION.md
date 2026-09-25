# Verification record

Verified locally on 25 September 2026. This records development verification, not completion of the live coursework integrations.

## Completed

- **16 automated tests passed** using Node's test runner.
- JavaScript syntax checks and static build passed.
- The actual Supabase SQL schema executed successfully in **PGlite 0.5.8**, an embedded PostgreSQL runtime. Both homework scenarios ran against that schema, rather than only a memory mock.
- Database checks covered service-role grants, denied anonymous table/function access, duplicate references, immutable original submission fields, manager-only decisions, repeated approval, worker leases and version-guarded synchronization completion.
- Test 1 before approval: company −€300.00; both project results zero.
- Test 1 after approval: A €700.00, B €1,800.00, company €2,400.00; commissions €90.00 / €110.00 / €100.00.
- Test 2 cumulative: A €2,050.00, B €2,180.00, company €3,930.00; commissions €140.00 / €175.00 / €215.00. S05 and E07 remain pending.
- HTTP-level tests denied Kevin's sale submission, Richard's approval, an unknown role and unauthenticated Telegram webhook requests. Staff state excludes company totals and other employees' records.
- Mocked integration tests covered Sheets/Telegram errors, visible failed statuses, safe retries, one stable Sheets row, corrected splits, duplicate webhook delivery, original bot recipients after role relinking, website recipient resolution at approval, concurrent worker exclusion and RAW spreadsheet text.
- Browser checks exercised the actual UI: an invalid 110% split was rejected while preserving the form; a valid sale was saved; Svetlana changed and approved the split; financial totals and individual earnings updated.
- The twelve-record local sample preview shows €3,930.00 company result and the expected commission totals.
- Responsive checks at 1365 px and 390 px widths showed no page-level horizontal overflow; wide data tables use their own horizontal scrolling containers. The expense form and role-specific navigation were inspected at phone width.

## Still required with the owner's accounts

- Create/link the actual Telegram bot, Supabase project, Google service account and spreadsheet.
- Deploy to Vercel from the owner's GitHub repository.
- Verify the actual Supabase REST API against the deployed functions, including environment values and project permissions.
- Submit S01 and E01 through the actual bot; receive real recording and decision messages.
- Run both coursework sequences on the live system and inspect actual Sheets rows and persistence after refresh.
- Check a real interrupted Sheets update and failed Telegram notification, then recover using retry.
- Add/check the bot, Sheets and repository links, and submit the Vercel URL in the owner's course row.

No live external integration was available during local development, and none is reported as completed. External services were mocked for automated delivery tests. The local preview never claims to have synchronized or sent a notification.
