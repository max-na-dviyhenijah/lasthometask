# Connect and launch

Complete these steps in order. All secret values belong in Vercel environment variables and, if you use the command-line helpers, your local ignored `.env.local` file. Do not paste secrets into GitHub, the website source or the coursework spreadsheet.

## 1. GitHub

Create a repository containing the contents of `friends-included` at its root. The root must contain `package.json` and `vercel.json`. Make the repository accessible to the instructor, either publicly with fictional source data only or through an appropriate invitation. Keep the repository URL for `PUBLIC_GITHUB_URL`.

## 2. Supabase

Create a new Supabase project. In its SQL Editor, run all of `supabase/001_schema.sql` once. The script creates five employees, tables, row-level security and service-role-only functions. It intentionally inserts no transactions.

Copy the project URL and the **server-side service_role API key** into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Use the legacy JWT service_role key supported by this REST adapter. Do not use the anon/publishable key. The browser never receives this key or connects directly to Supabase.

If you run the installation script twice, existing-table errors are expected. Do not delete a project containing the final test records. Use a new empty project for a clean installation, or ask for a migration.

Official reference: https://supabase.com/docs/guides/database/functions

## 3. Google Sheets

1. Create a Google Cloud project and enable **Google Sheets API**.
2. Create a service account, then create a JSON key for that account.
3. Create a new blank spreadsheet for this application. Share it with the service account's `client_email` as **Editor**.
4. From the JSON key, copy `client_email` to `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` to `GOOGLE_PRIVATE_KEY`.
5. Copy the spreadsheet ID from the part between `/d/` and `/edit` in its URL to `GOOGLE_SHEET_ID`.
6. Give the instructor **Viewer** access. Do not make the spreadsheet publicly editable.

The app creates `Sales` and `Expenses` tabs if they do not exist. Each reference owns a permanent row number. Approvals and retries overwrite that same row. Rows can contain gaps because references share one database sequence. Do not physically sort, insert or delete rows in these source tabs; use filter views or a separate analysis tab. Spreadsheet edits are not imported into Supabase.

In Vercel, paste the entire private key including its BEGIN/END lines into the environment-variable value, without surrounding quotation marks. Both real newlines and literal `\n` sequences are accepted. For `.env.local`, keep the quoted single-line example format with `\n` escapes.

If your school blocks service-account creation or JSON key downloads, record the exact policy restriction and contact the instructor. The application does not substitute manual spreadsheet copying.

Official references:

- https://developers.google.com/workspace/guides/create-credentials
- https://developers.google.com/identity/protocols/oauth2/service-account
- https://developers.google.com/workspace/sheets/api/guides/values

## 4. Telegram

In Telegram, open the verified **@BotFather** account and create a bot using `/newbot`. Choose a display name and an available username ending in `bot`. Keep its token private.

Save the token as `TELEGRAM_BOT_TOKEN`. Set `PUBLIC_BOT_USERNAME` to the username without `@`.

Choose two different strong random secrets: `TELEGRAM_WEBHOOK_SECRET` and `MANAGER_SETUP_KEY`. For the webhook secret, use 32–256 letters, digits, hyphens or underscores. A password manager can generate these. The first authenticates Telegram webhook deliveries. The second is entered only in the manager linking screen and is not needed by the instructor to test financial approvals.

The bot does not allow users to choose their own employee identity. A manager links their numeric Telegram ID to an employee on the website. Only private bot chats are supported.

## 5. Vercel

Import the GitHub repository into Vercel. Use the repository root as Root Directory and **Other** as the framework preset. The included configuration sets:

- Build command: `npm run build`
- Output directory: `dist`
- Server functions: `api/app.js` and `api/telegram.js`

Add these environment variables for the Production environment before the final deployment:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-side service_role JWT key |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Your random webhook secret |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | JSON `client_email` |
| `GOOGLE_PRIVATE_KEY` | Complete JSON `private_key` |
| `GOOGLE_SHEET_ID` | Spreadsheet ID |
| `APP_URL` | Stable production URL, such as `https://your-project.vercel.app` |
| `PUBLIC_BOT_USERNAME` | Bot username without `@` |
| `PUBLIC_GITHUB_URL` | Instructor-accessible repository URL |
| `PUBLIC_AUTHOR_NAME` | `Maksims Paņuškins` |
| `MANAGER_SETUP_KEY` | Your separate manager-linking secret |

`LOCAL_DEMO` should be absent or false. Even if accidentally set to true, the Vercel environment disables local-memory mode. Missing Supabase credentials produce an explicit setup error, never a fake successful save.

Deploy once to learn the stable production URL if needed, set `APP_URL`, then redeploy. Environment changes apply to new deployments. Make sure the production URL is accessible to Telegram and the instructor without Vercel deployment protection. Do not expose unrelated private projects.

Official Vercel reference: https://vercel.com/docs/functions/runtimes/node-js

## 6. Register the webhook

On your computer, copy `.env.example` to `.env.local` and fill the same real values. From the project folder run:

```sh
npm run check:config
npm run telegram:setup
```

The setup helper registers `https://YOUR-VERCEL-URL/api/telegram` with the secret token, installs the command menu, and checks Telegram's webhook information. It does not delete pending updates. If you replace the stable domain later, update `APP_URL`, redeploy and run the helper again.

Open your bot's link and press **Start**. Copy the numeric user ID in its reply. On the website, select Svetlana, open **Manager setup**, enter `MANAGER_SETUP_KEY`, and link the ID to Richard. The manager key stays in page memory, not browser storage. Reloading the page clears it.

Official Telegram reference: https://core.telegram.org/bots/api#setwebhook

## 7. Run the real coursework tests

Follow `COURSEWORK-TESTS.md`. Start from the empty database created by the installation script. Use S01 as the first end-to-end milestone: Telegram submission → Supabase record → Vercel record → Google Sheets row. Do not proceed until it works. S01 and E01 must originate from the actual bot.

No live test-data seeding endpoint is provided. The local preview does not write to your database. If you used temporary practice transactions in a live project, use a new empty project before Test 1 or deliberately clear only those practice records with assistance. Never clear the completed two-test dataset before submission.

## Delivery failures and retries

The database commits first. A later Google or Telegram failure leaves the financial record intact. Check **Transactions → Delivery**. Svetlana can select **Retry pending deliveries** from Transactions or Manager setup. Repeat if a larger backlog remains: work is processed in bounded batches suitable for serverless execution. Every new successful submission and decision also automatically attempts pending delivery.

For unattended recovery while nobody uses the website, configure an external scheduler to call `POST https://YOUR-URL/api/app?action=retry` with `Authorization: Bearer YOUR_RETRY_SECRET`. Set a strong `RETRY_SECRET` in Vercel first. This is optional; normal submissions/decisions already trigger delivery and the manual recovery button is available. The repository does not create a paid scheduler.

| Symptom | Check |
|---|---|
| Website reports Supabase not configured | Production environment variables and redeployment |
| Database request failed | Schema installed; correct service_role key and project URL |
| Bot silent after `/start` | Webhook registration, stable HTTPS URL, deployment protection, bot token |
| Bot says account not linked | Manager setup: numeric ID, correct fictional employee |
| Telegram delivery failed (403) | Recipient has started the bot and has not blocked it |
| Sheets authorization failed | Full private key and matching service-account email |
| Sheets update failed (403) | Sheets API enabled and spreadsheet shared with that service account as Editor |
| No Telegram recipient linked | There was no linked chat for that employee; this is not a sent notification |
| Saved record, Sync pending/failed | Retry delivery; do not resubmit the reference |

Do not change the spreadsheet ID after recording data without a deliberate full resynchronization. A new spreadsheet will not contain previously synchronized records automatically.
