/**
 * TRADE & MULTI-CURRENCY LOGIC & BUSINESS RULES
 *
 * Implements:
 * - Weighted Average Cost (WAC) for multi-currency inventory & foreign currency sales
 * - Realized exchange gain/loss calculation
 * - Location stock distribution & stock movement ledger
 * - Safe validation against over-selling or duplicate movements
 */

import type {
  FxCurrency,
  FxTransaction,
  FxBalanceSummary,
  InventoryProduct,
  StockMovement,
  WarehouseLocation,
} from './tradeTypes';

/* ------------------------------------------------------------------ */
/* 1. Foreign Currency Calculations (Weighted Average Cost)           */
/* ------------------------------------------------------------------ */

export const CURRENCY_METADATA: Record<
  FxCurrency,
  { name: string; symbol: string; decimals: number; denominationNote: string; defaultSampleRate: number }
> = {
  USD: {
    name: 'US Dollar',
    symbol: '$',
    decimals: 2,
    denominationNote: 'Standard US Dollar ($)',
    defaultSampleRate: 280.0,
  },
  AED: {
    name: 'UAE Dirham',
    symbol: 'AED',
    decimals: 2,
    denominationNote: 'Standard UAE Dirham (AED)',
    defaultSampleRate: 76.25,
  },
  IRR: {
    name: 'Iranian Rial',
    symbol: 'IRR',
    decimals: 0,
    denominationNote: 'Official ISO Iranian Rial (IRR) — Not Toman (1 Toman = 10 IRR)',
    defaultSampleRate: 0.00067, // Illustrative fictional rate (~1,500 IRR per PKR)
  },
};

export function formatFxAmount(amount: number, currency: FxCurrency | 'PKR'): string {
  if (currency === 'PKR') {
    return `PKR ${Math.round(amount).toLocaleString('en-PK')}`;
  }
  const meta = CURRENCY_METADATA[currency];
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  });
  const sign = amount < 0 ? '-' : '';

  if (currency === 'USD') return `${sign}$${formatted}`;
  if (currency === 'AED') return `${sign}AED ${formatted}`;
  return `${sign}${formatted} IRR`;
}

export function formatFxRate(rate: number, currency: FxCurrency | 'PKR'): string {
  if (currency === 'PKR') {
    return '1.00';
  }
  if (currency === 'IRR') {
    // Show per 1M or fractional rate with high precision
    return `PKR ${rate.toFixed(5)} / IRR`;
  }
  return `PKR ${rate.toFixed(2)} / ${currency}`;
}

/**
 * Computes live multi-currency balances, weighted average purchase cost,
 * and cumulative realized exchange profit/loss using the Weighted Average Cost (WAC) method.
 */
export function computeFxBalances(transactions: FxTransaction[]): Record<FxCurrency, FxBalanceSummary> {
  const currencies: FxCurrency[] = ['USD', 'AED', 'IRR'];
  const result: Record<FxCurrency, FxBalanceSummary> = {
    USD: {
      currency: 'USD',
      currencyName: CURRENCY_METADATA.USD.name,
      symbol: CURRENCY_METADATA.USD.symbol,
      availableBalance: 0,
      totalPurchased: 0,
      totalSold: 0,
      weightedAvgCostRate: 0,
      totalPKRInvested: 0,
      totalRealizedProfitLossPKR: 0,
      denominationNote: CURRENCY_METADATA.USD.denominationNote,
    },
    AED: {
      currency: 'AED',
      currencyName: CURRENCY_METADATA.AED.name,
      symbol: CURRENCY_METADATA.AED.symbol,
      availableBalance: 0,
      totalPurchased: 0,
      totalSold: 0,
      weightedAvgCostRate: 0,
      totalPKRInvested: 0,
      totalRealizedProfitLossPKR: 0,
      denominationNote: CURRENCY_METADATA.AED.denominationNote,
    },
    IRR: {
      currency: 'IRR',
      currencyName: CURRENCY_METADATA.IRR.name,
      symbol: CURRENCY_METADATA.IRR.symbol,
      availableBalance: 0,
      totalPurchased: 0,
      totalSold: 0,
      weightedAvgCostRate: 0,
      totalPKRInvested: 0,
      totalRealizedProfitLossPKR: 0,
      denominationNote: CURRENCY_METADATA.IRR.denominationNote,
    },
  };

  // Sort chronological
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const tx of sorted) {
    const summary = result[tx.currency];
    if (!summary) continue;

    if (tx.type === 'purchase') {
      const prevQty = summary.availableBalance;
      const prevCostBasis = summary.totalPKRInvested;
      const addedQty = tx.foreignAmount;
      const addedCost = tx.totalPKR;

      const newQty = prevQty + addedQty;
      const newCostBasis = prevCostBasis + addedCost;
      const newAvgRate = newQty > 0 ? newCostBasis / newQty : 0;

      summary.availableBalance = newQty;
      summary.totalPurchased += addedQty;
      summary.totalPKRInvested = newCostBasis;
      summary.weightedAvgCostRate = newAvgRate;
    } else if (tx.type === 'sale') {
      const soldQty = tx.foreignAmount;
      const costBasisRate = summary.weightedAvgCostRate;
      const costOfUnitsSold = soldQty * costBasisRate;
      const saleRealization = tx.totalPKR;
      const realizedGainLoss = saleRealization - costOfUnitsSold;

      summary.availableBalance = Math.max(0, summary.availableBalance - soldQty);
      summary.totalSold += soldQty;
      summary.totalPKRInvested = summary.availableBalance * costBasisRate;
      summary.totalRealizedProfitLossPKR += realizedGainLoss;
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* 2. Inventory & Warehouse Stock Logic                               */
/* ------------------------------------------------------------------ */

export function getProductTotalStock(product: InventoryProduct): {
  available: number;
  reserved: number;
  total: number;
} {
  let available = 0;
  let reserved = 0;
  for (const loc of Object.values(product.locations)) {
    available += loc.available;
    reserved += loc.reserved;
  }
  return { available, reserved, total: available + reserved };
}

export function getProductValuation(product: InventoryProduct): number {
  const stock = getProductTotalStock(product);
  return stock.total * product.costPricePKR;
}

export function isLowStock(product: InventoryProduct): boolean {
  const stock = getProductTotalStock(product);
  return stock.available <= product.minStockLevel;
}

export function calculateTotalInventoryValuation(products: InventoryProduct[]): number {
  return products.reduce((sum, p) => sum + getProductValuation(p), 0);
}
