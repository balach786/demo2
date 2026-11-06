# AI Business Secretary & Accountant — Client Demonstration

> **Your Intelligent Business Management Assistant** · interactive demo build · **DEMO MODE** · fictional data only

A premium, fully interactive demonstration of an AI business secretary + accounting platform:

- **Executive dashboard** — 9 KPIs and 4 charts, all derived from one ledger.
- **Accounting** — parties, chart of accounts, 8 voucher types, ledgers, bank accounts, six financial reports.
- **AI Secretary** — natural-language commands in **English and Roman Urdu** that answer from the ledger and prepare
  approval-gated transaction drafts.
- **Document intelligence** — upload a slip/invoice, review extracted fields, create a draft (extraction is clearly
  labelled as simulated).
- **Approvals** — draft → pending → approved → completed / rejected, with posting into the isolated demo ledger.

> **Honesty note:** this build runs entirely in the browser. There is **no database, no OpenAI call, no bank connection
> and no real payment**. The AI is a deterministic rule-based engine and document extraction for your own uploads is
> manual. Simulated features are labelled inside the product.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview    # http://localhost:5173
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (0.0.0.0, HMR disabled for presentation stability) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | TypeScript, no emit |
| `npm run verify` | 72 accounting + AI/builder assertions |
| `npm run smoke` | Server-render smoke test of all 13 routes |
| `npm run qa:browser` | Real-browser QA + screenshots into `qa-shots/` (requires Chromium; set `CHROME_PATH`) |
| `npm run qa:flows` | End-to-end workflows: document → draft → approve/post, reject, edit, reset |

## Demo walkthrough (12 minutes)

1. **Dashboard** (`/`) — DEMO MODE badge, balanced-books strip, period filter, charts.
2. **AI Command Center** (`/ai`) — try `Aaj ki total sales kitni hain?`, `Ahmed ka ledger dikhao.`, then
   `Prepare a payment of Rs. 25,000 to ABC Traders.` → **Approve** the inline draft.
3. **Transactions** (`/transactions`) — the approved voucher is now in the ledger; open it to read the double-entry lines;
   post a new voucher with the live journal preview.
4. **Reports** (`/reports`) — trial balance agrees, balance sheet balances, cash flow reconciles.
5. **Documents** (`/documents`) — open a bundled sample, prepare a draft, approve it in **Approvals**.
6. **Settings** (`/settings`) — feature status matrix and integration status (all disconnected).

Full script, Q&A and recovery plan: **[CLIENT_DEMO_GUIDE.md](./CLIENT_DEMO_GUIDE.md)**

## Documentation

| File | Contents |
|---|---|
| `PROJECT_DEMO_AUDIT.md` | Inspection report: what was found before building (and what was not), strategy, safety compliance |
| `DEMO_IMPLEMENTATION_REPORT.md` | What was built/reused/changed, what works vs is simulated vs planned, test evidence, limitations |
| `CLIENT_DEMO_GUIDE.md` | Scene-by-scene presentation playbook, commands, Q&A, recovery |
| `qa-shots/` | Screenshots from the browser QA run |

## Architecture (short version)

```
src/demo/seed.ts        → 412 journal entries (deterministic, fixed demo clock 06 Nov 2026)
src/demo/accounting.ts  → all balances, ledgers, P&L, cash flow, trial balance, balance sheet
src/demo/store.tsx      → isolated state + approvals workflow (localStorage: absa.demo.state.v1)
src/ai/engine.ts        → deterministic NLU (intents, party/amount/period extraction)
src/components/         → design system, SVG charts, UI kit, transaction form
src/pages/              → 13 screens
```

**Rule of the codebase:** no screen owns a financial total. Every figure is derived from `JournalEntry.lines`, so the
dashboard, ledgers, reports and AI answers always reconcile.

### Demo data snapshot (FY 2026–27 to date)

| Metric | PKR |
|---|---|
| Sales | 23,896,700 |
| Purchases | 16,314,350 |
| Cost of goods sold | 16,727,650 |
| Operating expenses | 4,493,050 |
| Net profit | 2,850,100 |
| Cash in hand / bank | 5,804,400 / 11,095,050 |
| Receivable / payable | 5,823,350 / 6,428,400 |
| Inventory | 2,760,150 |

## Reset the demo

Topbar **⟳** or **Settings → Reset demo data**. State is stored only in this browser
(`localStorage["absa.demo.state.v1"]`) and can also be exported as JSON.

## Quality assurance (QA pass, 2026-11-06)

A full test-and-audit pass was executed against the running app in Chromium. Start with the reports:

| Report | What it covers |
|---|---|
| `DEMO_QA_INITIAL_REPORT.md` | Pre-fix findings, P0–P3 classification, evidence for every phase |
| `DEMO_BUG_FIX_REPORT.md` | Each defect: symptom, root cause, smallest fix, files touched, verification |
| `DEMO_STORAGE_TEST_REPORT.md` | Persistence: what survives a refresh, reset isolation, damaged-data recovery |
| `DEMO_FINAL_QA_REPORT.md` | Full regression: figures, approvals, AI, uploads, responsive, security, build |

Client-facing: **`CLIENT_DEMO_WALKTHROUGH.md`** (guided tour) and **`CLIENT_DEMO_GUIDE.md`** (presenter playbook).

Re-runnable QA tooling (does not modify the app; compares the UI against the app's own ledger):

```bash
npm run dev                # app must be running on :5173
npm run qa:figures         # build the verification oracle (.qa/)
npm run qa:audit           # startup + routing + responsive + financial + AI + uploads + security (159 checks)
npm run qa:storage         # persistence, refresh survival, reset isolation, corrupt-data recovery (25 checks)
npm run qa:regression      # 15-step critical workflow (16 checks)
```

Totals after the pass: **200 browser audit checks passing**, 0 console errors, 6 defects found
(1 × P2, 5 × P3) and all 6 fixed. The demo remains a demo: no backend, no auth, no real AI or OCR, no bank
integration.
