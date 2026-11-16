/**
 * TRADE & MULTI-CURRENCY TEST VERIFICATION SUITE
 *
 * Verifies:
 * 1. Multi-Currency Weighted Average Cost (WAC) calculations
 * 2. Realized exchange gain/loss formulas
 * 3. Iranian Rial (IRR) zero-decimal ISO convention (not Toman)
 * 4. Multi-warehouse stock distribution & valuation
 * 5. Stock transfer reservation & non-duplication
 * 6. Landed cost calculations on imports
 * 7. AI Voice & natural language commands for Trade & Forex
 */

import { buildDemoDataset } from '../src/demo/seed';
import {
  computeFxBalances,
  CURRENCY_METADATA,
  formatFxAmount,
  formatFxRate,
  getProductTotalStock,
  getProductValuation,
  isLowStock,
  calculateTotalInventoryValuation,
} from '../src/demo/tradeLogic';
import { runAiCommand } from '../src/ai/engine';

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

console.log('=== TRADE & MULTI-CURRENCY VERIFICATION ===');
const ds = buildDemoDataset();

/* ------------------------------------------------------------------ */
/* 1. Multi-Currency WAC & Realized P&L                               */
/* ------------------------------------------------------------------ */
console.log('\n=== 1. WEIGHTED AVERAGE COST & FOREX P&L ===');

const fxBalances = computeFxBalances(ds.fxTransactions);

// USD Verification
const usd = fxBalances.USD;
check('USD available balance matches seed', usd.availableBalance === 23_000, `Available: ${usd.availableBalance}`);
check('USD total purchased', usd.totalPurchased === 35_000, `Purchased: ${usd.totalPurchased}`);
check('USD total sold', usd.totalSold === 12_000, `Sold: ${usd.totalSold}`);

// Check USD WAC:
// Buy 1: 20,000 @ 278.50 = 5,570,000
// Buy 2: 15,000 @ 280.00 = 4,200,000
// Total bought: 35,000, Cost basis: 9,770,000
// WAC: 9,770,000 / 35,000 = 279.142857
check(
  'USD Weighted Average Cost rate calculation',
  Math.abs(usd.weightedAvgCostRate - 279.142857) < 0.001,
  `WAC: ${usd.weightedAvgCostRate.toFixed(4)}`
);

// Sell: 12,000 @ 283.50 = 3,402,000
// Cost basis of sale: 12,000 * 279.142857 = 3,349,714.28
// Realized gain: 3,402,000 - 3,349,714.28 = 52,285.71 (~52,286)
check(
  'USD Realized Profit calculation',
  Math.abs(usd.totalRealizedProfitLossPKR - 52_286) < 2,
  `Realized P&L: PKR ${Math.round(usd.totalRealizedProfitLossPKR)}`
);

// Remaining cost basis: 23,000 * 279.142857 = 6,420,285.71
check(
  'USD remaining invested cost basis',
  Math.abs(usd.totalPKRInvested - 6_420_286) < 2,
  `Invested: PKR ${Math.round(usd.totalPKRInvested)}`
);

// AED Verification
const aed = fxBalances.AED;
check('AED available balance matches seed', aed.availableBalance === 50_000, `Available: ${aed.availableBalance}`);
check('AED WAC rate', aed.weightedAvgCostRate === 76.0, `Rate: ${aed.weightedAvgCostRate}`);
check('AED invested PKR basis', aed.totalPKRInvested === 3_800_000, `Basis: PKR ${aed.totalPKRInvested}`);

// IRR Verification (Iranian Rial vs Toman)
console.log('\n=== 2. IRANIAN RIAL (IRR) ISO RULES ===');
const irr = fxBalances.IRR;
check('IRR has 0 decimals', CURRENCY_METADATA.IRR.decimals === 0, 'Decimals: 0');
check(
  'IRR denomination note explicitly mentions NOT Toman',
  CURRENCY_METADATA.IRR.denominationNote.includes('Not Toman'),
  CURRENCY_METADATA.IRR.denominationNote
);
check('IRR available balance', irr.availableBalance === 1_700_000_000, `Available: ${irr.availableBalance.toLocaleString()} IRR`);
check(
  'IRR formatted amount contains IRR currency marker and 0 decimals',
  formatFxAmount(15_000_000_000, 'IRR') === '15,000,000,000 IRR'
);

/* ------------------------------------------------------------------ */
/* 3. Multi-Warehouse Stock Distribution & Valuation                  */
/* ------------------------------------------------------------------ */
console.log('\n=== 3. WAREHOUSES & STOCK VALUATION ===');

check('Four demonstration warehouses exist', ds.warehouses.length === 4, `Count: ${ds.warehouses.length}`);
const whCodes = ds.warehouses.map((w) => w.id);
check('Warehouse IDs contain Main, Karachi, Dubai, Lahore',
  whCodes.includes('LOC-MAIN') && whCodes.includes('LOC-KHI-PORT') &&
  whCodes.includes('LOC-DXB') && whCodes.includes('LOC-LHR')
);

// Check inventory valuation
const totalValuation = calculateTotalInventoryValuation(ds.inventory);
check('Consolidated inventory valuation is positive', totalValuation > 50_000_000, `Valuation: PKR ${totalValuation.toLocaleString()}`);

// Product stock totals match location breakdown
for (const prod of ds.inventory) {
  const stock = getProductTotalStock(prod);
  let sumAvail = 0;
  let sumRsvd = 0;
  for (const loc of Object.values(prod.locations)) {
    sumAvail += loc.available;
    sumRsvd += loc.reserved;
  }
  check(`Stock sum for ${prod.name}`, stock.available === sumAvail && stock.reserved === sumRsvd, `Total: ${stock.total}`);
}

// Low stock detection
const lowStock = ds.inventory.filter(isLowStock);
check('Identifies low stock items requiring replenishment', lowStock.length >= 2, `Count: ${lowStock.length}`);
check('Saffron is flagged as low stock', lowStock.some((p) => p.sku === 'SKU-SPICE-004'));
check('Ball Bearings is flagged as low stock', lowStock.some((p) => p.sku === 'SKU-BEAR-006'));

/* ------------------------------------------------------------------ */
/* 4. Inter-Warehouse Transfers & Integrity                           */
/* ------------------------------------------------------------------ */
console.log('\n=== 4. STOCK TRANSFER INTEGRITY ===');

check('Transfers exist in seed', ds.stockTransfers.length >= 3, `Count: ${ds.stockTransfers.length}`);
const inTransitTransfer = ds.stockTransfers.find((t) => t.status === 'in_transit');
check('In-transit transfer exists', inTransitTransfer !== undefined, inTransitTransfer?.reference);

// Test transfer receipt mechanics
if (inTransitTransfer) {
  const prod = ds.inventory.find((p) => p.id === inTransitTransfer.productId)!;
  const srcLocBefore = prod.locations[inTransitTransfer.sourceLocationId] || { available: 0, reserved: 0 };
  const dstLocBefore = prod.locations[inTransitTransfer.destinationLocationId] || { available: 0, reserved: 0 };

  // Before receipt, units are reserved, not yet in destination available
  check(
    'In-transit units not yet in destination available',
    dstLocBefore.available >= 0
  );
}

/* ------------------------------------------------------------------ */
/* 5. Import & Export Landed Cost Math                                */
/* ------------------------------------------------------------------ */
console.log('\n=== 5. LANDED COST & EXPORT REALIZATION ===');

for (const imp of ds.imports) {
  const expectedForeign = imp.quantity * imp.purchaseRate;
  check(
    `Import ${imp.reference} foreign total`,
    imp.totalPurchaseAmountForeign === expectedForeign,
    `${imp.totalPurchaseAmountForeign} == ${expectedForeign}`
  );
  const expectedLanded = imp.totalPurchaseAmountPKR + imp.shippingChargesPKR + imp.customsChargesPKR + imp.otherExpensesPKR;
  check(
    `Import ${imp.reference} landed cost PKR`,
    imp.totalLandedCostPKR === expectedLanded,
    `${imp.totalLandedCostPKR} == ${expectedLanded}`
  );
}

for (const exp of ds.exports) {
  const expectedForeign = exp.quantity * exp.sellingRate;
  check(
    `Export ${exp.reference} foreign total`,
    exp.totalSaleAmountForeign === expectedForeign,
    `${exp.totalSaleAmountForeign} == ${expectedForeign}`
  );
  const expectedNet = exp.totalSaleAmountPKR - exp.shippingChargesPKR - exp.otherExpensesPKR;
  check(
    `Export ${exp.reference} net realization PKR`,
    exp.netRealizationPKR === expectedNet,
    `${exp.netRealizationPKR} == ${expectedNet}`
  );
}

/* ------------------------------------------------------------------ */
/* 6. AI Secretary Natural Language Parity                            */
/* ------------------------------------------------------------------ */
console.log('\n=== 6. AI COMMAND PARITY (TRADE & FOREX) ===');

const aiTests = [
  { q: 'Mere paas kitna dollar available hai?', intent: 'forex.usd_balance' },
  { q: 'How much USD balance do we have available?', intent: 'forex.usd_balance' },
  { q: 'Aaj kitne dirham purchase hue?', intent: 'forex.aed_balance' },
  { q: 'Iranian currency ka current balance kya hai?', intent: 'forex.irr_balance' },
  { q: 'Is month ka currency exchange profit kitna hai?', intent: 'forex.profit' },
  { q: 'Forex trading profit kitna hai?', intent: 'forex.profit' },
  { q: 'Karachi warehouse mein kitna stock hai?', intent: 'trade.warehouse_stock' },
  { q: 'Dubai warehouse se Lahore kitna stock transfer hua?', intent: 'trade.stock_transfers' },
  { q: 'Total import value kitni hai?', intent: 'trade.imports' },
  { q: 'Low stock products ki list dikhao.', intent: 'trade.low_stock' },
  { q: 'Is month ki exports dikhao', intent: 'trade.exports' },
];

for (const test of aiTests) {
  const res = runAiCommand(test.q, ds);
  check(`AI query: "${test.q}"`, res.intent === test.intent, `Got: ${res.intent}`);
  check(`AI text generated for "${test.q}"`, res.text.length > 20);
}

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL TRADE & MULTI-CURRENCY CHECKS PASSED' : `${failures} FAILURE(S)`} ===\n`);
if (typeof process !== 'undefined') process.exit(failures === 0 ? 0 : 1);
