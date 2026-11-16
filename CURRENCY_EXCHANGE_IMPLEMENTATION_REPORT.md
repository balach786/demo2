# MULTI-CURRENCY EXCHANGE MANAGEMENT IMPLEMENTATION REPORT

**Project:** AI Business Secretary & Accountant  
**Module:** Multi-Currency Exchange Desk & Realized Forex P&L Engine  
**Status:** Fully Implemented & Verified  
**Date:** November 2026  
**Persistence:** Client-side `localStorage` (`absa.demo.state.v1`) & React Context Store  
**Notice:** **DEMO DATA** — All counterparty dealers, foreign exchange rates, cash vouchers, and trading transactions are fictional demonstration records.

---

## 1. Executive Summary

This report documents the architectural design, mathematical accounting foundations, currency conventions, and verification results for the **Multi-Currency Exchange Management** module.

The client operates an international trade and currency desk handling physical foreign currency notes and telegraphic transfers across three primary trading currencies:
1. **USD — US Dollar**
2. **AED — UAE Dirham**
3. **IRR — Iranian Rial**

Key capabilities delivered:
- **Foreign Currency Purchase & Sale Registers** capturing counterparty dealer, foreign amount, exchange rate (PKR), settlement account, and voucher reference.
- **Weighted Average Cost (WAC) Engine** that recalculates the effective inventory cost basis upon every currency purchase.
- **Realized Forex Gain/Loss Engine** calculating exact profit or loss on sales against the prevailing WAC basis.
- **Strict Iranian Rial (IRR) ISO 4217 Rules** preventing confusion with Toman (1 Toman = 10 IRR) and formatting with strictly 0 decimal places.
- **Foreign Currency Holdings Valuation** reflecting remaining inventory quantity, WAC acquisition rate, and net invested capital in PKR.

All functions are verified and run deterministically within the browser demo environment without modifying the baseline 412 double-entry accounting records.

---

## 2. Supported Currencies & Formatting Rules

| Currency Code | Currency Name | Decimals | Minimum Step | ISO Convention & Operational Note |
|---|---|---|---|---|
| **USD** | US Dollar | 2 | 0.01 | Global standard currency. Rates quoted to 2 decimal places in PKR. |
| **AED** | UAE Dirham | 2 | 0.01 | Pegged GCC trading currency. Standard rate increments in PKR. |
| **IRR** | Iranian Rial | **0** | **1** | **Strict ISO 4217 Currency.** Quoted with **0 decimal places** due to large face values. Explicitly separated from Toman. |

### 2.1 The Iranian Rial (IRR) vs Toman Distinction

> [!IMPORTANT]
> **CRITICAL DENOMINATION RULE:** In Iranian commerce, street prices are frequently quoted informally in **Toman**, where:
> 
> $$1 \text{ Toman} = 10 \text{ Iranian Rials (IRR)}$$
> 
> However, banking ledgers, customs declarations, international wire transfers, and official banknotes use **Iranian Rial (IRR)**.

**System Implementation Safeguards:**
1. **Zero Decimals:** The formatter `formatFxAmount(amount, 'IRR')` strictly suppresses cents/decimals, displaying formatted strings such as `1,700,000,000 IRR`.
2. **Prominent UI Disclaimer:** All currency exchange screens display an active callout banner:
   > *"Notice: All Iranian currency transactions are recorded in official ISO Iranian Rial (IRR), NOT Toman (1 Toman = 10 IRR). Do not mix denominations."*
3. **AI Secretary Parity:** When asked about Iranian currency in English, Urdu, or Roman Urdu, the AI assistant explicitly states that figures are quoted in official Rials, citing the conversion factor to Toman.

---

## 3. Mathematical Foundations: Weighted Average Cost (WAC) & Realized P&L

To comply with International Accounting Standards (IAS 21 — *The Effects of Changes in Foreign Exchange Rates* and IAS 2 — *Inventories*), foreign currency held for trading is treated as financial inventory and costed using the **Weighted Average Cost (WAC)** method.

### 3.1 Weighted Average Cost (WAC) Formula

When purchasing foreign currency:
- If prior balance is 0, the new WAC rate equals the purchase rate.
- If prior balance is positive, the new WAC rate is the volume-weighted average of existing cost basis plus the new purchase:

$$\text{WAC}_{\text{new}} = \frac{(\text{Qty}_{\text{prior}} \times \text{WAC}_{\text{prior}}) + (\text{Qty}_{\text{purchased}} \times \text{Rate}_{\text{purchase}})}{\text{Qty}_{\text{prior}} + \text{Qty}_{\text{purchased}}}$$

$$\text{New Invested Basis (PKR)} = \text{Total Quantity} \times \text{WAC}_{\text{new}}$$

When selling foreign currency:
- The WAC rate **does not change**.
- The invested cost basis reduces proportionally:

$$\text{Cost Basis of Sale (PKR)} = \text{Qty}_{\text{sold}} \times \text{WAC}_{\text{current}}$$

$$\text{Remaining Invested Basis (PKR)} = (\text{Qty}_{\text{prior}} - \text{Qty}_{\text{sold}}) \times \text{WAC}_{\text{current}}$$

---

### 3.2 Realized Forex Profit & Loss Formula

Realized gain or loss is booked at the exact moment of sale:

$$\text{Realized P\&L (PKR)} = \text{Qty}_{\text{sold}} \times (\text{Selling Rate}_{\text{PKR}} - \text{WAC}_{\text{current}})$$

- If $\text{Selling Rate} > \text{WAC}$, a **Realized Forex Gain** is recorded.
- If $\text{Selling Rate} < \text{WAC}$, a **Realized Forex Loss** is recorded.

---

### 3.3 Step-by-Step Mathematical Trace (USD Seed Verification)

The seed dataset contains the following sequential transactions for USD:

```
Transaction 1: Buy 20,000 USD @ PKR 278.50 on 2026-11-01
- Purchased Amount:  USD 20,000
- PKR Spent:         20,000 * 278.50 = PKR 5,570,000
- Balance:           USD 20,000
- WAC Rate:          PKR 278.5000 / USD
- Invested Basis:    PKR 5,570,000

Transaction 2: Buy 15,000 USD @ PKR 280.00 on 2026-11-03
- Purchased Amount:  USD 15,000
- PKR Spent:         15,000 * 280.00 = PKR 4,200,000
- Total Foreign Qty: 20,000 + 15,000 = USD 35,000
- Total PKR Basis:   5,570,000 + 4,200,000 = PKR 9,770,000
- WAC Rate:          9,770,000 / 35,000 = PKR 279.142857 / USD
- Invested Basis:    PKR 9,770,000

Transaction 3: Sell 12,000 USD @ PKR 283.50 on 2026-11-05
- Sold Amount:       USD 12,000
- PKR Inflow:        12,000 * 283.50 = PKR 3,402,000
- Cost of Sold FX:   12,000 * 279.142857 = PKR 3,349,714.28
- Realized Gain:     12,000 * (283.50 - 279.142857) = PKR +52,285.71 (~ PKR 52,286)
- Remaining Qty:     35,000 - 12,000 = USD 23,000
- WAC Rate:          PKR 279.142857 / USD (Unchanged)
- Remaining Basis:   23,000 * 279.142857 = PKR 6,420,285.71 (~ PKR 6,420,286)
```

---

## 4. Current Currency Portfolio Breakdown

Below is the verified summary of the multi-currency holdings in the demonstration portfolio:

| Currency | Opening Balance | Total Purchased | Total Sold | Available Balance | WAC Rate (PKR) | Invested Basis (PKR) | Realized P&L (PKR) |
|---|---|---|---|---|---|---|---|
| **USD** | 0.00 | 35,000.00 | 12,000.00 | **23,000.00 USD** | **PKR 279.14** | **PKR 6,420,286** | **+ PKR 52,286** |
| **AED** | 0.00 | 80,000.00 | 30,000.00 | **50,000.00 AED** | **PKR 76.00** | **PKR 3,800,000** | **+ PKR 45,000** |
| **IRR** | 0 | 15,000,000,000 | 13,300,000,000 | **1,700,000,000 IRR** | **PKR 0.000640** | **PKR 1,088,000** | **+ PKR 26,600** |
| **TOTAL** | — | — | — | — | — | **PKR 11,308,286** | **+ PKR 123,886** |

*Note: All three currencies have generated positive realized trading margins totaling PKR 123,886.*

---

## 5. User Interface Implementation

### 5.1 Currency Exchange Desk (`src/pages/CurrencyExchange.tsx`)
- **Holdings Cards:** Three responsive hero cards for USD, AED, and IRR displaying available balance, average buying rate (WAC), current portfolio cost basis, and cumulative realized P&L with upward trend indicators.
- **Denomination Alert Banner:** Visual info badge reminding users that Iranian Rial (IRR) is ISO official, not Toman.
- **Buy Foreign Currency Modal:** User inputs foreign amount, exchange rate in PKR, dealer/bank, and payment method (Cash vs Bank). Displays instant PKR settlement calculation.
- **Sell Foreign Currency Modal:** Live validation of available balance. Features a real-time **P&L Preview Box** showing current WAC rate, expected sale proceeds, and calculated realized profit before confirming the trade.
- **Transaction History Register:** Full chronological audit log displaying date, voucher number, type (BUY / SELL), dealer, rate, foreign amount, PKR value, and realized profit badge.

### 5.2 Currency Reports & Analytics (`src/pages/CurrencyReports.tsx`)
- **Realized P&L Ledger:** Detailed line-by-line accounting breakdown for every sale showing sale date, counterparty, units sold, selling rate, historical WAC rate, and net profit in PKR.
- **Separate Purchase & Sale Registers:** Segmented views to analyze buying sources vs selling destinations.
- **Counterparty Dealer Analysis:** Summary table tracking transaction volumes and average margins across authorized money exchangers and banks.
- **CSV Export:** One-click client export generating a clean spreadsheet of all currency trades for audit.

---

## 6. Feature Classification Matrix

| Feature / Capability | Classification | Technical Description & Implementation Scope |
|---|---|---|
| Foreign Currency Buy Vouchers | **Fully Functional** | Records counterparty, currency, rate, amount, settlement account, and recalculates WAC. |
| Foreign Currency Sell Vouchers | **Fully Functional** | Checks available balance, computes realized P&L against WAC, reduces foreign holdings. |
| Weighted Average Cost (WAC) Engine | **Fully Functional** | Recomputed on every purchase according to IAS 2 volume-weighted formulas. |
| Realized Forex Profit/Loss Engine | **Fully Functional** | Automatically locks in realized gain/loss per transaction and updates cumulative stats. |
| Iranian Rial (IRR) ISO Formatting | **Fully Functional** | Formatted with 0 decimals; distinct from Toman; prominent disclaimers in UI and AI. |
| Available Balance Guardrails | **Fully Functional** | UI prevents selling currency exceeding available balance, eliminating negative holdings. |
| Trade Filter & Counterparty Reports | **Fully Functional** | Filterable by currency, date range, and dealer; includes CSV export. |
| AI Voice & Text Query Integration | **Fully Functional** | Natural language queries in English, Roman Urdu, and Urdu script return balances, rates, and profits. |
| Live Central Bank API Ticker | **Not Implemented** | Fictional demo rates; no external WebSocket feed or live SBP API connection. |
| Physical Banknote Serial Number Scanner | **Not Implemented** | Beyond current scope; transactions track batch volumes rather than note serials. |

---

## 7. Compliance & Safety Verification

1. **Deterministic Calculations:** All calculations verified in `scripts/verify-trade-currency.ts` down to exact rupee values.
2. **Zero Accounting Pollution:** Operational forex records exist in dedicated typed storage (`DemoDataset.fxTransactions`) and do not pollute the 412 baseline journal entries.
3. **Double-Entry Voucher Ready:** When user clicks "Post Voucher", a balanced double-entry accounting draft is prepared for approval rather than silently altering financial ledgers.

