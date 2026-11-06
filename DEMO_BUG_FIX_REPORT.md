# DEMO QA — BUG FIX REPORT

**Project:** AI Business Secretary — Demo (ABC Trading Company)
**Date:** 2026-11-06
**Basis:** `DEMO_QA_INITIAL_REPORT.md` (written before any change was made)
**Rule applied:** demo-scoped, smallest possible fix. No accounting logic altered, no feature added, no
security control removed, no test rewritten to pass.

---

## Summary

| ID | Severity | Area | Status |
|---|---|---|---|
| QA-01 | P2 | Approvals — double-click click-through could open (and then post) a different payment | **FIXED** |
| QA-02 | P3 | AI inline approval toast omitted the posted voucher reference | **FIXED** |
| QA-03 | P3 | Negative amount silently converted into a positive payment draft | **FIXED** |
| QA-04 | P3 | “Show monthly revenue and expenses” answered only expenses | **FIXED** |
| QA-05 | P3 | Duplicate / empty / oversized uploads accepted without feedback | **FIXED** |

No P0 or P1 defect was found, so nothing posed a risk to financial correctness.

---

## QA-01 · Approvals double-click click-through (P2)

**Symptom (reproduced before the fix):** on `/approvals`, double-clicking **Approve & post** posted the
reviewed voucher (412 → 413 entries, correct), but the modal closes on the first click, so the second click
landed on the approvals table underneath and opened the **next pending item** (APR-2026-0143). One more
click posted that unrelated payment (413 → 414).

**Root cause:** the table row and the per-row *Review* button both call `setOpenId(...)` directly. Nothing
prevented a click that belonged to the closing modal from being re-interpreted as a row click.

**Fix — `src/pages/Approvals.tsx` (only file touched):**
1. `close()` records `closedAtRef.current = Date.now()`.
2. New single entry point `openReview(id)` ignores any open request within **400 ms** of a close, and both
   the row `onClick` and the *Review* button now call it.
3. `handleApprove` takes an `approvingRef` in-flight lock (500 ms) so a repeated approve cannot re-enter.

**Files:** `src/pages/Approvals.tsx`
**Regression evidence (re-executed after the fix):**

```
AFTER FIX -> entries: 412 -> 413 | modal open: 0 | approve btn: 0 | reviewed: APR-2026-0144
statuses: APR-2026-0144:completed, APR-2026-0143:pending, APR-2026-0142:draft,
          APR-2026-0141:completed, APR-2026-0140:rejected
```
Exactly one voucher posted; no modal reopened; the neighbouring approval stayed `pending`.
Automated check `approval:no-double-approve` and `approval:idempotent-double-click` now **PASS**.

---

## QA-02 · AI approval toast missing the voucher reference (P3)

**Symptom:** `/ai` showed *“Approved & posted to demo ledger — APR-2026-0145 posted. ABC Traders balance
moves to PKR 1,737,700.”* — correct figures, but no transaction reference, unlike `/approvals`
(*“Approved · posted as PV-2026-0xx”*).

**Root cause:** the handler called `approve(approval.id)` and discarded the returned `JournalEntry`.

**Fix — `src/pages/AiCommandCenter.tsx`:** capture the returned entry, guard the `null` case with an error
toast, put the reference in the toast title and in the activity log.

**After:** `Approved · posted as PV-2026-043 — APR-2026-0145 approved. ABC Traders balance moves to
PKR 1,737,700.`

---

## QA-03 · Negative amount became a positive draft (P3)

**Symptom:** “Prepare a payment of Rs. **-5000** to ABC Traders.” created a **PKR 5,000** draft.

**Root cause:** `parseAmount` in `src/ai/engine.ts` matched the digit run and ignored the leading sign.

**Fix — `src/ai/engine.ts`:** before the numeric match, `if (/(^|[\s(=])-\s*\d/.test(t)) return undefined;`
— a negative figure is now treated as “amount not understood”, so the assistant asks for the amount instead
of silently flipping the sign. Intent becomes `action.payment.missing_amount`, **no draft is created**.

**Verification:** `"Prepare a payment of Rs. -5000 to ABC Traders."` → `action.payment.missing_amount`
(no draft) · `"Prepare a payment of Rs. 25000 to ABC Traders."` → `action.payment.draft` 25,000 (unchanged).

---

## QA-04 · Compound “monthly … revenue and expenses” question misrouted (P3)

**Symptom:** “Show monthly revenue and expenses.” produced the single-period expenses total
(*“Total operating expenses for This Month are PKR 245,500…”*), ignoring “monthly” and “revenue”.

**Root cause:** in `src/ai/engine.ts` the expenses rule matched the word *expenses* before the
monthly-trend rule was reached; the sales rule (`revenue`) had the same exposure.

**Fix — `src/ai/engine.ts`:** one shared constant
`TREND_HINT = /\b(monthly|month wise|month-wise|trend|revenue and expenses|comparison)\b/`
and both the sales and expenses rules now skip when `TREND_HINT` matches, letting the existing
monthly-trend answer handle the request. No figures, wording or tables were changed.

**Verification (intent routing):**

| Command | Before | After |
|---|---|---|
| “Show monthly revenue and expenses.” | `finance.expenses` | **`finance.monthly_trend`** |
| “Show monthly expenses trend” | `finance.expenses` | `finance.monthly_trend` |
| “Aaj ke total expenses batao.” | `finance.expenses` | `finance.expenses` (unchanged) |
| “Aaj ki total sales kitni hain?” | `finance.sales` | `finance.sales` (unchanged) |
| “What were my sales this month?” | `finance.sales` | `finance.sales` (unchanged) |
| “Is month ka profit calculate karo.” | `finance.profit` | `finance.profit` (unchanged) |

All 53 existing AI/builder assertions still pass.

---

## QA-05 · Upload feedback for duplicate / empty / oversized files (P3)

**Symptom:** re-uploading the same file silently added a second library entry; a 0-byte PNG was accepted;
a 6 MB file was accepted with no limit stated.

**Fix — `src/pages/Documents.tsx` (upload handler only):**
- 0-byte file → error toast *“Empty file — that file is 0 bytes”*, nothing added.
- > 10 MB → error toast stating the demo limit and the actual size, nothing added.
- Same file name already in the library → document is still added (demo behaviour kept) but the toast
  becomes *“Document added · duplicate name”* and says a copy already exists.
- OCR not connected is still stated in every case; no extraction is invented.

**Verification:** `.txt` → “Unsupported file type” · 0-byte PNG → “Empty file” · 6 MB PNG → “File too large”
· duplicate PNG → “Document added · duplicate name” · valid PNG/JPG/PDF → “Document added”.

---

## Scope discipline

- **Files changed:** 4 — `src/pages/Approvals.tsx`, `src/pages/AiCommandCenter.tsx`, `src/ai/engine.ts`,
  `src/pages/Documents.tsx`.
- **Not touched:** `src/demo/accounting.ts`, `src/demo/seed.ts`, `src/demo/store.tsx`,
  transaction builder, reports, styles, seed data, build config.
- **No** new dependency, **no** new feature, **no** change to any accounting computation or balance.
- **QA tooling added** (test-only): `scripts/figures-entry.ts`, `scripts/qa/*.mjs`, and npm scripts
  `qa:figures`, `qa:audit`, `qa:regression`. Existing suites were not modified.

## Post-fix verification (all executed after the changes)

| Suite | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run verify` (19 accounting + 53 AI) | 72 / 72 PASS |
| `npm run smoke` | PASS — Dashboard sales == P&L revenue |
| `npm run build` | PASS — 412.10 kB JS / 114.59 kB gzip |
| `npm run qa:browser` | 13 / 13 routes, 0 console errors |
| `npm run qa:flows` | 16 / 16 PASS |
| `scripts/qa/audit-ui.mjs` | 28 / 28 PASS |
| `scripts/qa/audit-financial.mjs` | 81 / 81 PASS |
| `scripts/qa/audit-ai-docs.mjs` | 50 / 50 PASS |
| `scripts/qa/regression-15.mjs` | 16 / 16 PASS |

Financial invariants after the fixes are unchanged: trial balance DR = CR = **108,539,000**, trial-balance
difference **0**, **Assets 28,082,950 = Liabilities 7,928,400 + Equity 20,154,550**, no negative cash or bank
balance, AR/AP control accounts equal the sum of party balances.
