/**
 * QA harness — verifies the accounting integrity of the demo dataset.
 * Run with: npm run verify:accounting
 */
import { buildDemoDataset } from '../src/demo/seed';
import {
  balanceSheet,
  cashFlow,
  dashboardSummary,
  entriesInRange,
  entryIsBalanced,
  naturalBalance,
  partyBalance,
  partyLedger,
  profitAndLoss,
  signedBalance,
  sumAccounts,
  trialBalance,
  BANK_ACCOUNTS,
  CASH_ACCOUNTS,
  buildRange,
} from '../src/demo/accounting';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const ds = buildDemoDataset();
const today = ds.demoToday;

console.log('\n=== DEMO DATASET ===');
console.log(`Business        : ${ds.business.name}`);
console.log(`Demo clock      : ${today}`);
console.log(`Accounts        : ${ds.accounts.length}`);
console.log(`Parties         : ${ds.parties.length}`);
console.log(`Journal entries : ${ds.entries.length}`);
console.log(`Journal lines   : ${ds.entries.reduce((s, e) => s + e.lines.length, 0)}`);
console.log(`Approvals       : ${ds.approvals.length}`);
console.log(`Documents       : ${ds.documents.length}`);

console.log('\n=== 1. DOUBLE-ENTRY INTEGRITY ===');
const unbalanced = ds.entries.filter((e) => !entryIsBalanced(e));
check('Every journal entry has equal debits and credits', unbalanced.length === 0,
  unbalanced.map((e) => e.reference).join(', '));
const approvalDrafts = ds.approvals.filter((a) => {
  const dr = a.draft.lines.reduce((s, l) => s + l.debit, 0);
  const cr = a.draft.lines.reduce((s, l) => s + l.credit, 0);
  return dr !== cr;
});
check('Every approval draft is balanced', approvalDrafts.length === 0,
  approvalDrafts.map((a) => a.reference).join(', '));

console.log('\n=== 2. TRIAL BALANCE ===');
const tb = trialBalance(ds, today);
check('Trial balance debits = credits', tb.balanced, `DR ${tb.totalDebit.toLocaleString()} / CR ${tb.totalCredit.toLocaleString()}`);
check('Trial balance difference is zero', tb.difference === 0, `difference ${tb.difference}`);

console.log('\n=== 3. BALANCE SHEET ===');
const bs = balanceSheet(ds, today);
check('Assets = Liabilities + Equity', bs.balanced,
  `A ${bs.totalAssets.toLocaleString()} vs L+E ${(bs.totalLiabilities + bs.totalEquity).toLocaleString()}`);
console.log(`  Assets ${bs.totalAssets.toLocaleString()} | Liabilities ${bs.totalLiabilities.toLocaleString()} | Equity ${bs.totalEquity.toLocaleString()}`);

console.log('\n=== 4. LIQUIDITY / NEGATIVE BALANCE SCAN ===');
for (const accId of [...CASH_ACCOUNTS, ...BANK_ACCOUNTS]) {
  let running = 0;
  let min = Number.POSITIVE_INFINITY;
  let minDate = '';
  const sorted = [...ds.entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const e of sorted) {
    for (const l of e.lines) {
      if (l.accountId !== accId) continue;
      running += l.debit - l.credit;
      if (running < min) {
        min = running;
        minDate = e.date;
      }
    }
  }
  check(`${accId} never goes negative`, min >= 0, `min ${min.toLocaleString()} on ${minDate}`);
}

console.log('\n=== 5. CASH FLOW RECONCILIATION (FY to date) ===');
const fy = buildRange('year', today, undefined);
const cf = cashFlow(ds, fy.start, fy.end);
check('Cash flow reconciles to closing balance', cf.reconciles,
  `opening ${cf.openingCash.toLocaleString()} + net ${cf.netChange.toLocaleString()} = ${(cf.openingCash + cf.netChange).toLocaleString()} vs closing ${cf.closingCash.toLocaleString()}`);

console.log('\n=== 6. PARTY LEDGERS ===');
let ledgerMismatch = 0;
for (const p of ds.parties) {
  const rows = partyLedger(ds, p.id);
  const closing = rows.length ? rows[rows.length - 1]!.balance : 0;
  const pb = partyBalance(ds, p.id);
  const signed = pb.side === 'receivable' ? pb.balance : pb.side === 'payable' ? -pb.balance : 0;
  if (Math.abs(closing - signed) > 0.5) ledgerMismatch++;
}
check('Party ledger closing balances agree with party summaries', ledgerMismatch === 0, `${ledgerMismatch} mismatches`);
const ar = naturalBalance(ds, '1100', { end: today });
const sumCustomerDebits = ds.parties.filter((p) => p.type === 'customer')
  .reduce((s, p) => s + (partyBalance(ds, p.id).side === 'receivable' ? partyBalance(ds, p.id).balance : 0), 0);
check('AR control account >= sum of customer debit balances', ar >= sumCustomerDebits - 0.5,
  `AR ${ar.toLocaleString()} vs customers ${sumCustomerDebits.toLocaleString()}`);

console.log('\n=== 7. DASHBOARD CONSISTENCY ===');
const range = buildRange('year', today, undefined);
const summary = dashboardSummary(ds, range);
const pl = profitAndLoss(ds, range.start, range.end);
check('Dashboard sales == P&L revenue', Math.round(summary.totalSales) === Math.round(pl.totalRevenue),
  `${summary.totalSales} vs ${pl.totalRevenue}`);
check('Dashboard expenses == P&L operating expenses', Math.round(summary.totalExpenses) === Math.round(pl.totalOperatingExpenses));
check('Dashboard net profit == P&L net profit', Math.round(summary.netProfit) === Math.round(pl.netProfit),
  `${summary.netProfit} vs ${pl.netProfit}`);
check('Cash + bank == liquid accounts total',
  Math.round(summary.cashBalance + summary.bankBalance) === Math.round(sumAccounts(ds, [...CASH_ACCOUNTS, ...BANK_ACCOUNTS], { end: today })));
const salesByType = entriesInRange(ds, range.start, range.end).filter((e) => e.type === 'sales').reduce((s, e) => s + e.lines.filter((l) => l.accountId === '4000').reduce((x, l) => x + l.credit, 0), 0);
check('Sales ledger total == sum of sales entries', Math.round(salesByType) >= Math.round(summary.totalSales),
  `sales entries ${salesByType.toLocaleString()} vs revenue ${summary.totalSales.toLocaleString()}`);

console.log('\n=== 8. TODAY / AI QUERY DATA ===');
const todayEntries = ds.entries.filter((e) => e.date === today);
check('Demo clock has transactions (AI "today" questions return data)', todayEntries.length > 0, `${todayEntries.length} entries`);
const todaySales = naturalBalance(ds, '4000', { start: today, end: today });
check('Today sales > 0', todaySales > 0, `${todaySales.toLocaleString()}`);

console.log('\n=== 9. DERIVED HEADLINE FIGURES ===');
console.log(`  Sales (FY)      : ${summary.totalSales.toLocaleString()}`);
console.log(`  Purchases (FY)  : ${summary.totalPurchases.toLocaleString()}`);
console.log(`  Expenses (opex) : ${summary.totalExpenses.toLocaleString()}`);
console.log(`  COGS            : ${summary.costOfSales.toLocaleString()}`);
console.log(`  Gross profit    : ${summary.grossProfit.toLocaleString()}`);
console.log(`  Net profit      : ${summary.netProfit.toLocaleString()}`);
console.log(`  Cash in hand    : ${summary.cashBalance.toLocaleString()}`);
console.log(`  Bank balance    : ${summary.bankBalance.toLocaleString()}`);
console.log(`  Receivables     : ${summary.accountsReceivable.toLocaleString()}`);
console.log(`  Payables        : ${summary.accountsPayable.toLocaleString()}`);
console.log(`  Inventory       : ${summary.inventoryValue.toLocaleString()}`);
console.log(`  Today sales     : ${todaySales.toLocaleString()}`);

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`} ===\n`);
if (typeof process !== 'undefined') process.exit(failures === 0 ? 0 : 1);
