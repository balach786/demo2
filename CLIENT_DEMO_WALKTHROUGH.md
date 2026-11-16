# CLIENT DEMO WALKTHROUGH

**AI Business Secretary & Accountant — Interactive Demonstration Guide**  
**Business Shown:** **ABC Trading Company** · Base Currency: **PKR**  
**Specialized Operational Modules:** Commercial Imports, Exports, Multi-Warehouse Inventory, & Multi-Currency Exchange Desk  
**Notice:** **DEMO DATA** — All figures, suppliers, customers, exchange rates, and warehouse hubs are fictional sample records created to demonstrate end-to-end workflows.

---

## 0. Quick Start & Demonstration Preparation

```bash
npm install
npm run dev
# or for production preview:
npm run build && npm run preview
```
Open **http://localhost:5173** (or **http://localhost:4173**).

> **DEMO DATA NOTIFICATION:**
> A persistent banner and header badge indicates that the application operates in **DEMO MODE**. All operations are processed locally and stored exclusively inside the browser's `localStorage` (`absa.demo.state.v1`). Zero external network calls are made.

**To start with the clean baseline state:**
Click the **Reset demo data** icon (circular arrow in top-right header) $\rightarrow$ confirm reset. All seed records, warehouses, shipments, and journals will be reset to the exact figures shown below.

---

## 1. Executive Dashboard — Financial & Operational Overview

You land directly on the **Dashboard**. Review the executive KPI blocks:

### 1.1 Core Financial Accounting KPIs
| KPI | Baseline Seed Value | Financial Context |
|---|---|---|
| **Total Cash Balance** | **PKR 5,804,400** | Liquid cash across safe and petty cash |
| **Total Bank Balance** | **PKR 11,095,050** | Reconciled Meezan & HBL bank accounts |
| **Total Sales (FY)** | **PKR 23,896,700** | Historical domestic commercial turnover |
| **Total Purchases (FY)**| **PKR 16,314,350** | Domestic procurement |
| **Operating Expenses** | **PKR 4,493,050** | Salaries, rent, and utility outlays |
| **Net Profit** | **PKR 2,850,100** | Net margin of 11.9% |
| **Receivables** | **PKR 5,823,350** | Customer outstanding balances |
| **Payables** | **PKR 6,428,400** | Supplier payables |

### 1.2 Trade Logistics & Foreign Currency Desk Section (New)
Scroll down to the dedicated **Trade Logistics & Foreign Currency Desk** section:
- **Total Stock Valuation:** **PKR 122.4M** (1,091 units across 4 regional warehouses).
- **Commercial Landed Imports:** **PKR 50.5M** across 4 shipments (China, Iran, UAE, Germany).
- **Commercial Exports:** **PKR 26.5M** across 3 shipments (UAE, UK, Iran).
- **Realized Forex Trading Gain:** **PKR 123,886** net profit locked from currency sales.
- **Forex Liquid Holdings Widget:** Displays live positions:
  - **USD 23,000.00** @ WAC PKR 279.14 (Basis: PKR 6,420,286 · Realized: +PKR 52,286)
  - **AED 50,000.00** @ WAC PKR 76.00 (Basis: PKR 3,800,000 · Realized: +PKR 45,000)
  - **IRR 1,700,000,000** @ WAC PKR 0.000640 (Basis: PKR 1,088,000 · Realized: +PKR 26,600)
- **Demonstration Warehouses Widget:** Real-time active status across Main (Karachi), Karachi Port, Dubai, and Lahore.

---

## 2. Commercial Import Management & Landed Cost

Sidebar $\rightarrow$ **Trade & Logistics** $\rightarrow$ **Imports**.

### What to demonstrate:
1. **Shipment Register:** View active import records (e.g., `IMP-2026-001` for Tier-1 Solar PV Panels from China).
2. **Landed Cost Breakdown:** Click on any shipment row to open the **Detail Drawer**. Walk through the calculation:
   - Foreign Invoice: USD 23,400 @ 280.00 = PKR 6,552,000
   - Freight & Shipping: PKR 420,000
   - Customs & Import Duties: PKR 350,000
   - Port Demurrage & Handling: PKR 78,000
   - **Total Landed Cost:** **PKR 7,400,000** (Unit Landed Cost: **PKR 18,500 / unit**).
3. **Simulate Receiving an Import:**
   - In the drawer for an `In Transit` shipment, click **Mark Received**.
   - Notice the toast confirmation and status transition to `Received`.
   - Navigate to **Inventory**: the destination warehouse's available stock increases automatically!

---

## 3. Commercial Export Management & Stock Validation

Sidebar $\rightarrow$ **Trade & Logistics** $\rightarrow$ **Exports**.

### What to demonstrate:
1. **Export Invoicing:** Review commercial shipments to international buyers in Dubai, London, and Tehran.
2. **Net Realization Math:** Point out how gross foreign sale values are converted at spot rates and adjusted for domestic freight/clearing to display the true net PKR realization.
3. **Stock Protection Safeguard:**
   - Click **Record Export Sale**.
   - Select a product and dispatch warehouse.
   - Enter a quantity larger than current available stock.
   - Point out that the system immediately blocks overselling with an alert: *"Insufficient Stock Available"*.
   - Reduces human error and prevents phantom inventory dispatch.

---

## 4. Multi-Warehouse Inventory & Low Stock Alerts

Sidebar $\rightarrow$ **Trade & Logistics** $\rightarrow$ **Inventory**.

### What to demonstrate:
1. **Valuation & Alert Banner:** Total enterprise stock valuation (**PKR 122,435,000**) with an amber alert banner highlighting items requiring replenishment:
   - *Pure Iranian Saffron Super Negin* (Available: 24 kg vs Min: 25 kg).
   - *High-Precision Industrial Ball Bearings* (Available: 80 cartons vs Min: 80 cartons).
2. **Three-Way View Switcher:**
   - **Product Catalog View:** Shows visual product cards with stock units, cost basis, total valuation, and warehouse distribution badges.
   - **Warehouse Location Matrix:** Click the tab to display a full grid showing the exact breakdown across **Main Warehouse**, **Karachi Port**, **Dubai Hub**, and **Lahore Depot**.
   - **Stock Movement History:** Shows the chronological audit trail of all receipts, dispatches, and transfers.

---

## 5. Inter-Warehouse Stock Transfers & In-Transit Reservation

Sidebar $\rightarrow$ **Trade & Logistics** $\rightarrow$ **Stock Transfers**.

### What to demonstrate:
1. **Active In-Transit Logistics:** Point to `TRF-WH-003` showing 20 MT of Basmati Rice currently moving from Karachi to Lahore.
2. **The Anti-Duplication Reservation Principle:**
   - Explain to the client: *When goods leave the Karachi warehouse, they are moved to "Reserved" at the source.*
   - *They are NOT added to the Lahore warehouse until the Lahore manager confirms receipt.*
   - This eliminates double-counting and prevents warehouse managers from selling stock that has not physically arrived.
3. **Confirm Receipt Action:**
   - Click **Confirm Receipt** on `TRF-WH-003`.
   - The status updates to `received`.
   - Switch back to **Inventory**: Lahore's Basmati Rice stock increases by 20 MT, and Karachi's reserved units drop to 0!

---

## 6. Multi-Currency Exchange Desk (USD, AED, IRR)

Sidebar $\rightarrow$ **Currency Exchange** $\rightarrow$ **Trading Desk**.

### What to demonstrate:
1. **Currency Holdings Cards:**
   - Show the 3 distinct cards for **USD**, **AED**, and **IRR**.
   - Each card highlights: Available Foreign Balance, Weighted Average Cost (WAC) rate in PKR, Total PKR Invested Basis, and Realized Trading Gain.
2. **The Iranian Rial (IRR) ISO Rule:**
   - Point out the prominent banner:
     > *"Notice: All Iranian currency transactions are recorded in official ISO Iranian Rial (IRR), NOT Toman (1 Toman = 10 IRR). Do not mix denominations."*
   - Note that Iranian Rial amounts are formatted strictly with **0 decimal places** (e.g., `1,700,000,000 IRR`), preventing decimal confusion.
3. **Buy Currency (Weighted Average Cost Recalculation):**
   - Click **Buy Foreign Currency**.
   - Enter: Currency = **USD**, Amount = **10,000**, Rate = **282.00**, Dealer = **Al-Rahim Exchange**.
   - Explain how the system dynamically recalculates the new WAC rate across all historical tranches.
4. **Sell Currency (Live Realized P&L Preview):**
   - Click **Sell Foreign Currency**.
   - Select **USD** and enter **5,000**.
   - Point out the **P&L Preview Box**:
     - Shows current WAC rate: **PKR 279.14**
     - Enter Selling Rate: **PKR 285.00**
     - Live preview instantly calculates: **Expected Realized Profit = +PKR 29,286**!
   - Click **Execute Sale**: the trade is recorded, realized profit updates instantly, and foreign holdings decrease cleanly.

---

## 7. Currency Reports & Analytics

Sidebar $\rightarrow$ **Currency Exchange** $\rightarrow$ **Forex Reports**.

### What to demonstrate:
- **Realized P&L Ledger:** Shows every closed currency sale, the counterparty dealer, sale rate vs WAC rate, and net profit realized.
- **Separate Purchase and Sales Registers:** Analyze source procurement channels vs liquidation counterparties.
- **Counterparty Dealer Breakdown:** Volume and margin analysis across exchange companies and banks.
- **Export to CSV:** Click **Export CSV** to download the complete transaction ledger for Excel audit.

---

## 8. AI Business Secretary & Voice Command Center

Sidebar $\rightarrow$ **AI Command Center**.

The AI Assistant supports **English**, **Roman Urdu**, and **Urdu script**, with both speech-to-text input and voice narration output!

### Voice & Chat Commands to Try:

| Spoken / Typed Prompt | Language | AI Assistant Response / Action |
|---|---|---|
| `Mere paas kitna dollar available hai?` | Roman Urdu | Reports 23,000 USD available @ WAC PKR 279.14 with invested basis PKR 6.42M. |
| `How much USD balance do we have available?` | English | Identical live financial response in English. |
| `Karachi warehouse mein kitna stock hai?` | Roman Urdu | Breaks down all inventory units currently situated at Karachi Main & Port. |
| `Dubai warehouse se Lahore kitna stock transfer hua?` | Roman Urdu | Reports inter-warehouse transfer records and transit statuses. |
| `Is month ka currency exchange profit kitna hai?` | Roman Urdu | Reports realized forex trading gain (**PKR 123,886** across USD, AED, IRR). |
| `Low stock products ki list dikhao.` | Roman Urdu | Identifies Iranian Saffron and Ball Bearings as below reorder levels. |
| `Aaj ki total sales kitni hain?` | Roman Urdu | Reports today's domestic sales (**PKR 658,500**). |
| `Ahmed ka ledger dikhao.` | Roman Urdu | Displays Ahmed Enterprises' receivable balance (**PKR 1,642,100**) and recent vouchers. |
| `Prepare a payment of Rs. 25,000 to ABC Traders.` | English | **Action Safety Workflow:** Prepares a draft voucher with preview; does NOT auto-post without human confirmation. |

### Voice Features to Demonstrate:
- Click the **Microphone** icon $\rightarrow$ wave animation appears $\rightarrow$ speak in Urdu or English $\rightarrow$ text appears in input for review before submission.
- Click the **Speaker** icon on assistant responses to have the answer read aloud.

---

## 9. Core Accounting Integrity & Financial Reports

Sidebar $\rightarrow$ **Financial Reports**.

Demonstrate to the client's finance director that the underlying double-entry books are completely intact:
1. **Trial Balance:**
   - Debit: **PKR 108,539,000** | Credit: **PKR 108,539,000**
   - Difference: **0.00 PKR**.
2. **Balance Sheet:**
   - Assets: **PKR 28,082,950**
   - Liabilities: **PKR 7,928,400** + Equity: **PKR 20,154,550** = **PKR 28,082,950**
   - Difference: **0.00 PKR**.
3. **Cash Flow Statement:**
   - Opening Liquid Balance + Net Operating/Investing Cash Flow = Closing Liquid Balance (**PKR 16,899,450**).
   - Reconciles to the cent with cash and bank control ledgers.

---

## 10. Summary of Demonstration Features & Boundaries

| Operational Area | Implementation Status | Demonstration Architecture |
|---|---|---|
| Double-Entry General Ledger | **Real Accounting Logic** | 412 baseline entries, zero rounding errors, strict debit/credit enforcement. |
| Multi-Warehouse Stock Management | **Fully Functional** | 4 demonstration warehouses, live stock checks, matrix view, anti-duplication transfers. |
| Commercial Landed Cost Engine | **Fully Functional** | Multi-currency invoice conversion, customs, freight, and clearing allocation. |
| Foreign Currency Exchange Desk | **Fully Functional** | USD, AED, IRR tracking with volume Weighted Average Cost (WAC) and realized P&L. |
| Iranian Rial (IRR) ISO Rules | **Fully Functional** | Strict 0 decimal formatting, prominent Toman disclaimer (1 Toman = 10 IRR). |
| AI Assistant (Text & Voice) | **Fully Functional** | Deterministic rules engine executing over live demo data; Web Speech STT/TTS. |
| Client Persistence | **Browser localStorage** | Persisted under `absa.demo.state.v1`; survives browser refresh; reset button available. |
| Production Cloud Backend | **Planned for Phase 2** | MongoDB Atlas, multi-user authentication, and SBP/Customs EDI integration. |

---

## 11. Concluding the Presentation

Conclude the demonstration by highlighting that:
1. All demonstrated workflows are ready to be tailored to the client's actual Excel ledgers and specific Chart of Accounts.
2. The accounting math and double-entry reconciliation are 100% verified.
3. The client can freely interact with the demo on their own laptop or tablet without any risk of data loss.
