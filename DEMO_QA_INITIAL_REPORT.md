# DEMO QA — INITIAL REPORT

**Project:** AI Business Secretary — Demo (ABC Trading Company)
**Artifact under test:** `/home/user/ai-business-secretary` (build `1.0.0-demo`)
**Test date:** 2026-11-06 · **Reviewer role:** Senior QA / Full-Stack Testing / Financial Software Auditor / UI-UX / Security
**Mandate:** test, verify, identify, report. No redesign, no rebuild, no new features.

> **Scope statement.** This is a **demo / prototype** application: React 18 + Vite SPA, all data in
> browser `localStorage`, no backend, no database, no bank integration, no OpenAI call. Every test below
> was executed against the running app in a real Chromium browser (`localhost:5173`) or against the
> demo's own accounting engine — nothing is reported as passing that was not actually executed.
> Passing these tests does **not** imply production readiness.

---

## 1. Environment & how testing was executed

| Item | Value |
|---|---|
| Node / npm | v22.x, npm 12.2.2 (sandbox) |
| App server | `npm run dev` → Vite 5.4.21, `0.0.0.0:5173` (strict port, `hmr: false`) |
| Browser | Playwright 1.48.2 → Chromium 1140 (headless, `--no-sandbox`) |
| State under test | Fresh seeded demo: 412 journal entries, 1,000 lines, 18 accounts, 8 parties, 5 approvals |
| Verification oracle | `scripts/figures-entry.ts` — compiles the app's **own** accounting engine, so every UI figure is compared against the ledger that produced it (not against a hand-typed expectation) |
| QA harness | `scripts/qa/harness.mjs`, `audit-ui.mjs`, `audit-financial.mjs`, `audit-ai-docs.mjs` |

Because this demo keeps all figures in one deterministic dataset, the audit compares **rendered text
scraped from the DOM** with **values recomputed from the journal** in Node. That is the strongest
available check short of a real database, and it caught the differences listed in §5.

**Note on environment:** the sandbox was reset between sessions — `node_modules`, the Chromium cache and
the Chromium system libraries had to be re-installed before any test could run. Nothing from an earlier
session was assumed to be still valid; every number in this report was produced today.

---

## 2. Phase 2 — Startup, routing, console health

| Check | Result |
|---|---|
| App starts, no missing dependencies | **PASS** — Vite ready in 189 ms |
| TypeScript compile (`tsc --noEmit`) | **PASS** — 0 errors |
| Production build (`vite build`) | **PASS** — 1,597 modules, JS 411.15 kB (gzip 114.23 kB), CSS 28.18 kB (gzip 6.91 kB) |
| 13 routes render with a page title and real content | **PASS** — 13/13 (body text 1.6 kB–18.2 kB per page) |
| Broken images / missing assets | **PASS** — 0 |
| Console errors, page errors, failed HTTP responses | **PASS** — 0 across the whole sweep |
| Sidebar has 12 destinations, every one click-through navigates | **PASS** — 12/12 |
| Unknown URL (`/this-route-does-not-exist`) | **PASS** — redirects to Dashboard |
| Blank pages | **PASS** — none |

No backend is required; there is no API surface to test. The demo never contacts a network host
(verified in §8).

---

## 3. Phase 3 — Dashboard

All nine KPIs were scraped from the rendered KPI cards and compared with values recomputed from the
journal. **All nine reconcile exactly.**

| KPI | UI value | Ledger value | Result |
|---|---|---|---|
| Total Cash | 5,804,400 | 5,804,400 | PASS |
| Total Bank | 11,095,050 | 11,095,050 | PASS |
| Total Sales | 23,896,700 | 23,896,700 | PASS |
| Total Purchases | 16,314,350 | 16,314,350 | PASS |
| Total Expenses | 4,493,050 | 4,493,050 | PASS |
| Net Profit | 2,850,100 | 2,850,100 | PASS |
| Accounts Receivable | 5,823,350 | 5,823,350 | PASS |
| Accounts Payable | 6,428,400 | 6,428,400 | PASS |
| Inventory Value | 2,760,150 | 2,760,150 | PASS |

| Additional dashboard checks | Result |
|---|---|
| Period filter **Today** (sales 658,500) | **PASS** — sales/purchases/expenses/profit all match the ledger |
| Period filter **This Week** | **PASS** |
| Period filter **This Month** | **PASS** |
| Period filter **Last Month** | **PASS** |
| Period filter **This Year** | **PASS** |
| Recent-transactions list starts at the newest voucher | **PASS** (matches ledger ordering) |
| Top-customers ranking matches ledger invoice totals | **PASS** |
| Accounts Receivable KPI = Σ customer balances | **PASS** |
| Accounts Payable KPI = Σ supplier balances | **PASS** |
| Four charts render as inline SVG | **PASS** — 4/4 |
| Chart hover tooltips show the underlying values | **PASS** — e.g. `Sep 26 · Revenue Rs. 56.42 L · Expenses Rs. 50.28 L` |
| Dashboard updates after an approval | **PASS** — approving a PKR 25,000 payment moved cash 5,804,400 → 5,779,400 and every dependent figure re-derived |

*Method note:* two dashboard checks failed in the first automated pass and were traced to the harness
(charts were below the fold, so the synthetic mouse never reached them; the expense form's cash account
is named “Cash in Hand”, not “Main Cash Account”). Both were re-executed correctly and pass — they are
**not** application defects and are not counted against the app.

---

## 4. Phase 4 — Accounting module

### 4.1 Parties
| Check | Result |
|---|---|
| All 8 seeded parties listed | **PASS** |
| Customers tab → 4 customers | **PASS** |
| Suppliers tab → 4 suppliers | **PASS** |
| Search narrows the list and every hit genuinely contains the term | **PASS** — “Ahmed” returns 2 rows (Ahmed Enterprises + a contact person “Bilal Ahmed”), both legitimate |
| Party profile shows the ledger closing balance | **PASS** — Ahmed Enterprises PKR 1,642,100 |
| Party profile renders the ledger and links to it | **PASS** |

### 4.2 All eight transaction types — created through the UI, then verified in the journal

| # | Voucher | UI journal preview balanced | Posted | Account movement observed | Result |
|---|---|---|---|---|---|
| 1 | Money Received | yes | yes | bank +10,000 / AR −10,000 | **PASS** |
| 2 | Money Paid | yes | yes | bank −10,000 / AP −10,000 (AP credit-normal) | **PASS** |
| 3 | Sales Invoice | yes | yes | AR +10,000 / revenue +10,000 / inventory −7,000 (COGS 70%) | **PASS** |
| 4 | Purchase Invoice | yes | yes | inventory +10,000 / AP +10,000 | **PASS** |
| 5 | Expense | yes | yes | cash −10,000 / Transport Expense +10,000 | **PASS** |
| 6 | Cash Deposit | yes | yes | cash −10,000 / bank +10,000 | **PASS** |
| 7 | Cash Withdrawal | yes | yes | cash +10,000 / bank −10,000 | **PASS** |
| 8 | Bank Transfer (HBL → Meezan) | yes | yes | HBL −10,000 / Meezan +10,000 | **PASS** |

**Total funds never inflate:** after deposit, withdrawal **and** inter-account transfer the
`cash + bank` total moved by **exactly 0**. Double-entry integrity (debits = credits, trial balance,
balance-sheet equation) held after *every* one of the eight postings.

### 4.3 Form validation
| Check | Result |
|---|---|
| Post blocked with no amount and no party | **PASS** |
| Post blocked for a zero amount | **PASS** |
| Post enabled once the form is valid | **PASS** |
| Cancel closes the form and posts nothing (entry count unchanged) | **PASS** |
| Required-field, amount and party validation messages | **PASS** |

### 4.4 Reports (all verified against source transactions, not appearance)
| Report | Check | Result |
|---|---|---|
| Profit & Loss | Revenue 23,896,700 · Net profit 2,850,100 = ledger | **PASS** |
| Trial Balance | DR = CR = 108,539,000, equal to the journal totals | **PASS** |
| Balance Sheet | Assets 28,082,950 = Liabilities 7,928,400 + Equity 20,154,550 | **PASS** |
| Cash Flow | Opening 14,299,050 + movement = closing 16,899,450, reconciles | **PASS** |
| Party Ledger | Renders entries consistent with party balances | **PASS** |
| Account Ledger | Renders entries consistent with account balances | **PASS** |
| Print / PDF | Invokes the browser print dialog | **PASS** |
| Export CSV | Produces `account-ledger-2026-07-01-to-2026-11-06.csv` | **PASS** |

### 4.5 Double-entry verification (independent of UI appearance)
| Check | Result |
|---|---|
| Every posted entry has equal debit and credit | **PASS** — 0 unbalanced entries across 412 baseline entries |
| Trial balance balances | **PASS** — difference 0 |
| A = L + E in the demo data | **PASS** — difference 0 |
| No negative cash/bank balance anywhere in the period | **PASS** — min cash 850,000; min HBL 2,396,450; min Meezan 300,300 |
| AR/AP control accounts equal the sum of party balances | **PASS** |
| Opening balances carry into the ledger | **PASS** |

---

## 5. Defects found

**P0 (cannot start / dangerously wrong financial data): none found.**
**P1 (core workflow fails / wrong calculations): none found.**

### QA-01 · P2 · Approval double-click can open — and then post — a *different* payment
**Where:** `/approvals` review modal, `src/pages/Approvals.tsx`
**Reproduction (executed):** open a pending approval (APR-2026-0144) → double-click **Approve & post**.
**Observed:** exactly one voucher is posted (entry count 412 → 413, status → `completed`) — the duplicate
guard works. But the modal closes on the first click, so the **second click of the double-click lands on
the approvals table underneath and opens the next pending item (APR-2026-0143)**. An operator who then
clicks Approve once more posts a *second, unintended* payment: entries 413 → 414, APR-2026-0143 → `completed`.
**Impact:** the same item can never be double-posted (verified), but a fast double-click can silently arm
a second, different financial posting. In a demo this is contained; in principle it is the kind of
mis-click that produces a wrong payment.
**Proposed fix (demo-scoped):** suppress row-open clicks for a short window after a review modal closes,
plus an in-flight guard on the approve handler. No accounting logic touched.

### QA-02 · P3 · AI inline approval toast omits the posted voucher reference
**Where:** `/ai` action-preview card, `src/pages/AiCommandCenter.tsx`
**Observed:** toast reads *“Approved & posted to demo ledger — APR-2026-0145 posted. ABC Traders balance
moves to PKR 1,737,700.”* The generated **transaction** reference (e.g. `PV-2026-0xx`) is missing, while
the Approvals page correctly says *“Approved · posted as PV-…”.* Figures and balance are correct.
**Fix:** include the returned entry's reference in the toast (the store already returns the posted entry).

### QA-03 · P3 · A negative amount is silently converted into a positive payment draft
**Where:** `parseAmount` in `src/ai/engine.ts`
**Observed:** “Prepare a payment of Rs. -5000 to ABC Traders.” produces a **PKR 5,000** draft (approvals
6 → 7). Nothing is posted without approval, and the amount is visible on the card, but the sign is dropped
rather than queried.
**Fix:** treat a minus sign in front of the figure as invalid and ask for confirmation instead.

### QA-04 · P3 · Compound question “Show monthly revenue and expenses” answers only expenses
**Where:** intent routing in `src/ai/engine.ts`
**Observed:** the expenses rule matches the word “expenses” before the monthly-trend rule, so the answer is
*“Total operating expenses for This Month are PKR 245,500…”* — correct figures, but the “monthly” and
“revenue” halves of the request are ignored (intent tag shows `finance.expenses`, not the trend report).
**Fix:** exclude trend wording from the expenses rule so the request reaches the existing monthly-trend
answer. Figures and existing 53 AI assertions must stay unchanged.

### QA-05 · P3 · Duplicate / oversized document uploads are accepted silently
**Where:** `src/pages/Documents.tsx`
**Observed:** re-uploading the same file creates a second library entry (3 → 9 after 6 uploads, no dedupe
notice); a 6 MB file is accepted with no size limit or warning; a zero-byte PNG is accepted.
Unsupported `.txt` is correctly rejected. No crash in any case. Demo-acceptable, but worth a one-line
notice so a live demo does not accumulate confusing duplicates.
**Fix:** warn (toast) when the same file name already exists, and state the demo size limit. No upload
pipeline change.

---

## 6. Phase 5 — AI Secretary (simulated, and labelled as such)

Every response is generated **locally by rule-based logic** (`src/ai/engine.ts`); there is **no OpenAI API
call, no key, and no network request** (verified in §8). The UI labels responses as a simulated assistant.

| Required command | Intent (UI tag) | Figures match ledger | Result |
|---|---|---|---|
| “Aaj ki total sales kitni hain?” | finance.sales | yes (658,500 today) | **PASS** |
| “Aaj ke total expenses batao.” | finance.expenses | yes | **PASS** |
| “Ahmed ka ledger dikhao.” | party.ledger | yes (18 figures, 0 invented) | **PASS** |
| “Is month ka profit calculate karo.” | finance.profit | yes | **PASS** |
| “Business ka current cash balance batao.” | finance.cash | yes (5,804,400) | **PASS** |
| “Ali Traders ko kitni payment deni hai?” | party.payable | yes | **PASS** |
| “Show me the last 10 transactions.” | accounting.transactions | yes (10 rows) | **PASS** |
| “Prepare a payment of Rs. 25,000 to ABC Traders.” | action.payment.draft | yes — **draft only** | **PASS** |
| “Show monthly revenue and expenses.” | finance.expenses ✗ | figures correct, intent incomplete | **FAIL → QA-04** |

| Edge case | Result |
|---|---|
| Empty message | **PASS** — send disabled, no message added |
| Whitespace-only message | **PASS** — blocked |
| Unknown command (“weather in Karachi”) | **PASS** — capability guidance, no invented figures |
| Missing party | **PASS** — asks which party |
| Missing amount | **PASS** — shows outstanding balance and asks for an amount |
| Zero amount | **PASS** — asks again, no draft |
| Negative amount | **FAIL → QA-03** |
| Unknown / unavailable party (“Crescent Textiles”) | **PASS** — no draft, no fabricated ledger |
| Repeated command | **PASS** — identical deterministic answer |
| Script injection in the message | **PASS** — rendered as text, no dialog, no execution |
| Questions never post | **PASS** — entry count 412 → 412 across all questions |
| Financial command creates a draft, not a posting | **PASS** |
| Suggested-prompt chips run real commands | **PASS** |
| Conversation history | **PASS** |

**No fabricated figures:** for all nine commands, every `PKR` number rendered in the bubble exists in the
engine's own answer for that command — zero invented values.

---

## 7. Phase 6 — Document upload (extraction is simulated)

| Check | Result |
|---|---|
| Library lists the 3 bundled samples | **PASS** |
| PNG accepted with feedback | **PASS** |
| JPG accepted | **PASS** |
| PDF accepted | **PASS** |
| Unsupported `.TXT` rejected with an error toast | **PASS** |
| Zero-byte file — no crash | **PASS** |
| 6 MB file — no crash | **PASS** (no size limit — QA-05) |
| Duplicate upload — no crash | **PASS** (duplicate entry created — QA-05) |
| Uploads appear in the library | **PASS** — 3 → 9 |
| **No invented extraction values for user uploads** | **PASS** — amount `""`, party `""`, "No OCR result — enter values manually" |
| Draft blocked until an amount is entered | **PASS** — “Amount required” |
| Manual correction → prepare draft | **PASS** — routes to Approvals |
| Draft is **not** auto-posted | **PASS** — 412 → 412 entries |
| Draft waits in the approval queue | **PASS** |
| Bundled sample shows a simulated extraction | **PASS** — “Simulated extraction from the bundled sample · Confidence 94%” |
| Simulated nature is labelled | **PASS** — “SIMULATED EXTRACTION — NOT PRODUCED BY A REAL OCR ENGINE” |

*One check in the first automated pass (“sample shows a confidence score”) failed because the script
clicked the most recent **upload** instead of the bundled sample. Re-executed by selecting
`HBL-Deposit-Slip-4417.pdf`: the panel shows Confidence 94%, the party and the PKR 185,000 amount, with the
simulated-extraction warning. Harness artifact — not an application defect.*

---

## 8. Phases 7, 8, 9, 10

### Approvals (Phase 7)
| Check | Result |
|---|---|
| Queue shows the 5 seeded approvals | **PASS** |
| Draft → pending → approved → completed | **PASS** (status, `approvedBy`, `postedEntryId` all set) |
| Reference generated on posting | **PASS** — `APR-2026-0145` → `PV-2026-…` |
| Balances update only after approval | **PASS** — draft left the ledger at 412 entries |
| Approved payment moves cash by exactly the approved amount | **PASS** — 5,804,400 → 5,779,400 |
| Rejected draft has no ledger impact | **PASS** — 414 → 414 entries, liquid funds unchanged |
| Rejection reason captured, item marked Rejected | **PASS** |
| Edit draft changes the amount and returns it to Pending | **PASS** (12,345 saved) |
| Duplicate approval of the *same* item | **PASS** — store guard rejects non-pending items |
| Double-click on Approve | **FAIL → QA-01** |
| Completed item offers no further approval | **PASS** (once the stray click-through is excluded) |

### Responsive / UI (Phase 8)
| Viewport | Horizontal overflow | Layout |
|---|---|---|
| 1920 × 1080 | none | sidebar persistent, 4-column KPI grid |
| 1366 × 768 | none | sidebar persistent, tables readable |
| 768 × 1024 | none | drawer opens/closes correctly |
| 390 × 844 | none | drawer opens/closes, cards stack, no clipping |

Empty state (search with no matches) **PASS** · Toast/feedback **PASS** · Modals, dropdowns, filters,
segmented tabs, pagination all exercised without error **PASS** · No missing icons or overlapping text
observed in the 4-viewport screenshot set (`qa-shots/responsive-*`).

### Security & demo-data safety (Phase 9 — non-destructive)
| Check | Result |
|---|---|
| Zero external network requests in a full session | **PASS** |
| No credentials / connection strings / API keys in DOM or built bundle | **PASS** |
| `localStorage` holds only `absa.demo.state.v1` | **PASS** |
| DEMO MODE indicator visible | **PASS** |
| Fictional dataset only (ABC Trading Company, example contacts) | **PASS** |
| AI cannot post without human approval | **PASS** — 412 → 412 |
| No bank / email / production integration is contacted | **PASS** |
| Deleting demo state restores the seed | **PASS** |

*This is not a security certification. It confirms the demo is isolated and mock-only; it says nothing
about production authentication, authorization or data protection.*

### Automated execution (Phase 10)
| Suite | Result |
|---|---|
| `npm run typecheck` | **PASS** — 0 errors |
| `npm run verify` (19 accounting + 53 AI/builder assertions) | **PASS** — 72/72 |
| `npm run smoke` (SSR render of all 13 routes) | **PASS** — Dashboard sales == P&L revenue |
| `npm run build` | **PASS** — 411.15 kB JS / 114.23 kB gzip |
| `npm run qa:browser` (routes + interactions) | **PASS** — 13/13, 0 console errors |
| `npm run qa:flows` (end-to-end) | **PASS** — 16/16 |
| Lint | **not configured** (no ESLint in the project — not added, per “no unnecessary packages”) |
| New QA audit (`scripts/qa/*.mjs`) | **157 checks · 152 PASS · 5 FAIL** → 4 real defects (1 P2, 3 P3) + 1 harness artifact |

---

## 9. Simulated vs genuinely implemented

| Genuinely implemented | Simulated / not implemented |
|---|---|
| Double-entry journal, trial balance, P&L, balance sheet, cash flow, ledgers, party control accounts | AI “understanding” — deterministic rule-based intent matching, no LLM |
| Transaction form with live journal preview and validation for all 8 voucher types | Document OCR / vision extraction — bundled samples only; uploads yield no fields |
| Approval queue with status machine and posting guard | Bank feeds, payments, emails, SMS — none |
| Dashboard aggregation from one dataset, 5 period presets | Multi-user auth / roles — single demo user |
| CSV export, print/PDF via browser | Server, database, persistence beyond `localStorage` |
| Responsive layout 390 → 1920 px | Real integrations of any kind |

---

## 10. Verdict at the point of this report

The demo is **functionally sound**: it starts cleanly, every route renders, all nine KPIs and all six
reports reconcile to the journal, the eight voucher types post balanced entries, internal transfers do not
create money, and the approval pipeline prevents unapproved postings.

**No P0 or P1 defect was found.** Four defects are open — one P2 (approval double-click click-through) and
three P3 (toast content, negative-amount parsing, compound-question intent, upload notices). Per the fix
policy, the P2 and the three P3 items are small, demo-scoped and safe; they are addressed in
`DEMO_BUG_FIX_REPORT.md`, followed by the full regression in `DEMO_FINAL_QA_REPORT.md`.
