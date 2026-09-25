# Run the two live homework tests

Use an empty live Supabase database. All figures below are expected checks, not values hard-coded into the dashboard. Percentages always follow **Richard / Anastasia / Jean-Claude**.

## Test 1

1. Start the actual bot. In the website's Manager setup, link your numeric Telegram user ID to Richard.
2. Send this command to the actual bot and wait for its recording confirmation:

```text
/sale S01 | Olivia Rose | A | 1000 | One proud uncle and an emotional grandmother | 50 | 30 | 20
```

Check S01 exists in Supabase, on the Vercel website and in the Sales tab. It must show Pending approval, proposed shares 50/30/20, no approved shares and zero earned commission. This is the first complete integration milestone.

3. In Manager setup, change the same Telegram ID to Kevin. Send:

```text
/expense E01 | 120 | Materials | A | Rented suit and fake pearl necklace for the relatives
```

4. Use the website role selector for these remaining entries:

| Role | Ref | Customer / description | Project / allocation | Amount | Split / category |
|---|---|---|---|---:|---|
| Anastasia | S02 | Daniel King — University friends, dancing, and the stripping performance | B | 2000.00 | 0 / 50 / 50 |
| Kevin | E02 | Taxi for the grandmother; Kevin selected the wrong project | B | 80.00 | Travel |
| Kevin | E03 | Monthly company website subscription | Company overhead | 100.00 | Other |

Before approvals: both sales are pending; E01/E02 await allocation; E03 is automatically overhead. Approved income and commissions are zero. Both project results are zero. Company result is **−€300.00**.

5. Select Svetlana and perform these actions in Approvals:

| Reference | Decision |
|---|---|
| S01 | Approve 50 / 30 / 20 |
| S02 | Change to 20 / 40 / 40 and approve |
| E01 | Confirm A |
| E02 | Change B to A and confirm |

Verify the S01 and E01 decisions arrive in your original private Telegram chat, despite relinking from Richard to Kevin. S01's employee must remain Richard. For unlinked website submitters, the ledger must explicitly show No Telegram recipient linked.

| Measure | A | B | Company |
|---|---:|---:|---:|
| Approved income | 1000.00 | 2000.00 | 3000.00 |
| Commission expense | 100.00 | 200.00 | 300.00 |
| Allocated project expenses | 200.00 | 0.00 | 200.00 |
| Overhead | — | — | 100.00 |
| Awaiting allocation | — | — | 0.00 |
| Result | 700.00 | 1800.00 | 2400.00 |

Commissions: Richard **€90.00**, Anastasia **€110.00**, Jean-Claude **€100.00**.

Open the actual Google Sheets tabs. The corrected values must be on the original rows, and the original proposals must still be visible in their separate columns. Refresh the Vercel page and confirm persistence before Test 2.

## Test 2

Keep all Test 1 records. Enter these sales through the website:

| Role | Ref | Customer | Description | Project | Amount | Proposed split |
|---|---|---|---|---|---:|---|
| Jean-Claude | S03 | Emma Stonebridge | Premium relatives, including an uncle presented as a surgeon | A | 1500.00 | 40 / 40 / 20 |
| Richard | S04 | Lucas Green | Small group of loud university friends | B | 800.00 | 25 / 25 / 50 |
| Richard | S05 | Mia Brooks | Extra guests and an embarrassing speech | B | 600.00 | 100 / 0 / 0 |

Enter these expenses as Kevin:

| Ref | Description | Category | Amount | Proposed allocation |
|---|---|---|---:|---|
| E04 | Replacement costumes after an enthusiastic dance performance | Materials | 250.00 | B |
| E05 | Minibus for university friends; Kevin selected the wrong project again | Travel | 90.00 | A |
| E06 | Company telephone subscription | Other | 60.00 | Company overhead |
| E07 | Emergency replacement clothing; project allocation still needs checking | Materials | 140.00 | A |

Link your Telegram ID to Jean-Claude **before approving S03**. Change S03's shares to 20/30/50 and approve. Verify a changed-split message with a €150.00 pool and individual earnings of €30.00 / €45.00 / €75.00.

Approve S04's 25/25/50 proposal. Leave S05 pending.

Link your Telegram ID to Kevin **before approving E04 and E05**. Confirm E04 to B. Change E05 from A to B and confirm. Its notification must say €90.00 moved from Respectable Relatives to Drunk University Friends. Leave E07 awaiting allocation. E06 is automatically overhead.

| Measure | A | B | Company |
|---|---:|---:|---:|
| Approved income | 2500.00 | 2800.00 | 5300.00 |
| Commission expense | 250.00 | 280.00 | 530.00 |
| Allocated project expenses | 200.00 | 340.00 | 540.00 |
| Overhead | — | — | 160.00 |
| Awaiting allocation | — | — | 140.00 |
| Result | 2050.00 | 2180.00 | 3930.00 |

Commissions: Richard **€140.00**, Anastasia **€175.00**, Jean-Claude **€215.00**. S05 is €600.00 pending sales and contributes no income or commission. E07's €140.00 is already included in company expenses. Reconciliation: 2050 + 2180 − 160 − 140 = **3930**.

## Permission and failure checks

The automated suite checks these at the shared processing layer and HTTP layer where applicable. Also inspect the deployed website:

- 60/30/20 shares: refuse submission.
- Richard attempting approval: deny. Kevin attempting a sale: deny.
- Missing/zero expense amount: refuse submission.
- Repeated approval: no new financial effect or notification job.
- Reused reference: refuse the new submission.
- Staff view: own submissions only; no company totals.

To test a real interrupted Sheets update without altering control totals, temporarily remove the service account's Editor access before an otherwise required approval, approve once, and check the decision is saved with Sync failed. Restore Editor access and use Retry pending deliveries. The same reference must appear once with its final decision. Do this only in your own coursework spreadsheet.

To test a real failed Telegram decision, block your own bot before an otherwise required decision. The decision must remain saved, with notification Failed. Unblock/start the bot, retry, and check delivery. Do not claim the notification was sent while it is failed.

## Submit

Leave all twelve completed test records in place, with S05 and E07 still pending. Verify the page displays Maksims Paņuškins, the role selector, forms, controls, dashboard and working links to the bot, viewable Sheets and accessible GitHub repository.

Submit only the working **Vercel URL** in your own Day 4 cell of the course submission spreadsheet. Do not edit other people's rows or feedback. No separate report is required.
