# DEMO STORAGE TEST REPORT

**Project:** AI Business Secretary & Accountant — client demo (ABC Trading Company)
**Test date:** 2026-11-06
**Environment:** Chromium 1140 (Playwright 1.48.2, headless) against `npm run dev` on `localhost:5173`
**Suite:** `scripts/qa/audit-storage.mjs` — **25 checks, 25 PASS**
**Command:** `npm run dev` (in one shell) → `npm run qa:figures && node scripts/qa/audit-storage.mjs`

> Every result below was produced by driving the real application in a real browser. Nothing is
> inferred from reading the code alone. The demo has **no backend and no database** — persistence is
> deliberately browser-only, as required by the brief (§3 of the master prompt).

---

## 1. How persistence works (verified design, not assumed)

| Aspect | Implementation |
|---|---|
| Storage mechanism | `window.localStorage` only |
| Key | **`absa.demo.state.v1`** — one single key, nothing else |
| Payload shape | `{ "version": 1, "data": DemoDataset }` |
| Persisted content | `business`, `accounts`, `parties`, `entries`, `documents`, `approvals`, `activities`, plus `demoToday` / `fiscalYearStart` |
| Write path | An effect re-serialises the whole dataset on every state change (posting a voucher, approving, uploading, editing) |
| Read path | `loadInitial()` runs once at mount: builds the seed dataset, then adopts the saved payload only if it is valid |
| Validation before adopting saved data | JSON must parse · `version === 1` · `data.entries` must exist · `data.business.name` must be `ABC Trading Company` · otherwise the seed is used |
| Failure handling | Every access is wrapped in `try/catch`; if storage throws, the app keeps running in memory and the Settings page reports **“In memory only”** |
| Reset | `resetDemo()` rebuilds the seed in memory and removes `absa.demo.state.v1` — no other key is touched |
| Cloud sync | **None.** No server, no database, no API call (verified: 0 external requests in a full session) |

**Payload size measured:** ~**150 KB** for the seeded dataset (412 entries, 1,000 lines, 8 parties,
18 accounts, 3 documents, 5 approvals) — about 3 % of a typical 5 MB `localStorage` quota.

---

## 2. Test matrix and results

### 2.1 Writing and reading the store

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| S1 | First load | exactly one key written, named `absa.demo.state.v1` | `absa.demo.state.v1` only | **PASS** |
| S1b | Payload contents | `version: 1`, 412 entries, business = ABC Trading Company | v1, 412 entries, ABC Trading Company | **PASS** |
| S1c | Payload size | between 10 KB and 2 MB | 150 KB | **PASS** |
| S3 | Post a voucher (Money Paid, PKR 12,345) | state persisted immediately | 412 → 413 entries | **PASS** |
| S4 | Full page refresh | record still present | entries = 413, reference `PV-2026-043` found | **PASS** |
| S4b | Dashboard after refresh | figures match the persisted ledger | cash shown `PKR 5,804,400` = ledger | **PASS** |
| S5 | Second tab, same browser | sees the same records | 413 entries | **PASS** |
| S13 | Approve an item, then refresh | approval decision persists, not just transactions | completed 1 → 2, entries 413 | **PASS** |

### 2.2 Reset Demo Data — safety

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| S6 | Click Reset | confirmation dialog appears, nothing happens yet | dialog shown | **PASS** |
| S6b | Cancel the reset | all data intact | still 413 entries | **PASS** |
| S7 | Confirm the reset | seed restored, added payment gone | 412 entries, probe payment absent | **PASS** |
| S7b | Dashboard after reset | back to seeded figures | cash `PKR 5,804,400` | **PASS** |
| **S8** | **Isolation:** pre-planted unrelated keys `theme`, `auth.token`, `unrelated.app.data`, `absa.demo.other` | all survive the reset **with their values unchanged** | all four present and unmodified | **PASS** |
| S8b | Any other keys created by the app | none | none | **PASS** |
| S9 | Reset then refresh | still on the seed, nothing resurrects | 412 entries | **PASS** |

### 2.3 Damaged, foreign or missing storage

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| S10 | Corrupt JSON in the demo key | no white screen, no console error | page rendered, 0 errors | **PASS** |
| S10b | Recovery from corrupt data | replaced by a clean seed | payload rewritten (153,621 chars) | **PASS** |
| S11 | Unknown schema version (`version: 99`) | rejected, seed rebuilt | 412 entries | **PASS** |
| S12 | Payload describing another business | not adopted | seed used, business = ABC Trading Company | **PASS** |
| S15 | `localStorage` throwing on every access | app still boots and renders | page rendered, 0 page errors | **PASS** |
| S15b | Honest status in the UI | reports that nothing is persisted | Settings shows **“In memory only”** | **PASS** |

### 2.4 Privacy / footprint

| # | Test | Expected | Actual | Result |
|---|---|---|---|---|
| S14 | Cookies and sessionStorage | none | cookies 0, sessionStorage 0 | **PASS** |
| S13b | Console / page errors across the whole storage run | none | none | **PASS** |

---

## 3. Defect found during this storage audit — and fixed

### QA-06 · P3 · A saved document preview broke after a later browser session

**How it was found:** the persistence code stores `fileUrl: URL.createObjectURL(file)`. Those blob URLs are
tied to the tab that created them. I simulated “the client uploads a receipt today, reopens the demo
tomorrow” by seeding a saved document whose blob URL no longer exists.

**Observed before the fix:** the preview rendered a **broken image** (`naturalWidth: 0`) with no message —
a visible glitch in front of a client, and it also looked like data loss even though the record and its
fields were intact.

**Fix — `src/pages/Documents.tsx` (only file touched):** the preview image/iframe now carries an
`onError` handler that switches to the existing empty state:

> *“No preview available — The saved preview expired when this browser session ended — the file was never
> uploaded to a server. Re-upload it to preview again; the document record and its fields are still saved.”*

The flag resets when another document is selected. No upload pipeline, extraction logic or accounting
code was touched.

**Verification after the fix:**

| Check | Result |
|---|---|
| Dead blob URL → fallback message shown, no broken image | **PASS** (`S13c`, added to the permanent suite) |
| Normal in-session upload still previews correctly | **PASS** (image renders, `naturalWidth = 1`) |
| `tsc --noEmit` | 0 errors |
| Full suite re-run | see §5 |

---

## 4. Verified limitations (honest, not defects)

| Limitation | Detail | Why it is acceptable for this demo |
|---|---|---|
| **No cross-tab live sync** | Two tabs open at the same time do **not** update each other live; a refresh (or navigation) picks up the latest saved state. Verified: tab B stayed at 3 documents while tab A added a 4th; after reload tab B showed 4. | Single-operator client demo; the brief asked for persistence, not multi-tab realtime |
| **Preview blobs are not durable** | Uploaded file previews only last for the browser session; the document record, filename, size and any manually entered fields persist | Files are never uploaded to a server (by design — no backend) |
| **Storage is per browser profile** | A different browser, profile, or private window starts from the seed | Demo data is intentionally local |
| **Clearing site data wipes the demo** | “Clear cookies and site data” in the browser removes the demo state → app falls back to the seed (no crash) | Same as any browser-only demo |
| **Reset is immediate and permanent** | There is no undo after confirming reset (there is a Cancel path before confirming) | Documented in the UI copy and the walkthrough |
| **No encryption at rest** | Demo records sit in plain JSON in `localStorage` | All data is fictional; no credentials, no real client data |
| **No cloud backup / export** | Reports can be exported to CSV, but the dataset itself cannot be exported | Out of scope for the demo phase |

---

## 5. Full gate re-run after the fix (all executed, this session)

| Suite | Result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run verify` (accounting + AI assertions) | **72 PASS** |
| `npm run build` | **✓ built in 3.22 s** |
| `scripts/qa/audit-ui.mjs` | **28 / 28 PASS** |
| `scripts/qa/audit-financial.mjs` | **81 / 81 PASS** |
| `scripts/qa/audit-ai-docs.mjs` | **50 / 50 PASS** |
| `scripts/qa/audit-storage.mjs` (this report) | **25 / 25 PASS** |
| `scripts/qa/regression-15.mjs` (15-step workflow) | **16 / 16 PASS** |
| `scripts/qa.mjs` (routes + interactions) | 13 / 13 routes, **0 console errors** |
| `scripts/qa-flows.mjs` (end-to-end) | **16 / 16 PASS** |

---

## 6. Verdict

- Demo records **do** survive a browser refresh, a page navigation and a second tab.
- Reset Demo Data **requires confirmation**, restores the seed, and **provably does not touch** any other
  key in `localStorage` (verified with four planted decoy keys, values compared byte-for-byte).
- Damaged, foreign or version-mismatched saved data can never crash or corrupt the demo — the app falls
  back to the seed in every case.
- The app still works when `localStorage` is unavailable, and says so honestly.
- One persistence-related UI defect (QA-06) was found and fixed.
- **Nothing here is cloud-synced, encrypted or backed up** — it is a browser-only demo, exactly as the
  brief requires. Production persistence (MongoDB Atlas etc.) is explicitly out of scope for this phase.
