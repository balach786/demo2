# CLIENT DEMO GUIDE
### AI Business Secretary & Accountant — live presentation playbook

**Duration:** 12–15 minutes · **Presenter:** business owner / consultant · **Audience:** client decision makers
**Demo business:** ABC Trading Company (fictional) · **Currency:** PKR · **Demo clock:** 06 Nov 2026

---

## 1. Before the meeting (5-minute checklist)

- [ ] `cd ai-business-secretary && npm install && npm run dev` → open **http://localhost:5173**
  (or open the hosted preview link).
- [ ] Press the **⟳ reset** icon in the top-right so the demo starts from the seeded dataset.
- [ ] Resize the browser to full screen (the layout is responsive down to phone width, but show it on desktop).
- [ ] Close other tabs; keep DevTools closed (the console is clean, but avoid visual noise).
- [ ] Optional: have `qa-shots/` open in a second window as a fallback if the projector/browser misbehaves.

**Opening line you can use:**
> "This is a working demonstration of the AI Business Secretary & Accountant we're proposing. It's running on fictional
> data — every number you'll see is generated from a single accounting ledger, so nothing contradicts anything else. Let
> me show you a day in the life of your business on this system."

---

## 2. The story arc (what you are proving)

| # | Scene | What the client should feel |
|---|---|---|
| 1 | Dashboard | "This tells me how my business is doing in 5 seconds." |
| 2 | Ask the AI, in plain Urdu/English | "It speaks my language and knows my numbers." |
| 3 | AI prepares an action, I approve it | "It doesn't act behind my back — I stay in control." |
| 4 | Ledger + reports reconcile | "This is real accounting, not a chat toy." |
| 5 | Upload a receipt → draft → approve | "My paperwork enters itself." |
| 6 | Numbers move everywhere at once | "Everything is one system." |
| 7 | Feature matrix in Settings | "I know exactly what I'm buying today vs. next phase." |

---

## 3. Scene-by-scene script

### Scene 1 — Executive Dashboard (2 min)
**Open:** `/` (Dashboard)

- Point at the amber **DEMO MODE** pill: *"Everything here is fictional demo data, isolated from any live systems."*
- Point at the strip under the title: **Books balanced · 412 journal entries · PKR 108,539,000 debit = credit**.
  *"This is the health check of the ledger that powers every screen."*
- Walk the KPI row: Cash, Bank, Sales, Net Profit, Purchases, Expenses, Receivable, Payable, Inventory.
  *"These are live calculations, not pictures."*
- Hover the charts to show tooltips. Then change the period: click **This Year** in the topbar → choose **This Month**
  → *"Every KPI and chart recomputes from the same period filter."* Switch back to **This Year**.

**Proof point to say out loud:** "The Sales figure here and the Sales figure in the Profit & Loss report come from the
same journal lines — that's why they can never disagree."

### Scene 2 — AI Command Center (3 min)
**Open:** `/ai`

Click the suggested prompt **“Aaj ki total sales kitni hain?”**

- The answer shows total sales, invoice count, gross profit and receivables as cards. Note the label
  *"Simulated response · rule-based engine · no AI API call"*.
  *"In this demo the assistant is a deterministic engine over the demo ledger. In the delivered product the same
  interface is backed by the AI model you approve, so behaviour and safety stay identical."*

Type: **`Ahmed ka ledger dikhao.`**

- It returns the party ledger table with running balance. Click **Open full ledger** to show the party profile, then
  come back.

Click **“Ali Traders ko kitni payment deni hai?”**

- It shows the outstanding payable for Ali Suppliers (PKR 3,077,850 on 20-day terms).
  *"'Ali Traders' isn't even the exact stored name — the assistant resolves it to Ali Suppliers."*

### Scene 3 — The AI proposes, you approve (2 min)
**Still on `/ai`**, type: **`Prepare a payment of Rs. 25,000 to ABC Traders.`**

- Note the wording: *"I have prepared a payment draft… Nothing has been posted — it will only hit the ledger after your
  approval."*
- Scroll to the **Action preview** card: reference ID, transaction type, party, amount, account, debit = credit.
- Click **Approve**.

  Watch for: the success toast with the new voucher reference, and the party balance updating.
- Point out: *"Nothing left this building. No bank transfer, no email. In production this would trigger your bank file or
  API with the same approval gate."*

**Alternative path to show (optional):** click **Reject** on another pending item and give a reason — *"the ledger is
untouched, and the reason is recorded."*

### Scene 4 — Accounting that reconciles (2.5 min)
**Open:** `/transactions`

- Search `APR` or the reference you just approved — *"my approved action is now a proper accounting voucher."*
- Click the row → voucher detail: double-entry lines, totals equal, posted status.
- Click **New transaction** → choose **Money Received**, enter `18500`, pick *Ahmed Enterprises*, description
  *"Receipt against INV-2026-021"* → show the **journal preview** building debits and credits live, and the badge
  **Debits = Credits** → **Post transaction**. Toast + new row.

**Open:** `/reports`

- **Trial Balance** → highlight *"Total debits = total credits, difference PKR 0"*.
- **Balance Sheet** → highlight *"Assets = Liabilities + Equity — difference PKR 0"*.
- **Cash Flow** → highlight *"Opening + net movement = closing balance"*.
- *"These three checks run live, every time you open the report. If something didn't reconcile, the app would say so."*
- Hit **Print / PDF** briefly to show the print-friendly layout, then Escape.

### Scene 5 — Paperwork that enters itself (2 min)
**Open:** `/documents`

- Click **HBL-Deposit-Slip-4417.pdf** in the library. Show the rendered slip and the extraction panel.
- *"The extraction here is simulated and labelled as such — we never pretend a demo read your file."*
- Optionally change the amount, then click **Prepare transaction draft** → it routes to **Approvals** with the draft
  pending, flagged with any uncertain fields.
- Approve it → return to `/` → the cash/bank and receivable KPIs have moved.

**Optional honesty moment (recommended):** upload any PDF/photo from your desktop. Show that the fields come up **blank**
and the app says OCR is not connected. *"This is the one place we deliberately refuse to guess — in Phase 2 it's wired to
the OCR service, and uncertain values still require your approval."*

### Scene 6 — One system, one truth (1 min)
**Open:** `/` again.

- Compare the KPIs to what you said in Scene 1. *"Every approval and every voucher you posted during this demo has
  flowed through to these numbers, to the ledgers, and to the AI's answers."*
- Open `/parties` → any party → show the ledger matching the AI's earlier answer.

### Scene 7 — What you're buying today vs next (1.5 min)
**Open:** `/settings`

- **Feature status matrix**: green = working in this demo, amber = simulated, grey = planned.
- **Integrations**: MongoDB Atlas, OpenAI, banking, OCR, email — all deliberately disconnected.
- **Safety scope** list: no production writes, no credentials, no real payments.
- Close with the commercial narrative: *"Phase 1 proves the workflow end-to-end on your data model. Phase 2 connects
  Atlas, the AI model and your bank/OCR providers behind the approval gates you just used."*

---

## 4. Questions you will get — and safe answers

| Question | Answer |
|---|---|
| "Is this really AI?" | "The interface is real; the reasoning in this demo is a deterministic engine so the presentation is reproducible. Production swaps in the LLM behind the same contract — the approval gate and data access are unchanged." |
| "Is my data safe?" | "This build has no database and no credentials; it can't touch your data. In production we keep the same approval-gated write path, add role-based access, and complete the security verification phase before go-live." |
| "Does it do sales tax / WHT?" | "Not in this demo — it's on the roadmap list in Settings. The chart of accounts and voucher engine are already structured to accept tax lines." |
| "Can the AI move money?" | "Never by itself. It can only create a draft. A human approves; only then does a voucher post — and bank execution stays outside the demo." |
| "Can multiple people use it?" | "The demo runs as a single user without login. Multi-user roles and audit logs are part of the production phase." |
| "What if the AI misunderstands?" | "Look at the flags: missing party and missing amount trigger a clarification question instead of a guess, and uncertain document fields are highlighted before approval." |
| "Show me a number I can verify." | Open `/reports` → Trial Balance → *"Debits equal credits to the rupee; the same journal produces the dashboard."* |

---

## 5. Commands that always work (keep this list handy)

**Roman Urdu**
1. `Aaj ki total sales kitni hain?`
2. `Ahmed ka ledger dikhao.`
3. `Is month ka profit calculate karo.`
4. `Business ka current cash balance batao.`
5. `Aaj ki expenses ki report banao.`
6. `Ali Traders ko kitni payment deni hai?`
7. `Top customers is saal ke kaun hain?`

**English**
8. `Show me the last 10 transactions.`
9. `Prepare a payment of Rs. 25,000 to ABC Traders.`
10. `Show monthly revenue and expenses.`
11. `What is the total receivable from customers?`
12. `Check whether the books are balanced.`

**Variations that also work:** `Rs. 15 hazar`, `2 lakh`, `Record receipt of Rs. 40,000 from Ahmed Enterprises`,
`ABC Traders ko 5000 payment karo`.

---

## 6. Recovery plan if something goes wrong

| Situation | Fix (under 5 seconds) |
|---|---|
| Numbers feel "off" after experimenting | Topbar **⟳** → **Reset demo data** |
| Someone uploaded a file and left fields blank | Ignore it — the blank state is the honest behaviour; go back to a bundled sample |
| A draft was rejected by mistake | Nothing posted; make the AI prepare it again — a new reference is issued |
| Browser window/projector fails | Switch to `qa-shots/` screenshots, or restart the server and reset |
| Page feels stale after a code edit | Refresh (HMR is intentionally disabled for presentation stability) |

---

## 7. Three sentences to close on

1. *"One ledger powers the dashboard, the ledgers, the reports and the assistant — so your business always has a single
   version of the truth."*
2. *"The assistant can prepare work, but nothing moves without your approval."*
3. *"This demo is deliberately honest: what works, what's simulated and what's planned are all labelled in the product."*
