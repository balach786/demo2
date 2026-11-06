# CLIENT DEMO WALKTHROUGH

**AI Business Secretary & Accountant — interactive demonstration**
Business shown: **ABC Trading Company** · Currency: **PKR** · All data fictional

This is a guided tour you can follow yourself, in order, in about 15 minutes. Every number below is the
figure the seeded demo actually shows. If a screen looks different, click the **Reset demo data** icon in the
top-right corner to return to this starting state.

---

## 0. Start the demo

```bash
npm install
npm run dev
```
Open **http://localhost:5173**.

> **DEMO MODE** is shown in the top bar at all times. Everything on screen is fictional sample data, stored
> only in this browser — nothing is sent anywhere.

**First action:** click the reset icon (circular arrow, top-right) → **Reset demo data** → confirm.
You are now at the exact starting position this walkthrough assumes.

---

## 1. Dashboard — understand the business in 30 seconds

You land on **Dashboard**. Read the top KPI row left to right:

| KPI | Value |
|---|---|
| Total Cash Balance | **PKR 5,804,400** |
| Total Bank Balance | **PKR 11,095,050** |
| Total Sales | **PKR 23,896,700** |
| Total Purchases | **PKR 16,314,350** |
| Total Expenses | **PKR 4,493,050** |
| Net Profit | **PKR 2,850,100** (11.9 % margin) |
| Receivables | **PKR 5,823,350** |
| Payables | **PKR 6,428,400** |
| Inventory | **PKR 2,760,150** |

Below the KPIs: **Revenue vs Expenses**, **Monthly Profit**, **Cash Flow** and **Sales vs Purchases**
charts — hover any point and a tooltip shows the exact figures.

Click the period button in the top bar (it reads “This Year”) and switch to **Today**, **This Week**,
**This Month** or **Last Month**. Every card and chart re-computes from the same dataset — for example,
**Today’s sales are PKR 658,500**.

**What this proves:** one shared data source drives the whole dashboard; nothing is hardcoded per widget.

---

## 2. Parties — customers, suppliers, balances

Sidebar → **Parties**.

- **All** shows 8 parties (4 customers, 4 suppliers). Use the **Customers / Suppliers** tabs and the search box.
- Click **Ahmed Enterprises** (customer). Their profile shows an opening balance, the current outstanding
  balance (**PKR 1,642,100 receivable**), payment terms and their full ledger, with a link through to
  the Ledger page.

**What this proves:** party sub-ledgers exist and agree with the receivable and payable totals on the
dashboard.

---

## 3. Create a transaction and watch everything update

Sidebar → **Transactions** → **New transaction** (top-right).

1. Choose **Money Paid**.
2. Amount: **15000**. Supplier: **ABC Traders**. Description: “Client demo payment”.
3. Notice the **Journal preview** at the bottom of the form: debit Accounts Payable, credit HBL Business —
   *Debits = Credits* is shown live. A form that cannot balance cannot be posted.
4. Click **Post transaction**.

Now walk the effect through the system:

| Check | Where | Expected |
|---|---|---|
| Voucher appears with a generated reference (`PV-2026-0xx`) | Transactions | row at the top |
| ABC Traders’ balance falls by 15,000 | Parties → ABC Traders | 1,762,700 → **1,747,700** |
| Bank balance falls by 15,000 | Dashboard | 11,095,050 → **11,080,050** |
| Payables fall by 15,000 | Dashboard | 6,428,400 → **6,413,400** |
| Ledger shows the posting | Ledgers → Accounts Payable / HBL | new row with running balance |

Try the other seven voucher types the same way — **Money Received, Sales Invoice, Purchase Invoice,
Expense, Cash Deposit, Cash Withdrawal, Bank Transfer**. Deposits, withdrawals and bank transfers never
change total cash + bank: money only moves between the company’s own accounts.

**What this proves:** real double-entry behaviour — validated forms, generated references, and every
dependent screen updating from one ledger.

---

## 4. Ledgers and financial reports

Sidebar → **Ledgers**: pick any account and read its full history with a running balance.

Sidebar → **Financial Reports** — six tabs:

| Report | What to look at |
|---|---|
| **Profit & Loss** | Revenue 23,896,700 · COGS 16,727,650 · expenses 4,493,050 · **net profit 2,850,100** |
| **Trial Balance** | debit and credit totals both **108,539,000** — difference **0** |
| **Balance Sheet** | Assets **28,082,950** = Liabilities **7,928,400** + Equity **20,154,550** |
| **Cash Flow** | opening + movement = closing, marked “Reconciles” |
| **Party Ledger** | per-party statement |
| **Account Ledger** | per-account statement |

Each report has **Print / PDF** and **Export CSV**.

**What this proves:** the statements are not decorative — they are derived from the journal and they
balance. A balance sheet is only shown because Assets = Liabilities + Equity actually holds.

---

## 5. Ask the AI Secretary

Sidebar → **AI Command Center**. Type these (or click a suggested chip):

| Command | What you get |
|---|---|
| `Aaj ki total sales kitni hain?` | today’s sales — **PKR 658,500** |
| `Business ka current cash balance batao.` | cash, bank and total, with a breakdown |
| `Ahmed ka ledger dikhao.` | that party’s balance, terms and recent movements |
| `Is month ka profit calculate karo.` | this month’s profit with revenue/expense split |
| `Ali Traders ko kitni payment deni hai?` | the outstanding payable |
| `Show me the last 10 transactions.` | a real table from the ledger |
| `Show monthly revenue and expenses.` | month-by-month comparison |
| `Prepare a payment of Rs. 25,000 to ABC Traders.` | an **action preview** — nothing is posted |

Notice what happens with the last one: the assistant shows the wizard-style card with the amount, party,
account, projected balance and confidence, plus **Approve** and **Discard**. It also asks before acting when
information is missing (“Which party?”, “What amount?”) and refuses to guess.

**Say this out loud:** the assistant in this demo is a **deterministic rules engine** running in the browser
against the demo data — it is not connected to an LLM API. The screen labels it as a simulated assistant.
The workflow it demonstrates (understand → preview → human approval → post) is exactly the workflow the
production assistant would use.

---

## 6. Documents

Sidebar → **Documents**.

- The library contains three bundled sample documents. Selecting one shows a document preview, the
  **extracted fields** (party, amount, date, reference) with a **Confidence 94 %** badge, and a clear label:
  **“SIMULATED EXTRACTION — NOT PRODUCED BY A REAL OCR ENGINE”**.
- Upload your own **JPG / PNG / PDF**. The file previews, but the fields stay **empty** — this demo does not
  invent extracted values. You type the amount and party yourself (that is the manual-correction step).
- Click **Prepare transaction draft**: you are taken to **Approvals** with a pending item. Nothing has been
  posted.

Also worth showing: a `.txt` is refused, a 0-byte file is refused, and re-uploading the same file name is
flagged as a duplicate.

---

## 7. Approvals — the control the client cares about

Sidebar → **Approvals**. Five seeded items across the tabs **All / Pending / Drafts / Completed / Rejected**.

1. Open a pending item → read the draft: voucher type, party, amount, both journal lines and the balance
   the ledger will move to.
2. **Approve & post** → status becomes **Completed**, a voucher reference is generated (`PV-…`), the toast
   shows the new balance, and the dashboard/ledger update.
3. Open another pending item → **Reject**, type a reason → status **Rejected**, and **no ledger entry is
   created** (go back to Dashboard: the balances did not move).
4. **Edit draft** → change the amount → the item returns to **Pending** with the new figure.

**What this proves:** no financial action posts without a human decision, rejections leave no trace in the
books, and duplicate approvals are blocked (a second click on the same item cannot post it twice).

---

## 8. Persistence — refresh and nothing is lost

1. Post any transaction (step 3).
2. Press **F5** (or close the tab and reopen **http://localhost:5173**).
3. The transaction is still there, and the dashboard still reflects it.

To get back to a clean demonstration: reset icon → **Reset demo data** → confirm. That clears **only** this
app’s demo records — nothing else in the browser is touched. (There is a **Cancel** button if you clicked by
mistake.)

**Say this out loud:** records live in this browser only — no cloud, no database, no real bank connection.
That is deliberate for the demo phase; production persistence is the next phase.

---

## 9. Where everything lives

| Page | Purpose |
|---|---|
| Dashboard | Executive view of the business |
| AI Command Center | Natural-language questions and prepared actions |
| Parties | Customers, suppliers, profiles, balances |
| Chart of Accounts | Assets, liabilities, equity, income, expenses |
| Transactions | All eight voucher types, search and filters |
| Ledgers | Account and party statements |
| Bank Accounts | Cash, HBL, Meezan with balances and history |
| Expenses & Income | Category breakdown and period totals |
| Financial Reports | The six statements |
| Documents | Upload, preview, extraction, draft preparation |
| Approvals | Draft → Pending → Approved → Completed / Rejected |
| Settings | Data provenance, storage status, reset |

---

## 10. What is real, what is simulated — stated plainly

| Area | In this demo |
|---|---|
| Double-entry accounting, ledgers, trial balance, P&L, balance sheet, cash flow | **Real logic**, computed from the journal |
| Dashboard KPIs and charts | **Real**, computed from the same dataset |
| Transaction validation, references, approval workflow | **Real** |
| Persistence | **Browser `localStorage` only** — no database, no cloud |
| AI assistant | **Simulated** — deterministic rules, no LLM API |
| Document extraction | **Simulated** — sample documents carry pre-set values; uploads yield no extracted fields |
| Bank integrations, payments, e-mails, OCR, multi-user login | **Not implemented** (labelled as planned in Settings) |

---

## 11. What the next phase would add

1. Backend API + MongoDB Atlas persistence, with the same data model shown here.
2. User accounts, roles and permissions (preparer / approver).
3. Real document OCR and an LLM-backed assistant using the same intent → preview → approval workflow.
4. Real bank-statement import and reconciliation.
5. Multi-company support, audit trail and backups.

---

## 12. If something looks wrong

| Symptom | Fix |
|---|---|
| Numbers differ from this guide | Reset demo data (you may be looking at your own test records) |
| Blank page after an update | Hard-refresh (Ctrl/Cmd + Shift + R); restart `npm run dev` if the code changed |
| “In memory only” in Settings | The browser is blocking storage (private window or full quota) — use a normal window |
| Uploaded file preview is empty after reopening the browser | Expected: previews are session-only; re-upload to preview again — the document record is still saved |
| Demo state looks corrupted | Reset demo data; the app also falls back to the seed automatically if saved data is invalid |

---

**Reminder for the meeting:** this build is a **client demonstration**, not a production system. It is
designed to show the workflows, screens and financial behaviour the full build would deliver — with all
data fictional and no real bank or database connection.
