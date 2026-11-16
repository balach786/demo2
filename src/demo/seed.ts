/**
 * DEMO SEED — single source of truth for the whole demonstration.
 *
 * Every number shown in the dashboard, accounting module, reports and the AI
 * Secretary is derived from `entries[].lines` (double-entry journal lines).
 * Nothing is hardcoded per-screen, so the demo always reconciles.
 *
 * The generator is fully deterministic (seeded PRNG + fixed demo clock), so a
 * live presentation shows the same figures every single time.
 */
import type {
  Account,
  Activity,
  Approval,
  DemoDataset,
  DemoDocument,
  JournalEntry,
  JournalLine,
  Party,
  TransactionType,
} from './types';
import {
  DEMO_WAREHOUSES,
  DEMO_PRODUCTS,
  DEMO_STOCK_TRANSFERS,
  DEMO_IMPORTS,
  DEMO_EXPORTS,
  DEMO_FX_TRANSACTIONS,
} from './tradeSeed';

export const DEMO_TODAY = '2026-11-06';
export const FISCAL_YEAR_START = '2025-07-01';
export const DEMO_STORAGE_KEY = 'absa.demo.state.v1';

/* ------------------------------------------------------------------ */
/* deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round50 = (n: number) => Math.round(n / 50) * 50;

/* ------------------------------------------------------------------ */
/* chart of accounts                                                   */
/* ------------------------------------------------------------------ */

export const ACCOUNTS: Account[] = [
  {
    id: '1000', code: '1000', name: 'Cash in Hand', type: 'asset', group: 'Current Assets',
    normalBalance: 'debit', isCash: true, description: 'Main Cash Account — counter and petty cash.',
    openingBalance: 850_000,
  },
  {
    id: '1010', code: '1010', name: 'HBL Business Account', type: 'asset', group: 'Current Assets',
    normalBalance: 'debit', isBank: true, bankName: 'Habib Bank Limited (HBL)',
    accountTitle: 'ABC Trading Company', accountNumber: 'PK36 HABB 0000 0001 2345 6789',
    description: 'Primary collection and disbursement account.', openingBalance: 3_200_000,
  },
  {
    id: '1020', code: '1020', name: 'Meezan Business Account', type: 'asset', group: 'Current Assets',
    normalBalance: 'debit', isBank: true, bankName: 'Meezan Bank Limited',
    accountTitle: 'ABC Trading Company', accountNumber: 'PK09 MEZN 0000 0098 7654 3210',
    description: 'Supplier payments and utility expenses.', openingBalance: 1_450_000,
  },
  {
    id: '1100', code: '1100', name: 'Accounts Receivable', type: 'asset', group: 'Current Assets',
    normalBalance: 'debit', description: 'Amounts due from customers.', openingBalance: 380_000,
  },
  {
    id: '1200', code: '1200', name: 'Inventory', type: 'asset', group: 'Current Assets',
    normalBalance: 'debit', description: 'Trading stock valued at cost.', openingBalance: 1_850_000,
  },
  {
    id: '1300', code: '1300', name: 'Fixed Assets', type: 'asset', group: 'Non-Current Assets',
    normalBalance: 'debit', description: 'Delivery vehicle, office equipment and furniture.', openingBalance: 2_600_000,
  },
  {
    id: '2000', code: '2000', name: 'Accounts Payable', type: 'liability', group: 'Current Liabilities',
    normalBalance: 'credit', description: 'Amounts due to suppliers.', openingBalance: 265_000,
  },
  {
    id: '2100', code: '2100', name: 'Business Loan', type: 'liability', group: 'Long-Term Liabilities',
    normalBalance: 'credit', description: 'Meezan Business Finance facility.', openingBalance: 0,
  },
  {
    id: '3000', code: '3000', name: 'Owner\'s Capital', type: 'equity', group: 'Equity',
    normalBalance: 'credit', description: 'Capital introduced by the owner.', openingBalance: 10_065_000,
  },
  {
    id: '3100', code: '3100', name: 'Retained Earnings', type: 'equity', group: 'Equity',
    normalBalance: 'credit', description: 'Accumulated profit retained in the business.', openingBalance: 0,
  },
  {
    id: '4000', code: '4000', name: 'Sales Revenue', type: 'income', group: 'Revenue',
    normalBalance: 'credit', description: 'Revenue from trading sales.', openingBalance: 0,
  },
  {
    id: '4100', code: '4100', name: 'Other Income', type: 'income', group: 'Revenue',
    normalBalance: 'credit', description: 'Scrap sales, commission and miscellaneous income.', openingBalance: 0,
  },
  {
    id: '5000', code: '5000', name: 'Cost of Goods Sold', type: 'expense', group: 'Direct Costs',
    normalBalance: 'debit', description: 'Cost of trading stock sold.', openingBalance: 0,
  },
  {
    id: '5100', code: '5100', name: 'Rent Expense', type: 'expense', group: 'Operating Expenses',
    normalBalance: 'debit', description: 'Warehouse and office rent.', openingBalance: 0,
  },
  {
    id: '5110', code: '5110', name: 'Salaries Expense', type: 'expense', group: 'Operating Expenses',
    normalBalance: 'debit', description: 'Staff salaries and allowances.', openingBalance: 0,
  },
  {
    id: '5120', code: '5120', name: 'Electricity Expense', type: 'expense', group: 'Operating Expenses',
    normalBalance: 'debit', description: 'K-Electric commercial bills.', openingBalance: 0,
  },
  {
    id: '5130', code: '5130', name: 'Transport Expense', type: 'expense', group: 'Operating Expenses',
    normalBalance: 'debit', description: 'Delivery, fuel and carriage.', openingBalance: 0,
  },
  {
    id: '5140', code: '5140', name: 'General Expenses', type: 'expense', group: 'Operating Expenses',
    normalBalance: 'debit', description: 'Stationery, tea, repairs and sundries.', openingBalance: 0,
  },
];

/* ------------------------------------------------------------------ */
/* parties                                                             */
/* ------------------------------------------------------------------ */

export const PARTIES: Party[] = [
  {
    id: 'CUS-001', code: 'CUS-001', name: 'Ahmed Enterprises', type: 'customer',
    contactPerson: 'Ahmed Raza', phone: '+92 300 1234567', email: 'accounts@ahmedenterprises.pk',
    city: 'Karachi', address: 'Shop 14, Bolton Market, Karachi', ntn: '4210123456789',
    paymentTerms: '15 days', creditLimit: 2_000_000, since: '2023-02-11',
    openingBalance: 380_000, openingBalanceType: 'debit',
  },
  {
    id: 'CUS-002', code: 'CUS-002', name: 'XYZ Distributors', type: 'customer',
    contactPerson: 'Bilal Ahmed', phone: '+92 321 8765432', email: 'bilal@xyzdistributors.pk',
    city: 'Lahore', address: '42-F, Gulberg III, Lahore', ntn: '3520198765432',
    paymentTerms: '30 days', creditLimit: 3_500_000, since: '2022-09-04',
    openingBalance: 0, openingBalanceType: 'debit',
  },
  {
    id: 'CUS-003', code: 'CUS-003', name: 'Al-Noor Traders', type: 'customer',
    contactPerson: 'Noor Muhammad', phone: '+92 333 4455667', email: 'info@alnoortraders.pk',
    city: 'Hyderabad', address: 'Latifabad Unit 7, Hyderabad', ntn: '4130223344556',
    paymentTerms: '15 days', creditLimit: 1_500_000, since: '2024-01-19',
    openingBalance: 0, openingBalanceType: 'debit',
  },
  {
    id: 'CUS-004', code: 'CUS-004', name: 'Karachi Hardware Mart', type: 'customer',
    contactPerson: 'Imran Shaikh', phone: '+92 345 9988776', email: 'sales@khmart.pk',
    city: 'Karachi', address: 'Lea Market, Saddar, Karachi', ntn: '4210556677889',
    paymentTerms: '7 days', creditLimit: 900_000, since: '2024-06-27',
    openingBalance: 0, openingBalanceType: 'debit',
  },
  {
    id: 'SUP-001', code: 'SUP-001', name: 'ABC Traders', type: 'supplier',
    contactPerson: 'Kamran Iqbal', phone: '+92 301 2233445', email: 'kamran@abctraders.pk',
    city: 'Karachi', address: 'Plot 9, SITE Area, Karachi', ntn: '4210987654321',
    paymentTerms: '30 days', creditLimit: 0, since: '2021-11-02',
    openingBalance: 0, openingBalanceType: 'credit',
  },
  {
    id: 'SUP-002', code: 'SUP-002', name: 'Ali Suppliers', type: 'supplier',
    contactPerson: 'Ali Hassan', phone: '+92 322 7788990', email: 'ali@alisuppliers.pk',
    city: 'Faisalabad', address: 'Jhang Road, Faisalabad', ntn: '3310876543219',
    paymentTerms: '20 days', creditLimit: 0, since: '2023-05-16',
    openingBalance: 0, openingBalanceType: 'credit',
  },
  {
    id: 'SUP-003', code: 'SUP-003', name: 'Shahid Brothers', type: 'supplier',
    contactPerson: 'Shahid Mehmood', phone: '+92 313 5566778', email: 'shahid@shahidbros.pk',
    city: 'Karachi', address: 'M.A. Jinnah Road, Karachi', ntn: '4211334455667',
    paymentTerms: '15 days', creditLimit: 0, since: '2022-03-08',
    openingBalance: 0, openingBalanceType: 'credit',
  },
  {
    id: 'SUP-004', code: 'SUP-004', name: 'Pak Wholesale Company', type: 'supplier',
    contactPerson: 'Usman Tariq', phone: '+92 300 6677889', email: 'usman@pakwholesale.pk',
    city: 'Rawalpindi', address: 'Bank Road, Saddar, Rawalpindi', ntn: '3740556677881',
    paymentTerms: '30 days', creditLimit: 0, since: '2023-08-21',
    openingBalance: 0, openingBalanceType: 'credit',
  },
];

/* ------------------------------------------------------------------ */
/* entry builder                                                       */
/* ------------------------------------------------------------------ */

function line(accountId: string, debit: number, credit: number, partyId?: string): JournalLine {
  return partyId ? { accountId, debit, credit, partyId } : { accountId, debit, credit };
}

interface BuildCtx {
  entries: JournalEntry[];
  seq: Record<string, number>;
  nowStamp: string;
}

const TYPE_PREFIX: Record<TransactionType, string> = {
  opening: 'OPS',
  sales: 'INV',
  purchase: 'BILL',
  receipt: 'RV',
  payment: 'PV',
  expense: 'EXP',
  deposit: 'DEP',
  withdrawal: 'WDR',
  transfer: 'TRF',
};

function addEntry(
  ctx: BuildCtx,
  date: string,
  type: TransactionType,
  description: string,
  lines: JournalLine[],
): JournalEntry {
  const year = date.slice(0, 4);
  const key = `${type}-${year}`;
  ctx.seq[key] = (ctx.seq[key] ?? 0) + 1;
  const reference = `${TYPE_PREFIX[type]}-${year}-${String(ctx.seq[key]).padStart(3, '0')}`;
  const entry: JournalEntry = {
    id: `JE-${String(ctx.entries.length + 1).padStart(5, '0')}`,
    reference,
    date,
    type,
    description,
    lines,
    createdAt: `${date}T10:00:00.000Z`,
    source: 'seed',
    status: 'posted',
  };
  ctx.entries.push(entry);
  return entry;
}

/* ------------------------------------------------------------------ */
/* dataset builder                                                     */
/* ------------------------------------------------------------------ */

export function buildDemoDataset(): DemoDataset {
  const rng = mulberry32(20261106);
  const ctx: BuildCtx = { entries: [], seq: {}, nowStamp: `${DEMO_TODAY}T09:15:00.000Z` };

  const customers = PARTIES.filter((p) => p.type === 'customer');
  const suppliers = PARTIES.filter((p) => p.type === 'supplier');
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)] as T;

  /* ---------------- opening balances ---------------- */
  addEntry(ctx, FISCAL_YEAR_START, 'opening', 'Opening balances brought forward', [
    line('1000', 850_000, 0),
    line('1010', 3_200_000, 0),
    line('1020', 1_450_000, 0),
    line('1200', 1_850_000, 0),
    line('1300', 2_600_000, 0),
    line('1100', 380_000, 0, 'CUS-001'),
    line('2000', 0, 265_000, 'SUP-003'),
    line('3000', 0, 10_065_000),
  ]);
  addEntry(ctx, FISCAL_YEAR_START, 'opening', 'Meezan Business Finance facility received', [
    line('1020', 1_500_000, 0),
    line('2100', 0, 1_500_000),
  ]);

  /* ---------------- party outstanding tracking ---------------- */
  // Receipts and payments are allocated against real outstanding balances so the
  // demo never shows a customer overpaying or a supplier being paid twice.
  const outstanding = new Map<string, number>();
  outstanding.set('CUS-001', 380_000);
  outstanding.set('SUP-003', 265_000);

  const allocate = (
    balances: { partyId: string; name: string; due: number }[],
    total: number,
    maxParcels: number,
  ): { partyId: string; name: string; amount: number }[] => {
    const pool = balances.filter((b) => b.due > 0).sort((a, b) => b.due - a.due);
    if (!pool.length || total <= 0) return [];
    const chosen = pool.slice(0, maxParcels);
    const sumDue = chosen.reduce((s, b) => s + b.due, 0);
    const out: { partyId: string; name: string; amount: number }[] = [];
    let allocated = 0;
    chosen.forEach((b, idx) => {
      const isLast = idx === chosen.length - 1;
      const raw = isLast ? total - allocated : round50((total * b.due) / sumDue);
      const amount = Math.max(0, Math.min(raw, b.due));
      allocated += amount;
      if (amount > 0) out.push({ partyId: b.partyId, name: b.name, amount });
    });
    return out;
  };

  const customerDue = () =>
    customers.map((c) => ({ partyId: c.id, name: c.name, due: outstanding.get(c.id) ?? 0 }));
  const supplierDue = () =>
    suppliers.map((c) => ({ partyId: c.id, name: c.name, due: outstanding.get(c.id) ?? 0 }));
  const adjust = (partyId: string, delta: number) => {
    outstanding.set(partyId, (outstanding.get(partyId) ?? 0) + delta);
  };

  /* ---------------- monthly trading cycle ---------------- */
  const seasonal = [1.0, 0.95, 1.02, 1.08, 1.12, 1.05, 0.92, 0.98, 1.06, 1.1, 1.15, 1.2, 1.05, 1.0, 1.08, 1.1];
  const months: { year: number; month: number; index: number }[] = [];
  for (let i = 0; i < 17; i++) {
    const d = new Date(2025, 6 + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, index: i });
  }

  months.forEach((m, mIdx) => {
    const isCurrent = m.year === 2026 && m.month === 11;
    if (isCurrent) return; // current month is generated separately below
    const monthPrefix = `${m.year}-${String(m.month).padStart(2, '0')}`;
    const lastDay = new Date(m.year, m.month, 0).getDate();
    const dayIn = (frac: number) => {
      const d = Math.min(lastDay, Math.max(1, Math.floor(frac * lastDay) + Math.floor(rng() * 2)));
      return `${monthPrefix}-${String(d).padStart(2, '0')}`;
    };
    const jitter = (base: number, spread = 0.06) => round50(base * (1 - spread + rng() * spread * 2));
    const factor = (seasonal[mIdx] ?? 1) * (0.94 + rng() * 0.12);
    const S = round50(5_200_000 * factor);

    const cashSaleAmount = round50(S * 0.27);
    const creditSales = S - cashSaleAmount;
    const creditShares = [0.34, 0.28, 0.22, 0.16];

    /* --- invoice 1: cash sale --- */
    {
      const customer = pick(customers);
      const amount = cashSaleAmount;
      const cogs = round50(amount * 0.7);
      addEntry(ctx, dayIn(0.07), 'sales', `Cash sale — ${customer.name}`, [
        line('1000', amount, 0), line('4000', 0, amount),
        line('5000', cogs, 0), line('1200', 0, cogs),
      ]);
    }

    /* --- invoices 2..5: credit sales --- */
    let creditAllocated = 0;
    creditShares.forEach((share, idx) => {
      const isLast = idx === creditShares.length - 1;
      const amount = isLast ? creditSales - creditAllocated : round50(creditSales * share);
      creditAllocated += amount;
      const customer = pick(customers);
      const cogs = round50(amount * 0.7);
      addEntry(ctx, dayIn(0.12 + idx * 0.19), 'sales', `Credit sale — ${customer.name}`, [
        line('1100', amount, 0, customer.id), line('4000', 0, amount),
        line('5000', cogs, 0), line('1200', 0, cogs),
      ]);
      adjust(customer.id, amount);
    });

    /* --- purchases (all on credit) --- */
    const monthlyPurchases = round50(S * 0.72);
    const purchaseShares = [0.34, 0.27, 0.22, 0.17];
    purchaseShares.forEach((share, idx) => {
      const amount = round50(monthlyPurchases * share);
      const supplier = pick(suppliers);
      addEntry(ctx, dayIn(0.05 + idx * 0.22), 'purchase', `Credit purchase — ${supplier.name}`, [
        line('1200', amount, 0), line('2000', 0, amount, supplier.id),
      ]);
      adjust(supplier.id, amount);
    });

    /* --- customer receipts (collect 93% of the month's credit sales) --- */
    const receiptsTotal = round50(creditSales * 0.93);
    allocate(customerDue(), receiptsTotal, 4).forEach((r, idx) => {
      const bank = idx % 3 === 2 ? '1020' : '1010';
      addEntry(ctx, dayIn(0.2 + idx * 0.17), 'receipt', `Receipt from ${r.name}`, [
        line(bank, r.amount, 0), line('1100', 0, r.amount, r.partyId),
      ]);
      adjust(r.partyId, -r.amount);
    });

    /* --- supplier payments (90% of the month's purchases) --- */
    const paymentsTotal = round50(monthlyPurchases * 0.90);
    allocate(supplierDue(), paymentsTotal, 4).forEach((p, idx) => {
      const bank = idx % 2 === 1 ? '1020' : '1010';
      addEntry(ctx, dayIn(0.24 + idx * 0.18), 'payment', `Payment to ${p.name}`, [
        line('2000', p.amount, 0, p.partyId), line(bank, 0, p.amount),
      ]);
      adjust(p.partyId, -p.amount);
    });

    /* --- operating expenses --- */
    const expenses: { accountId: string; label: string; amount: number; payFrom: string; dayFrac: number }[] = [
      { accountId: '5100', label: 'Warehouse & office rent', amount: 185_000, payFrom: '1010', dayFrac: 0.05 },
      { accountId: '5110', label: 'Staff salaries', amount: jitter(632_000, 0.04), payFrom: '1010', dayFrac: 0.1 },
      { accountId: '5120', label: 'K-Electric bill', amount: jitter(128_000, 0.25), payFrom: '1020', dayFrac: 0.4 },
      { accountId: '5130', label: 'Transport & fuel', amount: jitter(72_000, 0.2), payFrom: '1000', dayFrac: 0.55 },
      { accountId: '5140', label: 'General & administrative', amount: jitter(52_000, 0.25), payFrom: '1000', dayFrac: 0.72 },
    ];
    expenses.forEach((exp) => {
      addEntry(ctx, dayIn(exp.dayFrac), 'expense', `${exp.label} — ${monthName(m.month)} ${m.year}`, [
        line(exp.accountId, exp.amount, 0), line(exp.payFrom, 0, exp.amount),
      ]);
    });

    /* --- cash banking movements --- */
    addEntry(ctx, dayIn(0.88), 'deposit', 'Cash deposited into HBL business account', [
      line('1010', round50(S * 0.2), 0), line('1000', 0, round50(S * 0.2)),
    ]);
    addEntry(ctx, dayIn(0.62), 'transfer', 'Funds transferred HBL → Meezan for supplier payments', [
      line('1020', round50(S * 0.15), 0), line('1010', 0, round50(S * 0.15)),
    ]);
    if (rng() < 0.6) {
      const wdr = round50(60_000 + rng() * 70_000);
      addEntry(ctx, dayIn(0.78), 'withdrawal', 'Cash withdrawal for petty expenses', [
        line('1000', wdr, 0), line('1010', 0, wdr),
      ]);
    }

    /* --- quarterly other income --- */
    if ([3, 6, 9, 12].includes(mIdx)) {
      const other = round50(45_000 + rng() * 140_000);
      addEntry(ctx, dayIn(0.9), 'receipt', 'Other income received — scrap & commission', [
        line('1010', other, 0), line('4100', 0, other),
      ]);
    }
  });

  /* ---------------- current month (Nov 2026, up to demo clock) ---------------- */
  const nov = '2026-11';
  addEntry(ctx, `${nov}-01`, 'sales', 'Credit sale — Ahmed Enterprises', [
    line('1100', 612_500, 0, 'CUS-001'), line('4000', 0, 612_500),
    line('5000', 428_750, 0), line('1200', 0, 428_750),
  ]);
  addEntry(ctx, `${nov}-02`, 'expense', 'K-Electric bill — November 2026', [
    line('5120', 128_400, 0), line('1020', 0, 128_400),
  ]);
  addEntry(ctx, `${nov}-03`, 'purchase', 'Credit purchase — Ali Suppliers', [
    line('1200', 486_000, 0), line('2000', 0, 486_000, 'SUP-002'),
  ]);
  addEntry(ctx, `${nov}-03`, 'receipt', 'Receipt from XYZ Distributors', [
    line('1010', 540_000, 0), line('1100', 0, 540_000, 'CUS-002'),
  ]);
  addEntry(ctx, `${nov}-04`, 'expense', 'Transport & fuel — November 2026', [
    line('5130', 74_300, 0), line('1000', 0, 74_300),
  ]);
  addEntry(ctx, `${nov}-04`, 'sales', 'Cash sale — Karachi Hardware Mart', [
    line('1000', 248_000, 0), line('4000', 0, 248_000),
    line('5000', 173_600, 0), line('1200', 0, 173_600),
  ]);
  addEntry(ctx, `${nov}-05`, 'payment', 'Payment to ABC Traders — invoice ABC-9921', [
    line('2000', 350_000, 0, 'SUP-001'), line('1010', 0, 350_000),
  ]);
  addEntry(ctx, `${nov}-05`, 'sales', 'Credit sale — Al-Noor Traders', [
    line('1100', 394_000, 0, 'CUS-003'), line('4000', 0, 394_000),
    line('5000', 275_800, 0), line('1200', 0, 275_800),
  ]);
  addEntry(ctx, `${nov}-05`, 'deposit', 'Cash deposited into HBL business account', [
    line('1010', 620_000, 0), line('1000', 0, 620_000),
  ]);
  addEntry(ctx, DEMO_TODAY, 'sales', 'Cash sale — Ahmed Enterprises', [
    line('1000', 186_500, 0), line('4000', 0, 186_500),
    line('5000', 130_550, 0), line('1200', 0, 130_550),
  ]);
  addEntry(ctx, DEMO_TODAY, 'sales', 'Credit sale — XYZ Distributors', [
    line('1100', 472_000, 0, 'CUS-002'), line('4000', 0, 472_000),
    line('5000', 330_400, 0), line('1200', 0, 330_400),
  ]);
  addEntry(ctx, DEMO_TODAY, 'expense', 'General & administrative — November 2026', [
    line('5140', 42_800, 0), line('1000', 0, 42_800),
  ]);

  /* ---------------- posted entry from an already-approved demo action ---------------- */
  const completedEntry = addEntry(ctx, '2026-10-30', 'payment', 'Payment to Ali Suppliers — September batch', [
    line('2000', 320_000, 0, 'SUP-002'), line('1010', 0, 320_000),
  ]);

  /* sort by date, then keep insertion order inside a date */
  ctx.entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));

  /* ---------------- documents (bundled samples) ---------------- */
  const documents: DemoDocument[] = [
    {
      id: 'DOC-001', name: 'HBL-Deposit-Slip-4417.pdf', kind: 'bank-slip',
      uploadedAt: '2026-11-05T15:22:00.000Z', uploadedBy: 'Demo User', sizeLabel: '184 KB',
      isSample: true, previewKind: 'bank-slip', status: 'extracted' as const,
      extraction: {
        documentType: 'Bank deposit slip', partyId: 'CUS-001', partyName: 'Ahmed Enterprises',
        amount: 185_000, date: '2026-11-05', reference: 'HBL-SLIP-4417',
        bankAccountId: '1010', confidence: 0.94, missingFields: [],
      },
    },
    {
      id: 'DOC-002', name: 'Purchase-Invoice-AliSuppliers-2287.jpg', kind: 'purchase-invoice',
      uploadedAt: '2026-11-04T11:05:00.000Z', uploadedBy: 'Demo User', sizeLabel: '612 KB',
      isSample: true, previewKind: 'purchase-invoice', status: 'draft-created' as const,
      extraction: {
        documentType: 'Purchase invoice', partyId: 'SUP-002', partyName: 'Ali Suppliers',
        amount: 246_500, date: '2026-11-04', reference: 'AI-2287',
        confidence: 0.82, missingFields: ['Tax / GST column'],
      },
    },
    {
      id: 'DOC-003', name: 'Payment-Receipt-ShahidBros-Oct.pdf', kind: 'payment-receipt',
      uploadedAt: '2026-10-28T09:40:00.000Z', uploadedBy: 'Demo User', sizeLabel: '96 KB',
      isSample: true, previewKind: 'payment-receipt', status: 'extracted' as const,
      extraction: {
        documentType: 'Payment receipt', partyId: 'SUP-003', partyName: 'Shahid Brothers',
        amount: 92_000, date: '2026-10-28', reference: undefined,
        confidence: 0.71, missingFields: ['Reference No.', 'Payment method'],
      },
    },
  ];

  /* ---------------- approvals (isolated demo workflow) ---------------- */
  const approvals: Approval[] = [
    {
      id: 'APR-2026-0144', reference: 'APR-2026-0144', createdAt: '2026-11-06T09:38:00.000Z',
      origin: 'ai', title: 'Record Rs. 15,000 payment to ABC Traders',
      subtitle: 'Prepared by AI Secretary from a natural-language command',
      command: 'Record Rs. 15,000 payment to ABC Traders.',
      status: 'pending', confidence: 0.97, uncertainties: [],
      draft: {
        type: 'payment', date: DEMO_TODAY, amount: 15_000, partyId: 'SUP-001', accountId: '1000',
        description: 'Payment to ABC Traders against outstanding balance',
        lines: [line('2000', 15_000, 0, 'SUP-001'), line('1000', 0, 15_000)],
      },
      simulated: true,
    },
    {
      id: 'APR-2026-0143', reference: 'APR-2026-0143', createdAt: '2026-11-05T15:24:00.000Z',
      origin: 'document', title: 'Bank deposit slip — Ahmed Enterprises — Rs. 185,000',
      subtitle: 'Extracted from HBL-Deposit-Slip-4417.pdf (simulated OCR)',
      status: 'pending', confidence: 0.94,
      uncertainties: ['Document type inferred — confirm it is a customer receipt'],
      documentId: 'DOC-001',
      draft: {
        type: 'receipt', date: '2026-11-05', amount: 185_000, partyId: 'CUS-001', accountId: '1010',
        description: 'Customer receipt — Ahmed Enterprises (bank deposit slip)',
        lines: [line('1010', 185_000, 0), line('1100', 0, 185_000, 'CUS-001')],
      },
      simulated: true,
    },
    {
      id: 'APR-2026-0142', reference: 'APR-2026-0142', createdAt: '2026-11-04T12:10:00.000Z',
      origin: 'document', title: 'Purchase invoice — Ali Suppliers — Rs. 246,500',
      subtitle: 'Extracted from Purchase-Invoice-AliSuppliers-2287.jpg (simulated OCR)',
      status: 'draft', confidence: 0.82,
      uncertainties: ['Tax / GST column not detected', 'No purchase order matched'],
      documentId: 'DOC-002',
      draft: {
        type: 'purchase', date: '2026-11-04', amount: 246_500, partyId: 'SUP-002', accountId: '2000',
        description: 'Purchase invoice AI-2287 — Ali Suppliers',
        lines: [line('1200', 246_500, 0), line('2000', 0, 246_500, 'SUP-002')],
      },
      simulated: true,
    },
    {
      id: 'APR-2026-0141', reference: 'APR-2026-0141', createdAt: '2026-10-30T10:02:00.000Z',
      origin: 'ai', title: 'Payment to Ali Suppliers — Rs. 320,000',
      subtitle: 'Approved by Demo User and posted to the ledger',
      command: 'Prepare a payment of Rs. 320,000 to Ali Suppliers.',
      status: 'completed', confidence: 0.95, uncertainties: [],
      approvedAt: '2026-10-30T10:04:00.000Z', approvedBy: 'Demo User',
      postedEntryId: completedEntry.id,
      draft: {
        type: 'payment', date: '2026-10-30', amount: 320_000, partyId: 'SUP-002', accountId: '1010',
        description: 'Payment to Ali Suppliers — September batch',
        lines: [line('2000', 320_000, 0, 'SUP-002'), line('1010', 0, 320_000)],
      },
      simulated: true,
    },
    {
      id: 'APR-2026-0140', reference: 'APR-2026-0140', createdAt: '2026-10-26T16:45:00.000Z',
      origin: 'ai', title: 'Payment to XYZ Distributors — Rs. 60,000',
      subtitle: 'Rejected by Demo User — duplicate voucher',
      command: 'Create a payment of Rs. 60,000 to XYZ Distributors.',
      status: 'rejected', confidence: 0.88, uncertainties: [],
      rejectionReason: 'Duplicate of PV-2026-042 (already posted)',
      draft: {
        type: 'payment', date: '2026-10-26', amount: 60_000, partyId: 'CUS-002', accountId: '1010',
        description: 'Payment to XYZ Distributors',
        lines: [line('2000', 60_000, 0, 'CUS-002'), line('1010', 0, 60_000)],
      },
      simulated: true,
    },
  ];

  const activities: Activity[] = [
    {
      id: 'ACT-001', at: '2026-11-06T09:38:00.000Z', actor: 'ai', tone: 'warning',
      title: 'AI drafted a payment for approval',
      detail: 'Rs. 15,000 to ABC Traders · awaiting your approval',
    },
    {
      id: 'ACT-002', at: '2026-11-06T09:12:00.000Z', actor: 'system', tone: 'success',
      title: 'Sales recorded today',
      detail: 'Rs. 658,500 across 2 invoices (cash + credit)',
    },
    {
      id: 'ACT-003', at: '2026-11-05T15:24:00.000Z', actor: 'ai', tone: 'info',
      title: 'Bank slip processed',
      detail: 'HBL-Deposit-Slip-4417.pdf · Rs. 185,000 extracted (simulated)',
    },
    {
      id: 'ACT-004', at: '2026-11-05T11:02:00.000Z', actor: 'user', tone: 'info',
      title: 'Cash deposited',
      detail: 'Rs. 620,000 deposited into HBL business account',
    },
    {
      id: 'ACT-005', at: '2026-11-04T12:10:00.000Z', actor: 'user', tone: 'danger',
      title: 'Approval rejected',
      detail: 'Payment of Rs. 60,000 to XYZ Distributors — duplicate voucher',
    },
    {
      id: 'ACT-006', at: '2026-10-30T10:04:00.000Z', actor: 'user', tone: 'success',
      title: 'Payment approved and posted',
      detail: 'Rs. 320,000 to Ali Suppliers · PV-2026-041',
    },
  ];

  return {
    demoToday: DEMO_TODAY,
    fiscalYearStart: FISCAL_YEAR_START,
    business: {
      name: 'ABC Trading Company',
      legalName: 'ABC Trading Company (Sole Proprietor)',
      currency: 'Pakistani Rupee',
      currencyCode: 'PKR',
      ntn: '4210123-4',
      address: 'Office 402, Business Centre, Shahrah-e-Faisal, Karachi',
      phone: '+92 21 3456 7890',
      email: 'accounts@abctrading.example',
      fiscalYearLabel: 'FY 2026–27 (Jul 2026 – Jun 2027)',
      logoInitials: 'ABC',
    },
    accounts: ACCOUNTS,
    parties: PARTIES,
    entries: ctx.entries,
    documents,
    approvals,
    activities,
    warehouses: DEMO_WAREHOUSES,
    inventory: DEMO_PRODUCTS,
    stockTransfers: DEMO_STOCK_TRANSFERS,
    imports: DEMO_IMPORTS,
    exports: DEMO_EXPORTS,
    fxTransactions: DEMO_FX_TRANSACTIONS,
  };
}

function monthName(month: number): string {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1] ?? '';
}
