/**
 * AUDITED BUSINESS TOOLS LAYER
 * AI Business Secretary & Accountant Management System
 *
 * Deterministic, read-only tools that query the shared DemoDataset.
 * Financial values are NEVER invented or estimated by an LLM.
 * All figures derive directly from verified accounting and trade engines.
 */

import type { DemoDataset, FxCurrency, FxTransactionType, Party } from '../../demo/types';
import {
  balanceSheet,
  buildRange,
  partyBalance,
  partyLedger,
  profitAndLoss,
  sumAccounts,
  trialBalance,
  BANK_ACCOUNTS,
  CASH_ACCOUNTS,
} from '../../demo/accounting';
import {
  computeFxBalances,
  formatFxAmount,
  formatFxRate,
  getProductTotalStock,
  getProductValuation,
  isLowStock,
  calculateTotalInventoryValuation,
} from '../../demo/tradeLogic';

/* ------------------------------------------------------------------ */
/* 1. Dashboard Summary Tool                                          */
/* ------------------------------------------------------------------ */
export function getDashboardSummary(ds: DemoDataset) {
  const range = buildRange('year', ds.demoToday);
  const pnl = profitAndLoss(ds, range.start, range.end);
  const cash = sumAccounts(ds, CASH_ACCOUNTS);
  const bank = sumAccounts(ds, BANK_ACCOUNTS);
  const fxBalances = computeFxBalances(ds.fxTransactions ?? []);
  const inventoryValuation = calculateTotalInventoryValuation(ds.inventory ?? []);

  const totalForexRealizedProfit = Object.values(fxBalances).reduce((sum, b) => sum + b.totalRealizedProfitLossPKR, 0);
  const totalForexInvestedBasis = Object.values(fxBalances).reduce((sum, b) => sum + b.totalPKRInvested, 0);

  const customers = ds.parties.filter((p) => p.type === 'customer');
  const suppliers = ds.parties.filter((p) => p.type === 'supplier');
  const receivables = customers.reduce((acc, c) => acc + Math.max(0, partyBalance(ds, c.id).balance), 0);
  const payables = suppliers.reduce((acc, s) => acc + Math.max(0, partyBalance(ds, s.id).balance), 0);

  return {
    salesFY: pnl.totalRevenue,
    purchasesFY: pnl.totalCostOfSales,
    expensesFY: pnl.totalOperatingExpenses,
    netProfitFY: pnl.netProfit,
    netMarginPercent: pnl.netMarginPct,
    cashInHand: cash,
    bankBalance: bank,
    totalLiquidity: cash + bank,
    receivables,
    payables,
    inventoryValuation,
    totalForexRealizedProfit,
    totalForexInvestedBasis,
  };
}

/* ------------------------------------------------------------------ */
/* 2. Currency Balances Tool                                          */
/* ------------------------------------------------------------------ */
export function getCurrencyBalances(ds: DemoDataset, targetCurrency?: FxCurrency) {
  const fxBalances = computeFxBalances(ds.fxTransactions ?? []);

  if (targetCurrency) {
    const item = fxBalances[targetCurrency];
    return {
      currency: targetCurrency,
      availableBalance: item.availableBalance,
      formattedBalance: formatFxAmount(item.availableBalance, targetCurrency),
      wacRatePKR: item.weightedAvgCostRate,
      formattedWacRate: formatFxRate(item.weightedAvgCostRate, targetCurrency),
      investedCostBasisPKR: item.totalPKRInvested,
      realizedProfitPKR: item.totalRealizedProfitLossPKR,
      totalPurchased: item.totalPurchased,
      totalSold: item.totalSold,
      denominationNote: item.denominationNote,
    };
  }

  const totalInvestedBasisPKR = Object.values(fxBalances).reduce((sum, b) => sum + b.totalPKRInvested, 0);
  const totalRealizedProfitPKR = Object.values(fxBalances).reduce((sum, b) => sum + b.totalRealizedProfitLossPKR, 0);

  return {
    currencies: fxBalances,
    totalInvestedBasisPKR,
    totalRealizedProfitPKR,
  };
}

/* ------------------------------------------------------------------ */
/* 3. Currency Trade History Tool (Purchases & Sales)                 */
/* ------------------------------------------------------------------ */
export function getCurrencyTradeHistory(
  ds: DemoDataset,
  type?: FxTransactionType,
  targetCurrency?: FxCurrency,
  periodKey?: 'today' | 'month' | 'lastMonth' | 'year'
) {
  let trades = [...(ds.fxTransactions ?? [])];

  if (type) {
    trades = trades.filter((t) => t.type === type);
  }
  if (targetCurrency) {
    trades = trades.filter((t) => t.currency === targetCurrency);
  }

  if (periodKey) {
    const range = buildRange(periodKey, ds.demoToday);
    trades = trades.filter((t) => t.date >= range.start && t.date <= range.end);
  }

  trades.sort((a, b) => b.date.localeCompare(a.date));

  return {
    trades,
    count: trades.length,
    totalForeignAmount: trades.reduce((sum, t) => sum + t.foreignAmount, 0),
    totalPKRAmount: trades.reduce((sum, t) => sum + t.totalPKR, 0),
    totalRealizedProfitPKR: trades.reduce((sum, t) => sum + (t.realizedGainLossPKR ?? 0), 0),
  };
}

/* ------------------------------------------------------------------ */
/* 4. Currency Profit Tool                                            */
/* ------------------------------------------------------------------ */
export function getCurrencyProfit(ds: DemoDataset, targetCurrency?: FxCurrency) {
  const fxBalances = computeFxBalances(ds.fxTransactions ?? []);

  if (targetCurrency) {
    const item = fxBalances[targetCurrency];
    return {
      currency: targetCurrency,
      realizedProfitPKR: item.totalRealizedProfitLossPKR,
      wacRatePKR: item.weightedAvgCostRate,
      availableBalance: item.availableBalance,
    };
  }

  const totalRealizedProfitPKR = Object.values(fxBalances).reduce((sum, b) => sum + b.totalRealizedProfitLossPKR, 0);

  return {
    totalRealizedProfitPKR,
    usdProfitPKR: fxBalances.USD.totalRealizedProfitLossPKR,
    aedProfitPKR: fxBalances.AED.totalRealizedProfitLossPKR,
    irrProfitPKR: fxBalances.IRR.totalRealizedProfitLossPKR,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Stock by Warehouse Tool                                         */
/* ------------------------------------------------------------------ */
export function getStockByWarehouse(ds: DemoDataset, warehouseQuery?: string) {
  const warehouses = ds.warehouses ?? [];
  const products = ds.inventory ?? [];

  let matchedWarehouse = warehouses[0];
  if (warehouseQuery) {
    const q = warehouseQuery.toLowerCase();
    const found = warehouses.find(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.city.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        w.id.toLowerCase().includes(q)
    );
    if (found) matchedWarehouse = found;
  }

  const stockRows = products.map((p) => {
    const loc = p.locations[matchedWarehouse.id] ?? { available: 0, reserved: 0 };
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      available: loc.available,
      reserved: loc.reserved,
      totalAtLocation: loc.available + loc.reserved,
      unitCostPKR: p.costPricePKR,
      locationValuationPKR: (loc.available + loc.reserved) * p.costPricePKR,
    };
  });

  const totalUnits = stockRows.reduce((sum, r) => sum + r.totalAtLocation, 0);
  const totalValuationPKR = stockRows.reduce((sum, r) => sum + r.locationValuationPKR, 0);

  return {
    warehouse: matchedWarehouse,
    stockRows,
    totalUnits,
    totalValuationPKR,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Product Stock & Location Distribution Tool                      */
/* ------------------------------------------------------------------ */
export function getProductStock(ds: DemoDataset, productQuery: string) {
  const products = ds.inventory ?? [];
  const warehouses = ds.warehouses ?? [];
  const q = productQuery.toLowerCase();

  const product = products.find(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
  );

  if (!product) return null;

  const totalStock = getProductTotalStock(product);
  const valuation = getProductValuation(product);
  const lowStock = isLowStock(product);

  const breakdownByLocation = Object.entries(product.locations).map(([locId, loc]) => {
    const wh = warehouses.find((w) => w.id === locId);
    return {
      warehouseId: locId,
      warehouseName: wh ? wh.name : locId,
      city: wh ? wh.city : '',
      available: loc.available,
      reserved: loc.reserved,
      total: loc.available + loc.reserved,
    };
  });

  return {
    product,
    totalStock,
    valuationPKR: valuation,
    isLowStock: lowStock,
    breakdownByLocation,
  };
}

/* ------------------------------------------------------------------ */
/* 7. Low Stock Report Tool                                           */
/* ------------------------------------------------------------------ */
export function getLowStockProducts(ds: DemoDataset) {
  const products = ds.inventory ?? [];
  const lowStockItems = products.filter((p) => isLowStock(p));

  return {
    count: lowStockItems.length,
    products: lowStockItems.map((p) => ({
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      availableStock: getProductTotalStock(p).available,
      minStockLevel: p.minStockLevel,
      shortfall: p.minStockLevel - getProductTotalStock(p).available,
      costPricePKR: p.costPricePKR,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* 8. Stock Transfers Tool                                            */
/* ------------------------------------------------------------------ */
export function getStockTransfersSummary(ds: DemoDataset) {
  const transfers = ds.stockTransfers ?? [];
  const warehouses = ds.warehouses ?? [];

  const inTransit = transfers.filter((t) => t.status === 'in_transit');
  const received = transfers.filter((t) => t.status === 'received');

  return {
    totalTransfers: transfers.length,
    inTransitCount: inTransit.length,
    receivedCount: received.length,
    transfers: transfers.map((t) => {
      const src = warehouses.find((w) => w.id === t.sourceLocationId);
      const dst = warehouses.find((w) => w.id === t.destinationLocationId);
      return {
        ...t,
        sourceName: src ? src.name : t.sourceLocationId,
        destinationName: dst ? dst.name : t.destinationLocationId,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* 9. Commercial Imports Tool                                         */
/* ------------------------------------------------------------------ */
export function getImportsSummary(ds: DemoDataset, periodKey?: 'today' | 'month' | 'lastMonth' | 'year') {
  let imports = [...(ds.imports ?? [])];

  if (periodKey) {
    const range = buildRange(periodKey, ds.demoToday);
    imports = imports.filter((i) => i.date >= range.start && i.date <= range.end);
  }

  const totalLandedCostPKR = imports.reduce((sum, i) => sum + i.totalLandedCostPKR, 0);
  const totalShippingCustomsPKR = imports.reduce(
    (sum, i) => sum + i.shippingChargesPKR + i.customsChargesPKR + i.otherExpensesPKR,
    0
  );

  return {
    count: imports.length,
    totalLandedCostPKR,
    totalShippingCustomsPKR,
    inTransitCount: imports.filter((i) => i.status === 'in_transit').length,
    receivedCount: imports.filter((i) => i.status === 'received').length,
    imports,
  };
}

/* ------------------------------------------------------------------ */
/* 10. Commercial Exports Tool                                        */
/* ------------------------------------------------------------------ */
export function getExportsSummary(ds: DemoDataset, periodKey?: 'today' | 'month' | 'lastMonth' | 'year') {
  let exports = [...(ds.exports ?? [])];

  if (periodKey) {
    const range = buildRange(periodKey, ds.demoToday);
    exports = exports.filter((e) => e.date >= range.start && e.date <= range.end);
  }

  const totalNetRealizationPKR = exports.reduce((sum, e) => sum + e.netRealizationPKR, 0);
  const totalFreightHandlingPKR = exports.reduce((sum, e) => sum + e.shippingChargesPKR + e.otherExpensesPKR, 0);

  return {
    count: exports.length,
    totalNetRealizationPKR,
    totalFreightHandlingPKR,
    dispatchedCount: exports.filter((e) => e.status === 'dispatched').length,
    deliveredCount: exports.filter((e) => e.status === 'delivered').length,
    readyCount: exports.filter((e) => e.status === 'ready_for_dispatch').length,
    exports,
  };
}

/* ------------------------------------------------------------------ */
/* 11. Receivables & Debtors Tool                                     */
/* ------------------------------------------------------------------ */
export function getReceivablesSummary(ds: DemoDataset) {
  const customers = ds.parties.filter((p) => p.type === 'customer');
  const details = customers.map((c) => {
    const bal = partyBalance(ds, c.id);
    return {
      party: c,
      balance: bal.balance,
      side: bal.side,
    };
  });

  const totalReceivables = details.reduce((sum, d) => (d.side === 'receivable' ? sum + d.balance : sum), 0);

  return {
    totalReceivables,
    customerCount: customers.length,
    customersWithBalance: details.filter((d) => d.balance > 0),
  };
}

/* ------------------------------------------------------------------ */
/* 12. Payables & Creditors Tool                                      */
/* ------------------------------------------------------------------ */
export function getPayablesSummary(ds: DemoDataset) {
  const suppliers = ds.parties.filter((p) => p.type === 'supplier');
  const details = suppliers.map((s) => {
    const bal = partyBalance(ds, s.id);
    return {
      party: s,
      balance: bal.balance,
      side: bal.side,
    };
  });

  const totalPayables = details.reduce((sum, d) => (d.side === 'payable' ? sum + d.balance : sum), 0);

  return {
    totalPayables,
    supplierCount: suppliers.length,
    suppliersWithBalance: details.filter((d) => d.balance > 0),
  };
}

/* ------------------------------------------------------------------ */
/* 13. Cash and Bank Balances Tool                                    */
/* ------------------------------------------------------------------ */
export function getCashAndBankSummary(ds: DemoDataset) {
  const cash = sumAccounts(ds, CASH_ACCOUNTS);
  const meezan = sumAccounts(ds, ['1010']);
  const hbl = sumAccounts(ds, ['1020']);
  const bankTotal = meezan + hbl;

  return {
    cashInHand: cash,
    meezanBank: meezan,
    hblBank: hbl,
    bankTotal,
    liquidTotal: cash + bankTotal,
  };
}

/* ------------------------------------------------------------------ */
/* 14. Party Ledger Tool                                              */
/* ------------------------------------------------------------------ */
export function getPartyLedgerSummary(ds: DemoDataset, party: Party) {
  const rows = partyLedger(ds, party.id).slice(-10);
  const bal = partyBalance(ds, party.id);

  return {
    party,
    balance: bal.balance,
    side: bal.side,
    totalDebited: bal.debit,
    totalCredited: bal.credit,
    recentRows: rows,
  };
}

/* ------------------------------------------------------------------ */
/* 15. Financial Statements Tool (P&L & Trial Balance)                */
/* ------------------------------------------------------------------ */
export function getFinancialStatementsSummary(ds: DemoDataset, periodKey: 'today' | 'month' | 'lastMonth' | 'year' = 'year') {
  const range = buildRange(periodKey, ds.demoToday);
  const pnl = profitAndLoss(ds, range.start, range.end);
  const tb = trialBalance(ds, ds.demoToday);
  const bs = balanceSheet(ds, ds.demoToday);

  return {
    pnl,
    trialBalance: {
      totalDebit: tb.totalDebit,
      totalCredit: tb.totalCredit,
      balanced: tb.balanced,
      difference: tb.difference,
    },
    balanceSheet: {
      totalAssets: bs.totalAssets,
      totalLiabilities: bs.totalLiabilities,
      totalEquity: bs.totalEquity,
      balanced: bs.balanced,
      difference: bs.difference,
    },
  };
}
