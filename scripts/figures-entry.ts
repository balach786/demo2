/**
 * QA figures bundle — compiles the demo's own accounting engine so the browser
 * audit can compare what the UI shows against what the ledger actually says.
 * Built with: vite build --ssr scripts/figures-entry.ts --outDir .qa
 */
import { buildDemoDataset } from '../src/demo/seed';
import {
  balanceSheet,
  buildRange,
  cashFlow,
  dashboardSummary,
  naturalBalance,
  partyBalance,
  profitAndLoss,
  sumAccounts,
  trialBalance,
  BANK_ACCOUNTS,
  CASH_ACCOUNTS,
} from '../src/demo/accounting';
import { runAiCommand } from '../src/ai/engine';
import type { DemoDataset } from '../src/demo/types';

/** Expected dashboard figures computed from a pristine seed for a period preset. */
export function expected(preset: string) {
  const ds = buildDemoDataset();
  const range = buildRange(preset as never, ds.demoToday);
  const s = dashboardSummary(ds, range);
  return {
    demoToday: ds.demoToday,
    range: { start: range.start, end: range.end, label: range.label },
    cash: s.cashBalance,
    bank: s.bankBalance,
    sales: s.totalSales,
    purchases: s.totalPurchases,
    expenses: s.totalExpenses,
    netProfit: s.netProfit,
    receivable: s.accountsReceivable,
    payable: s.accountsPayable,
    inventory: s.inventoryValue,
    liquid: s.cashBalance + s.bankBalance,
    grossProfit: s.grossProfit,
    months: s.monthly.map((m) => ({ label: m.label, revenue: m.revenue, purchases: m.purchases, profit: m.profit })),
    entryCount: ds.entries.length,
  };
}

/** Full integrity analysis of any persisted demo state (as saved in localStorage). */
export function analyze(ds: DemoDataset) {
  const tb = trialBalance(ds, ds.demoToday);
  const bs = balanceSheet(ds, ds.demoToday);
  const fy = buildRange('year', ds.demoToday);
  const cf = cashFlow(ds, fy.start, fy.end);
  const pl = profitAndLoss(ds, fy.start, fy.end);

  const unbalanced = ds.entries.filter((e) => {
    const dr = e.lines.reduce((s, l) => s + l.debit, 0);
    const cr = e.lines.reduce((s, l) => s + l.credit, 0);
    return Math.round(dr) !== Math.round(cr);
  }).map((e) => e.reference);

  const negativeLiquid: string[] = [];
  for (const acc of [...CASH_ACCOUNTS, ...BANK_ACCOUNTS]) {
    const bal = naturalBalance(ds, acc, { end: ds.demoToday });
    if (bal < 0) negativeLiquid.push(`${acc}=${bal}`);
  }

  return {
    entryCount: ds.entries.length,
    lineCount: ds.entries.reduce((s, e) => s + e.lines.length, 0),
    unbalancedEntries: unbalanced,
    trialBalance: { debit: tb.totalDebit, credit: tb.totalCredit, balanced: tb.balanced, difference: tb.difference },
    balanceSheet: {
      assets: bs.totalAssets,
      liabilities: bs.totalLiabilities,
      equity: bs.totalEquity,
      balanced: bs.balanced,
      difference: bs.difference,
    },
    cashFlow: { opening: cf.openingCash, net: cf.netChange, closing: cf.closingCash, reconciles: cf.reconciles },
    pl: { revenue: pl.totalRevenue, expenses: pl.totalOperatingExpenses, cogs: pl.totalCostOfSales, net: pl.netProfit },
    liquid: {
      cash: naturalBalance(ds, '1000', { end: ds.demoToday }),
      hbl: naturalBalance(ds, '1010', { end: ds.demoToday }),
      meezan: naturalBalance(ds, '1020', { end: ds.demoToday }),
      total: sumAccounts(ds, [...CASH_ACCOUNTS, ...BANK_ACCOUNTS], { end: ds.demoToday }),
      negative: negativeLiquid,
    },
    parties: ds.parties.map((p) => ({ id: p.id, name: p.name, ...partyBalance(ds, p.id) })),
    accounts: Object.fromEntries(ds.accounts.map((a) => [a.id, naturalBalance(ds, a.id, { end: ds.demoToday })])),
    approvals: ds.approvals.map((a) => ({ reference: a.reference, status: a.status, amount: a.draft.amount })),
  };
}

/** Expected AI answer for a command, computed on a pristine dataset. */
export function ai(command: string) {
  const ds = buildDemoDataset();
  const r = runAiCommand(command, ds);
  return {
    intent: r.intent,
    intentLabel: r.intentLabel,
    language: r.language,
    text: r.text,
    module: r.module,
    periodLabel: r.periodLabel ?? '',
    metrics: (r.metrics ?? []).map((m) => m.value),
    tableRows: (r.table?.rows ?? []).map((row) => row.join(' ')),
    links: (r.links ?? []).map((l) => l.label),
    hasDraft: !!r.draft,
    draftAmount: r.draft?.draft.amount,
    draftParty: r.draft?.draft.partyId,
    linkCount: r.links?.length ?? 0,
  };
}

/** Reference numbers used for data cross-checks. */
export function reference() {
  const ds = buildDemoDataset();
  return {
    demoToday: ds.demoToday,
    entryCount: ds.entries.length,
    partyCount: ds.parties.length,
    accountCount: ds.accounts.length,
    customerCount: ds.parties.filter((p) => p.type === 'customer').length,
    supplierCount: ds.parties.filter((p) => p.type === 'supplier').length,
    todaySales: naturalBalance(ds, '4000', { start: ds.demoToday, end: ds.demoToday }),
    ahmedBalance: partyBalance(ds, 'CUS-001').balance,
    aliBalance: partyBalance(ds, 'SUP-002').balance,
    abcBalance: partyBalance(ds, 'SUP-001').balance,
    topCustomerSales: (() => {
      const fy = buildRange('year', ds.demoToday);
      const totals = new Map<string, number>();
      for (const e of ds.entries) {
        if (e.type !== 'sales' || e.date < fy.start || e.date > fy.end) continue;
        const pid = e.lines.find((l) => l.partyId)?.partyId;
        if (!pid) continue;
        totals.set(pid, (totals.get(pid) ?? 0) + e.lines.filter((l) => l.accountId === '4000').reduce((s, l) => s + l.credit, 0));
      }
      return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ id, value: v }));
    })(),
  };
}
