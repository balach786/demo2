/**
 * ACCOUNTING ENGINE (read-only derivations)
 *
 * Every figure in the demo is computed from journal lines. There are no
 * per-screen hardcoded totals, therefore the dashboard, ledgers, reports and
 * the AI Secretary can never disagree with each other.
 */
import type {
  Account,
  DemoDataset,
  JournalEntry,
  Party,
  TransactionType,
} from './types';
import { endOfMonth, monthLabel, startOfMonth } from '../lib/format';

export interface DateRange {
  start: string;
  end: string;
  label: string;
  preset: RangePreset;
}

export type RangePreset = 'today' | 'week' | 'month' | 'year' | 'lastMonth' | 'custom';

export const CASH_ACCOUNTS = ['1000'];
export const BANK_ACCOUNTS = ['1010', '1020'];
export const LIQUID_ACCOUNTS = [...CASH_ACCOUNTS, ...BANK_ACCOUNTS];

export const TYPE_LABELS: Record<TransactionType, string> = {
  opening: 'Opening Balance',
  sales: 'Sale',
  purchase: 'Purchase',
  receipt: 'Money Received',
  payment: 'Money Paid',
  expense: 'Expense',
  deposit: 'Cash Deposit',
  withdrawal: 'Cash Withdrawal',
  transfer: 'Bank Transfer',
};

export function accountById(ds: DemoDataset, id: string): Account | undefined {
  return ds.accounts.find((a) => a.id === id);
}

export function accountName(ds: DemoDataset, id: string): string {
  return accountById(ds, id)?.name ?? id;
}

export function partyById(ds: DemoDataset, id?: string): Party | undefined {
  return id ? ds.parties.find((p) => p.id === id) : undefined;
}

export function partyName(ds: DemoDataset, id?: string): string {
  return partyById(ds, id)?.name ?? '—';
}

/** Total value of an entry (equals both the debit and credit side). */
export function entryAmount(entry: JournalEntry): number {
  return entry.lines.reduce((sum, l) => sum + l.debit, 0);
}

export function entryIsBalanced(entry: JournalEntry): boolean {
  const dr = entry.lines.reduce((s, l) => s + l.debit, 0);
  const cr = entry.lines.reduce((s, l) => s + l.credit, 0);
  return Math.round(dr) === Math.round(cr);
}

export function entriesInRange(ds: DemoDataset, start: string, end: string): JournalEntry[] {
  return ds.entries.filter((e) => e.date >= start && e.date <= end);
}

/** Signed balance (debit positive) for an account, optionally restricted to a period. */
export function signedBalance(
  ds: DemoDataset,
  accountId: string,
  opts: { start?: string; end?: string } = {},
): number {
  let total = 0;
  for (const entry of ds.entries) {
    if (opts.start && entry.date < opts.start) continue;
    if (opts.end && entry.date > opts.end) continue;
    for (const l of entry.lines) {
      if (l.accountId === accountId) total += l.debit - l.credit;
    }
  }
  return total;
}

/** Balance expressed on the account's natural side (asset/expense: debit, else credit). */
export function naturalBalance(
  ds: DemoDataset,
  accountId: string,
  opts: { start?: string; end?: string } = {},
): number {
  const acc = accountById(ds, accountId);
  const signed = signedBalance(ds, accountId, opts);
  return acc?.normalBalance === 'credit' ? -signed : signed;
}

/** Movement in the natural direction inside a period (income/expense style). */
export function periodMovement(ds: DemoDataset, accountId: string, start: string, end: string): number {
  return naturalBalance(ds, accountId, { start, end });
}

export function sumAccounts(
  ds: DemoDataset,
  accountIds: string[],
  opts: { start?: string; end?: string } = {},
): number {
  return accountIds.reduce((s, id) => s + naturalBalance(ds, id, opts), 0);
}

export function accountsByType(ds: DemoDataset, type: Account['type']): Account[] {
  return ds.accounts.filter((a) => a.type === type);
}

/* ------------------------------------------------------------------ */
/* ledgers                                                             */
/* ------------------------------------------------------------------ */

export interface LedgerRow {
  entryId: string;
  reference: string;
  date: string;
  description: string;
  type: TransactionType;
  partyId?: string;
  partyName?: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface PartyBalance {
  partyId: string;
  debit: number;
  credit: number;
  balance: number;
  side: 'receivable' | 'payable' | 'settled';
}

export function partyLedger(ds: DemoDataset, partyId: string, start?: string, end?: string): LedgerRow[] {
  const rows: (LedgerRow & { sortKey: string })[] = [];
  let running = 0;
  const sorted = [...ds.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  for (const entry of sorted) {
    for (const l of entry.lines) {
      if (l.partyId !== partyId) continue;
      running += l.debit - l.credit;
      if (start && entry.date < start) continue;
      if (end && entry.date > end) continue;
      rows.push({
        entryId: entry.id,
        reference: entry.reference,
        date: entry.date,
        description: entry.description,
        type: entry.type,
        partyId,
        partyName: partyName(ds, partyId),
        debit: l.debit,
        credit: l.credit,
        balance: running,
        sortKey: `${entry.date}-${entry.id}`,
      });
    }
  }
  return rows;
}

export function partyBalance(ds: DemoDataset, partyId: string, asOf?: string): PartyBalance {
  let debit = 0;
  let credit = 0;
  for (const entry of ds.entries) {
    if (asOf && entry.date > asOf) continue;
    for (const l of entry.lines) {
      if (l.partyId !== partyId) continue;
      debit += l.debit;
      credit += l.credit;
    }
  }
  const net = debit - credit;
  return {
    partyId,
    debit,
    credit,
    balance: Math.abs(net),
    side: net > 0 ? 'receivable' : net < 0 ? 'payable' : 'settled',
  };
}

export function accountLedger(ds: DemoDataset, accountId: string, start?: string, end?: string): LedgerRow[] {
  const acc = accountById(ds, accountId);
  const sign = acc?.normalBalance === 'credit' ? -1 : 1;
  const sorted = [...ds.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
  const rows: LedgerRow[] = [];
  let running = 0;
  for (const entry of sorted) {
    for (const l of entry.lines) {
      if (l.accountId !== accountId) continue;
      running += sign * (l.debit - l.credit);
      if (start && entry.date < start) continue;
      if (end && entry.date > end) continue;
      rows.push({
        entryId: entry.id,
        reference: entry.reference,
        date: entry.date,
        description: entry.description,
        type: entry.type,
        partyId: l.partyId,
        partyName: l.partyId ? partyName(ds, l.partyId) : undefined,
        debit: l.debit,
        credit: l.credit,
        balance: running,
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* statements                                                          */
/* ------------------------------------------------------------------ */

export interface TrialBalanceRow {
  account: Account;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  difference: number;
}

export function trialBalance(ds: DemoDataset, asOf: string): TrialBalance {
  const rows: TrialBalanceRow[] = ds.accounts
    .map((account) => {
      const signed = signedBalance(ds, account.id, { end: asOf });
      return {
        account,
        debit: signed > 0 ? signed : 0,
        credit: signed < 0 ? -signed : 0,
      };
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0);
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.round(totalDebit) === Math.round(totalCredit),
    difference: Math.round(totalDebit - totalCredit),
  };
}

export interface PLSection {
  account: Account;
  amount: number;
}

export interface ProfitAndLoss {
  start: string;
  end: string;
  revenue: PLSection[];
  totalRevenue: number;
  costOfSales: PLSection[];
  totalCostOfSales: number;
  grossProfit: number;
  operatingExpenses: PLSection[];
  totalOperatingExpenses: number;
  otherIncome: PLSection[];
  totalOtherIncome: number;
  netProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
}

export function profitAndLoss(ds: DemoDataset, start: string, end: string): ProfitAndLoss {
  const mk = (a: Account): PLSection => ({ account: a, amount: naturalBalance(ds, a.id, { start, end }) });
  const revenue = accountsByType(ds, 'income').filter((a) => a.id === '4000').map(mk);
  const otherIncome = accountsByType(ds, 'income').filter((a) => a.id !== '4000').map(mk);
  const costOfSales = accountsByType(ds, 'expense').filter((a) => a.group === 'Direct Costs').map(mk);
  const operatingExpenses = accountsByType(ds, 'expense').filter((a) => a.group === 'Operating Expenses').map(mk);
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0);
  const totalCostOfSales = costOfSales.reduce((s, r) => s + r.amount, 0);
  const totalOperatingExpenses = operatingExpenses.reduce((s, r) => s + r.amount, 0);
  const totalOtherIncome = otherIncome.reduce((s, r) => s + r.amount, 0);
  const grossProfit = totalRevenue - totalCostOfSales;
  const netProfit = grossProfit + totalOtherIncome - totalOperatingExpenses;
  return {
    start, end, revenue, totalRevenue, costOfSales, totalCostOfSales, grossProfit,
    operatingExpenses, totalOperatingExpenses, otherIncome, totalOtherIncome,
    netProfit,
    grossMarginPct: totalRevenue ? (grossProfit / totalRevenue) * 100 : 0,
    netMarginPct: totalRevenue ? (netProfit / totalRevenue) * 100 : 0,
  };
}

export interface BalanceSheet {
  asOf: string;
  assets: PLSection[];
  totalAssets: number;
  currentAssets: PLSection[];
  nonCurrentAssets: PLSection[];
  liabilities: PLSection[];
  totalLiabilities: number;
  equity: PLSection[];
  totalEquity: number;
  retainedEarnings: number;
  netProfitToDate: number;
  balanced: boolean;
  difference: number;
}

export function balanceSheet(ds: DemoDataset, asOf: string): BalanceSheet {
  const assets = accountsByType(ds, 'asset')
    .map((a) => ({ account: a, amount: naturalBalance(ds, a.id, { end: asOf }) }))
    .filter((r) => r.amount !== 0);
  const liabilities = accountsByType(ds, 'liability')
    .map((a) => ({ account: a, amount: naturalBalance(ds, a.id, { end: asOf }) }))
    .filter((r) => r.amount !== 0);
  const capital = accountsByType(ds, 'equity')
    .map((a) => ({ account: a, amount: naturalBalance(ds, a.id, { end: asOf }) }))
    .filter((r) => r.amount !== 0);

  const income = accountsByType(ds, 'income').reduce((s, a) => s + naturalBalance(ds, a.id, { end: asOf }), 0);
  const expense = accountsByType(ds, 'expense').reduce((s, a) => s + naturalBalance(ds, a.id, { end: asOf }), 0);
  const netProfitToDate = income - expense;

  const equity: PLSection[] = [
    ...capital,
    {
      account: {
        id: 'RETAINED', code: '—', name: 'Retained Earnings (accumulated profit)', type: 'equity',
        group: 'Equity', normalBalance: 'credit', openingBalance: 0,
      },
      amount: netProfitToDate,
    },
  ];

  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
  const difference = Math.round(totalAssets - (totalLiabilities + totalEquity));

  return {
    asOf,
    assets,
    totalAssets,
    currentAssets: assets.filter((r) => r.account.group === 'Current Assets'),
    nonCurrentAssets: assets.filter((r) => r.account.group === 'Non-Current Assets'),
    liabilities,
    totalLiabilities,
    equity,
    totalEquity,
    retainedEarnings: netProfitToDate,
    netProfitToDate,
    balanced: difference === 0,
    difference,
  };
}

export interface CashFlowLine {
  label: string;
  amount: number;
  type: TransactionType;
}

export interface CashFlowStatement {
  start: string;
  end: string;
  operatingInflows: CashFlowLine[];
  operatingOutflows: CashFlowLine[];
  financing: CashFlowLine[];
  investing: CashFlowLine[];
  netOperating: number;
  netFinancing: number;
  netInvesting: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  reconciles: boolean;
}

function cashMovement(entry: JournalEntry): number {
  return entry.lines
    .filter((l) => LIQUID_ACCOUNTS.includes(l.accountId))
    .reduce((s, l) => s + l.debit - l.credit, 0);
}

export function cashFlow(ds: DemoDataset, start: string, end: string): CashFlowStatement {
  const openingCash = sumAccounts(ds, LIQUID_ACCOUNTS, { end: prevDay(start) });
  const closingCash = sumAccounts(ds, LIQUID_ACCOUNTS, { end });

  const bucket = (type: TransactionType, movement: number): 'in' | 'out' | 'financing' | 'investing' | 'transfer' => {
    if (type === 'receipt' || type === 'sales') return movement >= 0 ? 'in' : 'out';
    if (type === 'payment' || type === 'purchase' || type === 'expense') return movement < 0 ? 'out' : 'in';
    if (type === 'opening') return 'financing';
    return 'transfer';
  };

  const opIn = new Map<string, CashFlowLine>();
  const opOut = new Map<string, CashFlowLine>();
  const fin = new Map<string, CashFlowLine>();
  const inv = new Map<string, CashFlowLine>();

  for (const entry of entriesInRange(ds, start, end)) {
    const movement = cashMovement(entry);
    if (movement === 0) continue;
    const where = bucket(entry.type, movement);
    if (where === 'transfer') continue;
    const labelFor = (): string => {
      if (entry.type === 'receipt') {
        const party = entry.lines.find((l) => l.partyId)?.partyId;
        if (party) return `Receipts from ${partyName(ds, party)}`;
        return 'Other income received';
      }
      if (entry.type === 'sales') return 'Cash sales';
      if (entry.type === 'payment') {
        const party = entry.lines.find((l) => l.partyId)?.partyId;
        return party ? `Payments to ${partyName(ds, party)}` : 'Payments to suppliers';
      }
      if (entry.type === 'purchase') return 'Cash purchases';
      if (entry.type === 'expense') {
        const expLine = entry.lines.find((l) => l.debit > 0);
        return accountName(ds, expLine?.accountId ?? '') || 'Expenses paid';
      }
      if (entry.type === 'opening') return 'Owner capital introduced';
      return TYPE_LABELS[entry.type];
    };
    const key = labelFor();
    if (where === 'in') {
      const prev = opIn.get(key) ?? { label: key, amount: 0, type: entry.type };
      prev.amount += movement;
      opIn.set(key, prev);
    } else if (where === 'out') {
      const prev = opOut.get(key) ?? { label: key, amount: 0, type: entry.type };
      prev.amount += Math.abs(movement);
      opOut.set(key, prev);
    } else if (where === 'financing') {
      const prev = fin.get(key) ?? { label: key, amount: 0, type: entry.type };
      prev.amount += movement;
      fin.set(key, prev);
    } else {
      const prev = inv.get(key) ?? { label: key, amount: 0, type: entry.type };
      prev.amount += movement;
      inv.set(key, prev);
    }
  }

  const operatingInflows = [...opIn.values()].filter((l) => l.amount !== 0);
  const operatingOutflows = [...opOut.values()].filter((l) => l.amount !== 0);
  const financing = [...fin.values()].filter((l) => l.amount !== 0);
  const investing = [...inv.values()].filter((l) => l.amount !== 0);
  const netOperating = operatingInflows.reduce((s, l) => s + l.amount, 0) - operatingOutflows.reduce((s, l) => s + l.amount, 0);
  const netFinancing = financing.reduce((s, l) => s + l.amount, 0);
  const netInvesting = investing.reduce((s, l) => s + l.amount, 0);
  const netChange = netOperating + netFinancing + netInvesting;

  return {
    start, end, operatingInflows, operatingOutflows, financing, investing,
    netOperating, netFinancing, netInvesting, netChange,
    openingCash, closingCash,
    reconciles: Math.abs(Math.round(openingCash + netChange) - Math.round(closingCash)) <= 1,
  };
}

function prevDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* dashboard aggregates                                                */
/* ------------------------------------------------------------------ */

export interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  cogs: number;
  profit: number;
  sales: number;
  purchases: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
}

export interface DashboardSummary {
  range: DateRange;
  asOf: string;
  cashBalance: number;
  bankBalance: number;
  totalSales: number;
  salesReturns: number;
  totalPurchases: number;
  totalExpenses: number;
  costOfSales: number;
  netProfit: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventoryValue: number;
  totalIncome: number;
  grossProfit: number;
  grossMarginPct: number;
  netMarginPct: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  monthly: MonthPoint[];
  prior: {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    netProfit: number;
  };
}

export function monthKeysBetween(start: string, end: string): string[] {
  const keys: string[] = [];
  let cursor = startOfMonth(start);
  let guard = 0;
  while (cursor <= end && guard < 60) {
    keys.push(cursor.slice(0, 7));
    cursor = startOfMonth(nextMonth(cursor));
    guard++;
  }
  return keys;
}

function nextMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function monthlySeries(ds: DemoDataset, start: string, end: string): MonthPoint[] {
  return monthKeysBetween(start, end).map((key) => {
    const mStart = `${key}-01`;
    const mEnd = endOfMonth(mStart);
    const from = mStart < start ? start : mStart;
    const to = mEnd > end ? end : mEnd;
    const revenue = naturalBalance(ds, '4000', { start: from, end: to });
    const cogs = naturalBalance(ds, '5000', { start: from, end: to });
    const expenses = accountsByType(ds, 'expense')
      .filter((a) => a.group === 'Operating Expenses')
      .reduce((s, a) => s + naturalBalance(ds, a.id, { start: from, end: to }), 0);
    const otherIncome = naturalBalance(ds, '4100', { start: from, end: to });
    let cashIn = 0;
    let cashOut = 0;
    for (const entry of entriesInRange(ds, from, to)) {
      const mv = cashMovement(entry);
      if (mv > 0) cashIn += mv;
      else if (mv < 0) cashOut += Math.abs(mv);
    }
    const sales = entriesInRange(ds, from, to).filter((e) => e.type === 'sales').reduce((s, e) => s + entryAmount(e), 0);
    const purchases = entriesInRange(ds, from, to).filter((e) => e.type === 'purchase').reduce((s, e) => s + entryAmount(e), 0);
    return {
      key,
      label: monthLabel(mStart),
      revenue,
      cogs,
      expenses,
      profit: revenue + otherIncome - cogs - expenses,
      sales,
      purchases,
      cashIn,
      cashOut,
      netCash: cashIn - cashOut,
    };
  });
}

export function dashboardSummary(ds: DemoDataset, range: DateRange): DashboardSummary {
  const { start, end } = range;
  const asOf = end > ds.demoToday ? ds.demoToday : end;
  const pl = profitAndLoss(ds, start, end);
  const totalSales = pl.totalRevenue;
  const totalExpenses = pl.totalOperatingExpenses;
  const totalPurchases = entriesInRange(ds, start, end)
    .filter((e) => e.type === 'purchase')
    .reduce((s, e) => s + entryAmount(e), 0);
  const cashInflow = entriesInRange(ds, start, end).reduce((s, e) => {
    const mv = cashMovement(e);
    return mv > 0 ? s + mv : s;
  }, 0);
  const cashOutflow = entriesInRange(ds, start, end).reduce((s, e) => {
    const mv = cashMovement(e);
    return mv < 0 ? s + Math.abs(mv) : s;
  }, 0);

  const spanDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1);
  const priorEnd = prevDay(start);
  const priorStartD = new Date(priorEnd + 'T00:00:00Z');
  priorStartD.setUTCDate(priorStartD.getUTCDate() - (spanDays - 1));
  const priorStart = priorStartD.toISOString().slice(0, 10);
  const priorPl = profitAndLoss(ds, priorStart, priorEnd);
  const priorPurchases = entriesInRange(ds, priorStart, priorEnd)
    .filter((e) => e.type === 'purchase')
    .reduce((s, e) => s + entryAmount(e), 0);

  return {
    range,
    asOf,
    cashBalance: sumAccounts(ds, CASH_ACCOUNTS, { end: asOf }),
    bankBalance: sumAccounts(ds, BANK_ACCOUNTS, { end: asOf }),
    totalSales,
    salesReturns: 0,
    totalPurchases,
    totalExpenses,
    costOfSales: pl.totalCostOfSales,
    netProfit: pl.netProfit,
    accountsReceivable: naturalBalance(ds, '1100', { end: asOf }),
    accountsPayable: naturalBalance(ds, '2000', { end: asOf }),
    inventoryValue: naturalBalance(ds, '1200', { end: asOf }),
    totalIncome: pl.totalRevenue + pl.totalOtherIncome,
    grossProfit: pl.grossProfit,
    grossMarginPct: pl.grossMarginPct,
    netMarginPct: pl.netMarginPct,
    cashInflow,
    cashOutflow,
    netCashFlow: cashInflow - cashOutflow,
    monthly: monthlySeries(ds, start, end),
    prior: {
      totalSales: priorPl.totalRevenue,
      totalPurchases: priorPurchases,
      totalExpenses: priorPl.totalOperatingExpenses,
      netProfit: priorPl.netProfit,
    },
  };
}

/* ------------------------------------------------------------------ */
/* range helpers                                                       */
/* ------------------------------------------------------------------ */

export function buildRange(preset: RangePreset, today: string, custom?: { start: string; end: string }): DateRange {
  const d = new Date(today + 'T00:00:00Z');
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  switch (preset) {
    case 'today':
      return { preset, start: today, end: today, label: 'Today' };
    case 'week': {
      const s = new Date(d);
      s.setUTCDate(s.getUTCDate() - 6);
      return { preset, start: iso(s), end: today, label: 'This Week' };
    }
    case 'month': {
      const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      return { preset, start: iso(s), end: today, label: 'This Month' };
    }
    case 'lastMonth': {
      const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
      const e = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0));
      return { preset, start: iso(s), end: iso(e), label: 'Last Month' };
    }
    case 'custom':
      return {
        preset,
        start: custom?.start ?? today,
        end: custom?.end ?? today,
        label: 'Custom Range',
      };
    case 'year':
    default: {
      const s = new Date(Date.UTC(d.getUTCFullYear(), 6, 1)); // fiscal year starts in July
      const start = s > d ? new Date(Date.UTC(d.getUTCFullYear() - 1, 6, 1)) : s;
      return { preset: 'year', start: iso(start), end: today, label: 'This Year' };
    }
  }
}
