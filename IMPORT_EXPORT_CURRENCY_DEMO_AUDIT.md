# System Audit & Architecture Plan
## Import / Export, Inventory & Multi-Currency Exchange Extension
**Project:** AI Business Secretary & Accountant (Interactive Client Demo)  
**Date:** November 16, 2026  
**Auditor:** Senior Full-Stack Architect & SaaS UI/UX Specialist  
**Document:** `IMPORT_EXPORT_CURRENCY_DEMO_AUDIT.md`  

---

## 1. Executive Summary

This audit assesses the existing **AI Business Secretary & Accountant** client demonstration codebase to prepare for the addition of two major operational business suites:
1. **Import / Export & Inventory Management** (Import tracking, Export tracking, multi-warehouse stock distribution, inter-location stock transfers, low-stock threshold alerting, and inventory valuation).
2. **Multi-Currency Exchange Management** (Foreign currency holdings in USD, AED, and IRR, buy/sell registers, average cost-basis calculation, realized exchange gain/loss computation, and currency-specific reporting).

The client has not yet supplied formal Excel ledgers. As requested, all new workflows, figures, warehouses, and exchange rates are designed as **realistic demonstration records**, visibly disclaimed as **DEMO DATA**, and constructed so they can be adapted once live client ledgers are received.

---

## 2. Existing Project Inspection

### 2.1 Technology Stack & Runtime
- **Frontend Framework:** React 18.3.1 with TypeScript 5.6.3 and Vite 5.4.10.
- **Routing:** `react-router-dom` v6.27.0 with an `<AppLayout>` shell.
- **Icons & Visuals:** `lucide-react` v0.454.0.
- **Charts:** Zero-dependency, lightweight in-house SVG charts (`LineAreaChart`, `GroupedBarChart`, `DonutChart`, `BarList`, `Sparkline`).
- **Styling:** Custom financial SaaS design system (`src/styles.css`) using CSS variables (deep navy `#061428`, blue accent `#2563eb`, teal `#0e9f8a`, light neutral surface `#f4f6fb`, tabular numbers, responsive drawer/modal patterns).
- **Audio & AI:** Browser-native Web Speech API (`SpeechRecognition` & `SpeechSynthesis`) and a deterministic, rule-based NLP engine (`src/ai/engine.ts`).

### 2.2 Shared Demo Data Architecture & Storage
- **State Provider:** React Context via `StoreProvider` in [src/demo/store.tsx](file:///c:/Users/BK%20Magsi/Downloads/ai-business-secretary/src/demo/store.tsx).
- **Single Source of Truth:** [src/demo/seed.ts](file:///c:/Users/BK%20Magsi/Downloads/ai-business-secretary/src/demo/seed.ts) uses a seeded PRNG (`mulberry32`) and a fixed demo clock (`2026-11-06`) covering a complete fiscal year starting `2025-07-01`.
- **LocalStorage Persistence:** State is persisted under `absa.demo.state.v1`. A `loadInitial()` function restores saved state or falls back to `buildDemoDataset()`.
- **Reset Mechanism:** `resetDemo()` completely flushes the demo key and restores the fresh seeded state.
- **Strict Client Demo Boundary:**
  - **No external database connections** (zero MongoDB Atlas or cloud SQL).
  - **No unverified third-party writes**.
  - **Double-entry mathematical integrity**: The seeded trial balance is balanced (DR 108,539,000 = CR 108,539,000), and the balance sheet equation holds (Assets 28,082,950 = Liabilities 7,928,400 + Equity 20,154,550).

### 2.3 Existing Modules & Capabilities Inventory
| Module | Location | Current Scope | Missing / Required Capabilities |
| :--- | :--- | :--- | :--- |
| **Executive Dashboard** | `src/pages/Dashboard.tsx` | Cash, sales, net profit, receivables, payables, recent vouchers, P&L sparklines | No trade KPIs (import/export totals), no warehouse inventory value, no foreign currency holdings |
| **AI Command Center** | `src/pages/AiCommandCenter.tsx` | Voice & text commands in English, Roman Urdu, and Urdu script; action drafts | No currency exchange intents, no warehouse inventory intents, no import/export intents |
| **Parties** | `src/pages/Parties.tsx` | 8 local customers and suppliers with PKR ledgers | No international suppliers (e.g. Dubai, China) or foreign exchange counterparties |
| **Chart of Accounts** | `src/pages/ChartOfAccounts.tsx` | 18 standard accounts (1000 Cash, 1010 HBL, 1020 Meezan, 1100 AR, 1200 Inventory, 2000 AP, 4000 Sales, 5000 COGS, etc.) | Operates strictly in PKR; lacks foreign currency asset accounts and landed cost variance heads |
| **Transactions** | `src/pages/Transactions.tsx` | Double-entry journal entries (sales, purchase, payment, receipt, expense, deposit, withdrawal, transfer) | Lacks trade shipment documents and multi-currency exchange vouchers |
| **Ledgers & Banks** | `src/pages/Ledgers.tsx`, `BankAccounts.tsx` | General ledger and local bank balances (HBL, Meezan) | No multi-currency cash vaults or foreign bank accounts |
| **Document Intelligence** | `src/pages/Documents.tsx` | Simulated OCR and field extraction from sample slips and invoices | Standard Pakistani slips; no bill of lading or customs declarations |
| **Approvals** | `src/pages/Approvals.tsx` | Safety queue where action drafts require explicit approval before posting | Ready to receive trade and currency drafts |

### 2.4 Existing Inventory & Currency Analysis
- **Inventory Status:**
  - Currently, Account `1200` ("Inventory") holds a lump-sum financial value (`PKR 2,760,150`).
  - **No itemized inventory exists**: There is no SKU tracking, product catalogue, category list, unit of measure, or location breakdown.
  - **No warehouse model exists**: Physical locations (Main, Karachi, Dubai, Lahore) and stock transfers do not exist.
  - **No import/export shipment workflow exists**: "Export" in the current UI strictly refers to downloading CSV or JSON reports.
- **Currency Status:**
  - Currently, all accounts and transactions operate strictly in `PKR` (`Pakistani Rupee`).
  - **No multi-currency tracking exists**: There are zero balances or transaction logs for `USD`, `AED`, or `IRR`.
  - **No foreign exchange logic exists**: No purchase/sale rates, no weighted-average cost calculation, and no realized currency gain/loss tracking.

---

## 3. Architecture & Non-Duplication Strategy

To maintain clean code separation and prevent regression of existing accounting verifications:

1. **Dedicated Domain Typing (`src/demo/tradeTypes.ts`)**:
   - Cleanly defines all data contracts for Warehouses, Products, Stock Movements, Stock Transfers, Import Shipments, Export Shipments, and FX Transactions.
2. **Unified Data Layer Integration (`src/demo/types.ts` & `src/demo/store.tsx`)**:
   - `DemoDataset` is augmented with dedicated collections:
     - `warehouses: WarehouseLocation[]`
     - `inventory: InventoryProduct[]`
     - `stockTransfers: StockTransfer[]`
     - `imports: ImportShipment[]`
     - `exports: ExportShipment[]`
     - `fxTransactions: FxTransaction[]`
   - Store actions are added: `recordImport()`, `recordExport()`, `transferStock()`, `receiveStockTransfer()`, `recordFxPurchase()`, `recordFxSale()`.
   - Existing baseline double-entry journal entries and balance sheet checks remain protected and unmodified.
3. **Safe Accounting Bridges**:
   - When an import is marked *Received*, it adjusts the product inventory and creates an operational trade record. For double-entry posting, users can trigger or approve a journal entry (Debit Inventory `1200` / Credit Accounts Payable `2000` or Bank `1010`), ensuring total balance is preserved.
   - When foreign currency is bought or sold, the transaction calculates the weighted-average cost basis and realized gain/loss in PKR.
4. **Reusing Existing SaaS UI System**:
   - Reuse `<Page>`, `<Card>`, `<CardHead>`, `<StatusBadge>`, `<Modal>`, `<Field>`, `<EmptyState>`, `<Avatar>`, and toast notifications from `src/components/ui.tsx`.
   - Reuse SVG chart engines (`DonutChart`, `BarList`, `GroupedBarChart`, `LineAreaChart`) from `src/components/charts.tsx`.
   - Reuse formatting utilities (`formatPKR`, `formatDate`, `formatCompactPKR`) from `src/lib/format.ts` and add dedicated multi-currency formatters (`formatForeignCurrency()`).

---

## 4. Detailed Implementation Roadmap

### Phase 2: Import / Export & Inventory Management
- **Locations**: Fictional demonstration warehouses:
  1. Main Warehouse (Karachi)
  2. Karachi Port Terminal Warehouse
  3. Dubai Free Zone Warehouse (UAE)
  4. Lahore Distribution Center
- **Product Catalog**: High-volume import/export demo commodities:
  1. `SKU-RICE-001`: Super Kernel Basmati Rice (MT)
  2. `SKU-YARN-002`: Combed Cotton Yarn 30/1 (Bales)
  3. `SKU-SOLAR-003`: 550W Tier-1 Mono Solar Panels (Units)
  4. `SKU-SPICE-004`: Pure Iranian Saffron Negin (Kg)
  5. `SKU-STEEL-005`: Deformed Steel Rebars Grade 60 (MT)
  6. `SKU-BEAR-006`: High-Precision Industrial Bearings (Cartons)
- **Import Module (`/imports`)**:
  - Full tracking with status lifecycle: *Draft → Ordered → In Transit → Received → Partially Received → Cancelled*.
  - Landed cost calculation: Base purchase (in foreign currency + exchange rate) + Shipping + Customs + Other expenses.
  - Receiving workflow: Increases available stock at the selected warehouse location upon receiving.
- **Export Module (`/exports`)**:
  - Full tracking with status lifecycle: *Draft → Confirmed → Ready for Dispatch → Dispatched → Delivered → Cancelled*.
  - Verification: Ensures dispatch warehouse has sufficient stock.
  - Stock allocation: Reserves stock when *Confirmed*, deducts stock when *Dispatched*.
- **Inventory & Stock Transfers (`/inventory`, `/stock-transfers`)**:
  - Location-wise matrix showing Available vs. Reserved stock.
  - Low-stock threshold alerts with color-coded badges.
  - Inter-warehouse transfer workflow: Moves quantity to "In Transit" from source warehouse, and increases destination stock only after explicit receipt confirmation. Avoids duplicate stock movements.

### Phase 3: Multi-Currency Exchange Management
- **Currencies**:
  - `USD` (United States Dollar)
  - `AED` (UAE Dirham)
  - `IRR` (Iranian Rial — noted with clear unit convention, e.g. 1 Million IRR demo bundles)
  - Extensible architecture allowing additional currencies.
- **Currency Dashboard & Balance Cards (`/currency-exchange`)**:
  - Live available holdings per currency.
  - Realized cumulative exchange profit/loss.
  - Weighted average acquisition rate vs. recent transaction rates.
- **Buy / Sell Forms with Validations**:
  - Purchase: Adds foreign currency to available balance, records PKR equivalent and payment source.
  - Sale: Validates that foreign currency sold does not exceed available balance.
  - Realized Gain/Loss: Uses Weighted Average Cost (WAC) method:
    $$\text{Realized P\&L} = (\text{Selling Rate} - \text{Average Cost Rate}) \times \text{Sold Amount}$$
- **Currency Reports (`/currency-reports`)**:
  - Purchase register, sales register, party-wise currency balances, realized profit/loss statement.

### Phase 4: Accounting Integration & Guardrails
- Maintain balance integrity of the existing 412 seeded double-entry journal vouchers.
- Provide clear workflow drafts for trade and currency events, showing the exact debit/credit entries for user review and approval before touching ledger accounts.

### Phase 5: Dashboard Updates
- Update `src/pages/Dashboard.tsx` with:
  - Inventory valuation card & low-stock indicator.
  - Import vs. Export volume metrics.
  - Multi-currency liquidity card (USD, AED, IRR).
  - Exchange profit/loss KPI card.
  - Visual charts: Location-wise Stock Distribution (`DonutChart`), Import vs. Export Monthly Comparison (`GroupedBarChart`), and Currency Holdings Breakdown (`BarList`).

### Phase 6: AI Assistant Voice & Text Integration
- Update `src/ai/engine.ts` with deterministic rule-based matching for trade and currency queries in English, Roman Urdu, and native Urdu script:
  - Foreign currency positions: *"Mere paas kitna dollar available hai?"*, *"Iranian currency ka balance kya hai?"*
  - Warehouse stock checks: *"Karachi warehouse mein kitna stock hai?"*, *"Dubai se Lahore kitna transfer hua?"*
  - Import/Export summaries: *"Total import value kitni hai?"*, *"Is month ki exports dikhao"*
  - Inventory alerts: *"Low stock products ki list dikhao"*
- Voice input and response support via existing `VoiceControls` and `voiceSynthesizer`.

### Phase 7: Professional SaaS UI/UX & Navigation
- Expand sidebar navigation with clear groupings:
  - **Trade & Logistics**: Import Management, Export Management, Inventory, Stock Transfers.
  - **Foreign Exchange**: Currency Exchange, Currency Reports.
- Add desktop-first interactive data tables, search filters, detail drawers, status badges, and action modals.

### Phase 8: Demo Data Persistence & Restrictions
- Seed 20+ realistic historical imports, exports, stock transfers, and currency exchange transactions.
- Keep all records inside browser `localStorage` under `absa.demo.state.v1`.
- Clean reset support restoring original fictional demo state.

### Phase 9: Verification & Automated QA
- Create unit tests in `scripts/verify-trade-currency.ts`.
- Create end-to-end browser tests in `scripts/qa-trade-currency.mjs` verifying UI forms, calculations, stock adjustments, and voice queries.
- Ensure all existing accounting tests continue passing with zero regressions.

---

## 5. Audit Conclusion

The application architecture is well-structured, modular, and ready for this extension. No architectural rewrites are necessary. All requirements will be fulfilled cleanly through modular extensions while maintaining 100% demo data isolation and client presentation standards.

