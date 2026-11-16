/**
 * AI SECRETARY — SIMULATED / DETERMINISTIC ENGINE
 *
 * Important honesty note for the demo:
 * This module performs rule-based intent detection + entity extraction in the
 * browser and answers from the shared demo dataset. It does NOT call the OpenAI
 * API (no API key is present in this demo build) and it never pretends to.
 * The UI labels every response as a simulated assistant.
 */
import type { DemoDataset, DraftTransaction, JournalLine, Party, TransactionType } from '../demo/types';
import {
  accountName,
  balanceSheet,
  buildRange,
  entryAmount,
  monthKeysBetween,
  monthlySeries,
  naturalBalance,
  partyBalance,
  partyLedger,
  profitAndLoss,
  sumAccounts,
  trialBalance,
  BANK_ACCOUNTS,
  CASH_ACCOUNTS,
  TYPE_LABELS,
} from '../demo/accounting';
import { formatDate, formatPKR, monthLabel, parseISO } from '../lib/format';
import {
  computeFxBalances,
  formatFxAmount,
  formatFxRate,
  CURRENCY_METADATA,
  getProductTotalStock,
  getProductValuation,
  isLowStock,
  calculateTotalInventoryValuation,
} from '../demo/tradeLogic';

export interface AiMetric { label: string; value: string; hint?: string }
export interface AiTable {
  title?: string;
  columns: { label: string; numeric?: boolean }[];
  rows: (string | number)[][];
}
export interface AiLink { label: string; to: string }
export interface AiDraftPayload {
  title: string;
  subtitle: string;
  draft: DraftTransaction;
  confidence: number;
  uncertainties: string[];
}

export interface AiResult {
  intent: string;
  intentLabel: string;
  module: string;
  language: 'en' | 'roman-urdu';
  text: string;
  metrics?: AiMetric[];
  table?: AiTable;
  links?: AiLink[];
  draft?: AiDraftPayload;
  periodLabel?: string;
}

interface Period { start: string; end: string; label: string }

/** Wording that asks for a month-by-month comparison rather than a single-period total. */
const TREND_HINT = /\b(monthly|month wise|month-wise|trend|revenue and expenses|comparison|ماہانہ|ماہ بہ ماہ|رجحان)\b/;

const URDU_MARKERS = [
  'aaj', 'kitni', 'kitna', 'kitne', 'dikhao', 'dikha', 'batao', 'bata', 'munafa', 'kharcha', 'kharchay',
  'mahine', 'mahina', 'saal', 'ka', 'ki', 'ke', 'hai', 'hain', 'karo', 'kar', 'banao', 'deni', 'dena',
  'lena', 'leni', 'mujhe', 'mera', 'meri', 'hazoor', 'kitab', 'total', 'chahiye', 'kya', 'kis', 'kaun',
];

function detectLanguage(text: string): 'en' | 'roman-urdu' {
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'roman-urdu'; // Treated as Urdu/Roman-Urdu response mode
  }
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  const hits = words.filter((w) => URDU_MARKERS.includes(w)).length;
  return hits >= 2 ? 'roman-urdu' : 'en';
}

/* ------------------------------------------------------------------ */
/* entity extraction                                                   */
/* ------------------------------------------------------------------ */

const PARTY_ALIASES: Record<string, string> = {
  'ali traders': 'SUP-002',
  'ali supplier': 'SUP-002',
  'ali suppliers': 'SUP-002',
  'ali': 'SUP-002',
  'علی ٹریڈرز': 'SUP-002',
  'علی سپلائرز': 'SUP-002',
  'علی سپلائر': 'SUP-002',
  'علی': 'SUP-002',
  'ahmed': 'CUS-001',
  'ahmed enterprises': 'CUS-001',
  'احمد': 'CUS-001',
  'احمد انٹرپرائزز': 'CUS-001',
  'abc': 'SUP-001',
  'abc traders': 'SUP-001',
  'اے بی سی': 'SUP-001',
  'اے بی سی ٹریڈرز': 'SUP-001',
  'xyz': 'CUS-002',
  'xyz distributors': 'CUS-002',
  'ایکس وائی زیڈ': 'CUS-002',
  'al noor': 'CUS-003',
  'alnoor': 'CUS-003',
  'noor': 'CUS-003',
  'ال نور': 'CUS-003',
  'النور': 'CUS-003',
  'نور': 'CUS-003',
  'karachi hardware': 'CUS-004',
  'کراچی ہارڈویئر': 'CUS-004',
  'shahid': 'SUP-003',
  'shahid brothers': 'SUP-003',
  'شاہد': 'SUP-003',
  'شاہد برادرز': 'SUP-003',
  'pak wholesale': 'SUP-004',
  'usman': 'SUP-004',
  'پاک ہول سیل': 'SUP-004',
  'عثمان': 'SUP-004',
};

// Map eastern arabic numerals to western numerals
function normalizeNumerals(text: string): string {
  const arabicDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let res = text;
  for (let i = 0; i < 10; i++) {
    res = res.split(arabicDigits[i]).join(String(i));
  }
  return res;
}

export function resolveParty(text: string, ds: DemoDataset): Party | undefined {
  const t = text.toLowerCase();
  for (const [alias, id] of Object.entries(PARTY_ALIASES)) {
    if (new RegExp(`(?:^|\\s)${alias.replace(/ /g, '\\s+')}(?:$|\\s|[,.?!])`, 'i').test(t) || t.includes(alias)) {
      return ds.parties.find((p) => p.id === id);
    }
  }
  let best: { party: Party; score: number } | undefined;
  for (const p of ds.parties) {
    const full = p.name.toLowerCase();
    if (t.includes(full)) return p;
    const tokens = full.split(/\s+/).filter((w) => w.length > 3);
    const score = tokens.filter((w) => t.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { party: p, score };
  }
  return best?.party;
}

export function parseAmount(text: string): number | undefined {
  const normalized = normalizeNumerals(text);
  const t = normalized.toLowerCase().replace(/(\d),(\d)/g, '$1$2');
  // A negative figure is not a valid transaction amount — ask instead of flipping the sign.
  if (/(^|[\s(=])-\s*\d/.test(t)) return undefined;

  // Urdu words for numbers if explicitly used
  if (/\b(دس ہزار|10 ہزار)\b/.test(t)) return 10000;
  if (/\b(بیس ہزار|20 ہزار)\b/.test(t)) return 20000;
  if (/\b(پچیس ہزار|25 ہزار)\b/.test(t)) return 25000;
  if (/\b(پچاس ہزار|50 ہزار)\b/.test(t)) return 50000;
  if (/\b(ایک لاکھ|1 لاکھ)\b/.test(t)) return 100000;
  if (/\b(دو لاکھ|2 لاکھ)\b/.test(t)) return 200000;

  const m = t.match(/(?:rs\.?|pkr|rupees?|روپے)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|hazar|hazaar|thousand|ہزار|lakh|lac|lacs|لاکھ|million|ملین|m\b)?/i);
  if (!m) return undefined;
  const raw = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(raw) || raw <= 0) return undefined;
  const unit = (m[2] ?? '').toLowerCase();
  const mult = unit === 'k' || unit === 'hazar' || unit === 'hazaar' || unit === 'thousand' || unit === 'ہزار' ? 1_000
    : unit === 'lakh' || unit === 'lac' || unit === 'lacs' || unit === 'لاکھ' ? 100_000
    : unit === 'million' || unit === 'm' || unit === 'ملین' ? 1_000_000
    : 1;
  return Math.round(raw * mult);
}

function detectPeriod(text: string, ds: DemoDataset): Period {
  const t = text.toLowerCase();
  const today = ds.demoToday;
  const rangeToday = buildRange('today', today);
  const rangeMonth = buildRange('month', today);
  const rangeYear = buildRange('year', today);
  const lastMonth = buildRange('lastMonth', today);
  if (/\b(aaj|today|aaj ki|aaj ka)\b/.test(t) || /(آج|آج کی|آج کا)/.test(t)) return { ...rangeToday, label: 'Today' };
  if (/\b(last month|pichle mahine|pichley mahine|previous month)\b/.test(t) || /(پچھلے مہینے|گزشتہ ماہ|گزشتہ مہینہ)/.test(t)) return { ...lastMonth, label: 'Last Month' };
  if (/\b(this year|is saal|iss saal|ye saal|fy|financial year|saal)\b/.test(t) || /(اس سال|یہ سال)/.test(t)) return { ...rangeYear, label: 'This Year (FY to date)' };
  if (/\b(this month|is mahine|is mahina|curr?ent month|mahine|month)\b/.test(t) || /(اس مہینے|اس ماہ|موجودہ ماہ|مہینہ)/.test(t)) return { ...rangeMonth, label: 'This Month' };
  if (/\b(this week|is hafte|hafte|week)\b/.test(t) || /(اس ہفتے|ہفتہ)/.test(t)) return { ...buildRange('week', today), label: 'This Week' };
  return { ...rangeMonth, label: 'This Month' };
}

function isActionCommand(t: string): boolean {
  // Only explicit imperative verbs create drafts — questions such as
  // "Ali Traders ko kitni payment deni hai?" must return information instead.
  return /\b(prepare|record|create|make|add|post|enter|banao|bana do|likho|darj|karo|kar do|bhejo|de do)\b/.test(t) ||
    /(تیار کرو|بناؤ|بنا دو|ریکارڈ کرو|بھیجو|ادا کرو|ادائیگی کرو|درج کرو)/.test(t);
}

const linksFor = (path: string, label: string): AiLink[] => [{ label, to: path }];

/* ------------------------------------------------------------------ */
/* main entry point                                                    */
/* ------------------------------------------------------------------ */

export function runAiCommand(input: string, ds: DemoDataset): AiResult {
  const raw = input.trim();
  const t = raw.toLowerCase();
  const language = detectLanguage(raw);
  const ur = language === 'roman-urdu';
  const period = detectPeriod(raw, ds);
  const amount = parseAmount(raw);
  const party = resolveParty(raw, ds);

  /* ---------------- action: prepare payment ---------------- */
  if (isActionCommand(t) && (/\b(pay|payment|pay to|payable|transfer|bhejo|de do|dena)\b/.test(t) || /(پیمنٹ|ادائیگی|رقم|ادا کرو|بھیجو)/.test(t)) && !/\b(last|recent|show|list)\b/.test(t) && !/(آخری|دکھاؤ)/.test(t)) {
    if (!party) {
      return {
        intent: 'action.payment.missing_party', intentLabel: 'Action · Payment', module: 'Approvals',
        language,
        text: ur
          ? 'Payment draft banane ke liye party ka naam batana zaroori hai. Misal: "ABC Traders ko Rs. 25,000 payment record karo."'
          : 'I can prepare the payment, but I need to know the party. Try: "Record a payment of Rs. 25,000 to ABC Traders."',
        links: linksFor('/parties', 'Browse parties'),
      };
    }
    if (!amount) {
      const due = partyBalance(ds, party.id);
      return {
        intent: 'action.payment.missing_amount', intentLabel: 'Action · Payment', module: 'Approvals',
        language,
        text: ur
          ? `**${party.name}** ka outstanding balance ${formatPKR(due.balance)} hai. Kitna amount pay karna hai?`
          : `**${party.name}** currently has an outstanding balance of ${formatPKR(due.balance)}. What amount should I prepare?`,
        metrics: [{ label: 'Outstanding', value: formatPKR(due.balance), hint: due.side }],
        links: linksFor('/parties', 'Open party profile'),
      };
    }
    const payFrom = amount <= 50_000 ? '1000' : '1010';
    const lines: JournalLine[] = [
      { accountId: '2000', debit: amount, credit: 0, partyId: party.type === 'supplier' ? party.id : undefined },
      { accountId: payFrom, debit: 0, credit: amount },
    ];
    const due = partyBalance(ds, party.id);
    const uncertainties: string[] = [];
    if (party.type === 'customer') uncertainties.push('Party is a customer — this will be treated as a supplier-style payment; confirm the intent');
    if (due.balance < amount) uncertainties.push(`Amount exceeds the recorded outstanding balance of ${formatPKR(due.balance)}`);
    return {
      intent: 'action.payment.draft', intentLabel: 'Action · Payment draft', module: 'Approvals',
      language,
      text: ur
        ? `Main ne **${party.name}** ke liye ${formatPKR(amount)} ki payment ka draft tayyar kar liya hai. Ye abhi post nahi hui — approval ke baad ledger mein jayegi.`
        : `I have prepared a payment draft for **${formatPKR(amount)}** to **${party.name}**. Nothing has been posted — it will only hit the ledger after your approval.`,
      metrics: [
        { label: 'Transaction type', value: 'Payment' },
        { label: 'Party', value: party.name },
        { label: 'Amount', value: formatPKR(amount) },
        { label: 'Paid from', value: accountName(ds, payFrom) },
        { label: 'Current balance', value: formatPKR(due.balance), hint: due.side },
      ],
      draft: {
        title: `Payment to ${party.name} — ${formatPKR(amount)}`,
        subtitle: 'Prepared by the AI Secretary from a natural-language command',
        confidence: uncertainties.length ? 0.86 : 0.97,
        uncertainties,
        draft: {
          type: 'payment',
          date: ds.demoToday,
          amount,
          partyId: party.id,
          accountId: payFrom,
          description: `Payment to ${party.name} against outstanding balance`,
          lines,
        },
      },
      links: [{ label: 'Open Approvals', to: '/approvals' }, { label: 'Party ledger', to: `/parties/${party.id}` }],
    };
  }

  /* ---------------- action: record receipt ---------------- */
  if (isActionCommand(t) && (/\b(receipt|received|receive|recovery|wasooli)\b/.test(t) || /(وصولی|رسید)/.test(t)) && party && amount) {
    const lines: JournalLine[] = [
      { accountId: '1010', debit: amount, credit: 0 },
      { accountId: '1100', debit: 0, credit: amount, partyId: party.id },
    ];
    return {
      intent: 'action.receipt.draft', intentLabel: 'Action · Receipt draft', module: 'Approvals',
      language,
      text: ur
        ? `**${party.name}** se ${formatPKR(amount)} ki receipt ka draft tayyar hai. Approval ke baad Accounts Receivable kam ho jayega.`
        : `Receipt draft created for **${formatPKR(amount)}** from **${party.name}**. Approving it will reduce Accounts Receivable.`,
      metrics: [
        { label: 'Transaction type', value: 'Money Received' },
        { label: 'Party', value: party.name },
        { label: 'Amount', value: formatPKR(amount) },
        { label: 'Deposited to', value: accountName(ds, '1010') },
      ],
      draft: {
        title: `Receipt from ${party.name} — ${formatPKR(amount)}`,
        subtitle: 'Prepared by the AI Secretary from a natural-language command',
        confidence: 0.95,
        uncertainties: [],
        draft: {
          type: 'receipt', date: ds.demoToday, amount, partyId: party.id, accountId: '1010',
          description: `Receipt from ${party.name}`,
          lines,
        },
      },
      links: [{ label: 'Open Approvals', to: '/approvals' }],
    };
  }

  /* ---------------- party ledger ---------------- */
  if (party && (/\b(ledger|khata|account|statement|history|hisab)\b/.test(t) || /(لیجر|کھاتہ|حساب|سٹیٹمنٹ)/.test(t))) {
    const rows = partyLedger(ds, party.id).slice(-8);
    const bal = partyBalance(ds, party.id);
    return {
      intent: 'party.ledger', intentLabel: 'Party · Ledger', module: 'Ledgers',
      language,
      text: ur
        ? `**${party.name}** ka ledger neeche hai. Closing balance **${formatPKR(bal.balance)}** hai (${bal.side === 'receivable' ? 'hum ne lena hai' : bal.side === 'payable' ? 'hum ne dena hai' : 'settled'}).`
        : `Here is the ledger for **${party.name}**. The closing balance is **${formatPKR(bal.balance)}** (${bal.side === 'receivable' ? 'receivable from customer' : bal.side === 'payable' ? 'payable to supplier' : 'fully settled'}).`,
      metrics: [
        { label: 'Closing balance', value: formatPKR(bal.balance) },
        { label: 'Total debited', value: formatPKR(bal.debit) },
        { label: 'Total credited', value: formatPKR(bal.credit) },
        { label: 'Open entries', value: String(rows.length) },
      ],
      table: {
        title: 'Last 8 ledger entries',
        columns: [{ label: 'Date' }, { label: 'Reference' }, { label: 'Description' }, { label: 'Debit', numeric: true }, { label: 'Credit', numeric: true }, { label: 'Balance', numeric: true }],
        rows: rows.map((r) => [formatDate(r.date), r.reference, r.description, r.debit ? formatPKR(r.debit) : '—', r.credit ? formatPKR(r.credit) : '—', formatPKR(Math.abs(r.balance))]),
      },
      links: [{ label: 'Open full ledger', to: `/parties/${party.id}` }, { label: 'All parties', to: '/parties' }],
    };
  }

  /* ---------------- payable to a party ---------------- */
  if (party && (/\b(payable|deni|dena|due|owe|outstanding|baqaya|payment deni)\b/.test(t) || /(دینی|دینا|ادائیگی|واجب الادا|بقايا|کتنے پیسے|کتنی رقم)/.test(t))) {
    const bal = partyBalance(ds, party.id);
    const isPayable = bal.side === 'payable';
    return {
      intent: 'party.payable', intentLabel: 'Party · Outstanding balance', module: 'Parties',
      language,
      text: ur
        ? `**${party.name}** ko ${formatPKR(bal.balance)} ${isPayable ? 'ada karni hai (payable)' : 'receivable hai — in se lena hai'}. Ye amount ${party.paymentTerms} ki payment terms par based hai.`
        : `**${party.name}** has an outstanding ${isPayable ? 'payable of' : 'receivable of'} **${formatPKR(bal.balance)}** on ${party.paymentTerms} terms.`,
      metrics: [
        { label: isPayable ? 'You owe' : 'They owe you', value: formatPKR(bal.balance) },
        { label: 'Payment terms', value: party.paymentTerms },
        { label: 'Total invoiced', value: formatPKR(bal.credit) },
        { label: 'Total settled', value: formatPKR(bal.debit) },
      ],
      links: [
        { label: 'Party profile', to: `/parties/${party.id}` },
        { label: 'Prepare payment', to: '/ai' },
      ],
    };
  }

  /* ---------------- profit ---------------- */
  if (
    !/\b(forex|currency|exchange|tabadla)\b/.test(t) &&
    !/(فاریکس|کرنسی|تبادلہ)/.test(t) &&
    (/\b(profit|munafa|net income|margin|kamai)\b/.test(t) || /(منافع|نفع|آمدن|پرافٹ)/.test(t))
  ) {
    const pl = profitAndLoss(ds, period.start, period.end);
    const priorLen = Math.max(1, Math.round((parseISO(period.end).getTime() - parseISO(period.start).getTime()) / 86_400_000) + 1);
    const priorEnd = new Date(parseISO(period.start).getTime() - 86_400_000);
    const priorStart = new Date(priorEnd.getTime() - (priorLen - 1) * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const prior = profitAndLoss(ds, iso(priorStart), iso(priorEnd));
    const change = prior.netProfit ? ((pl.netProfit - prior.netProfit) / Math.abs(prior.netProfit)) * 100 : 0;
    return {
      intent: 'finance.profit', intentLabel: 'Finance · Net profit', module: 'Reports',
      language,
      text: ur
        ? `${period.label} ka net profit **${formatPKR(pl.netProfit)}** hai. Sales ${formatPKR(pl.totalRevenue)}, cost of sales ${formatPKR(pl.totalCostOfSales)} aur operating expenses ${formatPKR(pl.totalOperatingExpenses)} rahe.`
        : `Net profit for **${period.label}** is **${formatPKR(pl.netProfit)}**. Revenue ${formatPKR(pl.totalRevenue)}, cost of sales ${formatPKR(pl.totalCostOfSales)} and operating expenses ${formatPKR(pl.totalOperatingExpenses)}.`,
      metrics: [
        { label: 'Net profit', value: formatPKR(pl.netProfit), hint: `${pl.netMarginPct.toFixed(1)}% margin` },
        { label: 'Gross profit', value: formatPKR(pl.grossProfit), hint: `${pl.grossMarginPct.toFixed(1)}% GM` },
        { label: 'Revenue', value: formatPKR(pl.totalRevenue) },
        { label: 'Total expenses', value: formatPKR(pl.totalCostOfSales + pl.totalOperatingExpenses) },
        { label: 'vs previous period', value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` },
      ],
      table: {
        title: 'Profit & Loss summary',
        columns: [{ label: 'Line' }, { label: 'Amount', numeric: true }],
        rows: [
          ['Sales revenue', formatPKR(pl.totalRevenue)],
          ['Cost of goods sold', `(${formatPKR(pl.totalCostOfSales)})`],
          ['Gross profit', formatPKR(pl.grossProfit)],
          ['Operating expenses', `(${formatPKR(pl.totalOperatingExpenses)})`],
          ['Other income', formatPKR(pl.totalOtherIncome)],
          ['Net profit', formatPKR(pl.netProfit)],
        ],
      },
      links: [{ label: 'Open Profit & Loss', to: '/reports' }],
      periodLabel: `${formatDate(period.start)} → ${formatDate(period.end)}`,
    };
  }

  /* ---------------- cash / bank balances ---------------- */
  if ((/\b(cash|naqad)\b/.test(t) || /(کیش|نقد)/.test(t)) && (/\b(balance|kitna|how much|batao|available)\b/.test(t) || /(بیلنس|کتنا|کتنے|بتاؤ|پوزیشن)/.test(t))) {
    const cash = sumAccounts(ds, CASH_ACCOUNTS, { end: ds.demoToday });
    const bank = sumAccounts(ds, BANK_ACCOUNTS, { end: ds.demoToday });
    return {
      intent: 'finance.cash', intentLabel: 'Finance · Cash position', module: 'Banks',
      language,
      text: ur
        ? `Business ka cash in hand **${formatPKR(cash)}** hai aur bank accounts mein **${formatPKR(bank)}** majood hain — total liquidity ${formatPKR(cash + bank)}.`
        : `The business currently holds **${formatPKR(cash)}** in cash and **${formatPKR(bank)}** across bank accounts — total liquidity of **${formatPKR(cash + bank)}**.`,
      metrics: [
        { label: 'Cash in hand', value: formatPKR(cash) },
        { label: 'Bank balance', value: formatPKR(bank) },
        { label: 'Total liquidity', value: formatPKR(cash + bank) },
        { label: 'As at', value: formatDate(ds.demoToday) },
      ],
      table: {
        title: 'Bank accounts',
        columns: [{ label: 'Account' }, { label: 'Bank' }, { label: 'Balance', numeric: true }],
        rows: [
          ['Cash in Hand', 'Main Cash Account', formatPKR(cash)],
          ['HBL Business Account', 'Habib Bank Limited', formatPKR(naturalBalance(ds, '1010', { end: ds.demoToday }))],
          ['Meezan Business Account', 'Meezan Bank Limited', formatPKR(naturalBalance(ds, '1020', { end: ds.demoToday }))],
        ],
      },
      links: [{ label: 'Bank accounts', to: '/banks' }],
    };
  }

  if ((/\b(bank|hbl|meezan)\b/.test(t) || /(بینک|ایچ بی ایل|میزان)/.test(t)) && (/\b(balance|kitna|how much|batao)\b/.test(t) || /(بیلنس|کتنا|کتنے|بتاؤ)/.test(t))) {
    const bank = sumAccounts(ds, BANK_ACCOUNTS, { end: ds.demoToday });
    return {
      intent: 'finance.bank', intentLabel: 'Finance · Bank balance', module: 'Banks',
      language,
      text: ur
        ? `Bank accounts ka total balance **${formatPKR(bank)}** hai.`
        : `Total bank balance across HBL and Meezan is **${formatPKR(bank)}**.`,
      metrics: [
        { label: 'HBL', value: formatPKR(naturalBalance(ds, '1010', { end: ds.demoToday })) },
        { label: 'Meezan', value: formatPKR(naturalBalance(ds, '1020', { end: ds.demoToday })) },
        { label: 'Total', value: formatPKR(bank) },
      ],
      links: [{ label: 'Bank accounts', to: '/banks' }],
    };
  }

  /* ---------------- expenses ---------------- */
  if (
    (/\b(expense|expenses|kharcha|kharchay|spending)\b/.test(t) || /(اخراجات|خرچے|خرچہ|ایکسپینس)/.test(t)) &&
    // "monthly revenue and expenses" is a trend request, not a single-period total
    !TREND_HINT.test(t)
  ) {
    const pl = profitAndLoss(ds, period.start, period.end);
    const top = [...pl.operatingExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
    return {
      intent: 'finance.expenses', intentLabel: 'Finance · Expenses', module: 'Expenses',
      language,
      text: ur
        ? `${period.label} mein total operating expenses **${formatPKR(pl.totalOperatingExpenses)}** hain. Sab se bara kharcha ${top[0] ? `${top[0].account.name} (${formatPKR(top[0].amount)})` : 'koi nahi'}.`
        : `Total operating expenses for **${period.label}** are **${formatPKR(pl.totalOperatingExpenses)}**. The largest head is ${top[0] ? `${top[0].account.name} at ${formatPKR(top[0].amount)}` : 'none recorded'}.`,
      metrics: [
        { label: 'Operating expenses', value: formatPKR(pl.totalOperatingExpenses) },
        { label: 'Cost of sales', value: formatPKR(pl.totalCostOfSales) },
        { label: 'Total outflow', value: formatPKR(pl.totalOperatingExpenses + pl.totalCostOfSales) },
      ],
      table: {
        title: 'Expense breakdown',
        columns: [{ label: 'Head' }, { label: 'Amount', numeric: true }, { label: '% of opex', numeric: true }],
        rows: top.map((r) => [
          r.account.name,
          formatPKR(r.amount),
          `${pl.totalOperatingExpenses ? ((r.amount / pl.totalOperatingExpenses) * 100).toFixed(1) : '0'}%`,
        ]),
      },
      links: [{ label: 'Expenses & Income', to: '/income-expenses' }, { label: 'Reports', to: '/reports' }],
      periodLabel: `${formatDate(period.start)} → ${formatDate(period.end)}`,
    };
  }

  /* ---------------- sales ---------------- */
  if ((/\b(sales|sale|revenue|bikri|turnover)\b/.test(t) || /(سیلز|سیل|فروخت|ریونیو|آمدنی)/.test(t)) && !TREND_HINT.test(t)) {
    const pl = profitAndLoss(ds, period.start, period.end);
    const byType = ds.entries.filter((e) => e.type === 'sales' && e.date >= period.start && e.date <= period.end);
    const cashSales = naturalBalance(ds, '1000', { start: period.start, end: period.end });
    return {
      intent: 'finance.sales', intentLabel: 'Finance · Sales', module: 'Dashboard',
      language,
      text: ur
        ? `${period.label} ki total sales **${formatPKR(pl.totalRevenue)}** hain (${byType.length} invoices). Gross profit ${formatPKR(pl.grossProfit)} hai.`
        : `Total sales for **${period.label}** are **${formatPKR(pl.totalRevenue)}** across ${byType.length} invoices, with a gross profit of ${formatPKR(pl.grossProfit)}.`,
      metrics: [
        { label: 'Total sales', value: formatPKR(pl.totalRevenue) },
        { label: 'Invoices', value: String(byType.length) },
        { label: 'Gross profit', value: formatPKR(pl.grossProfit), hint: `${pl.grossMarginPct.toFixed(1)}% GM` },
        { label: 'Receivables', value: formatPKR(naturalBalance(ds, '1100', { end: ds.demoToday })) },
      ],
      links: [{ label: 'Dashboard', to: '/' }, { label: 'Transactions', to: '/transactions' }],
      periodLabel: `${formatDate(period.start)} → ${formatDate(period.end)}`,
    };
  }

  /* ---------------- last N transactions ---------------- */
  if ((/\b(transactions?|entries|vouchers?|recent)\b/.test(t) || /(ٹرانزیکشنز?|اندراجات|واؤچرز?|لین دین)/.test(t)) && (/\b(show|list|last|recent|dikhao|batao)\b/.test(t) || /(دکھاؤ|بتاؤ|آخری|فہرست)/.test(t))) {
    const nMatch = t.match(/\b(\d{1,2})\b/);
    const n = nMatch ? Math.min(25, Math.max(1, Number(nMatch[1]))) : (/(دس|10)/.test(t) ? 10 : 10);
    const rows = [...ds.entries]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)))
      .slice(0, n);
    return {
      intent: 'accounting.transactions', intentLabel: 'Accounting · Recent transactions', module: 'Transactions',
      language,
      text: ur
        ? `Akhri ${n} transactions ye hain. Har entry double-entry hai — debit aur credit barabar hain.`
        : `Here are the last ${n} posted transactions. Each one is a balanced double-entry voucher.`,
      table: {
        title: `Last ${n} transactions`,
        columns: [{ label: 'Date' }, { label: 'Reference' }, { label: 'Type' }, { label: 'Description' }, { label: 'Amount', numeric: true }],
        rows: rows.map((e) => [formatDate(e.date), e.reference, TYPE_LABELS[e.type], e.description, formatPKR(entryAmount(e))]),
      },
      links: [{ label: 'All transactions', to: '/transactions' }],
    };
  }

  /* ---------------- monthly revenue vs expenses ---------------- */
  if (/\b(monthly|month wise|month-wise|trend|revenue and expenses|comparison)\b/.test(t) || /(ماہانہ|ماہ بہ ماہ|رجحان)/.test(t)) {
    const range = buildRange('year', ds.demoToday);
    const points = monthlySeries(ds, range.start, range.end);
    return {
      intent: 'finance.monthly_trend', intentLabel: 'Finance · Monthly trend', module: 'Dashboard',
      language,
      text: ur
        ? `Is financial year ka month-wise revenue aur expenses neeche hai. Total revenue ${formatPKR(points.reduce((s, p) => s + p.revenue, 0))} aur total expenses ${formatPKR(points.reduce((s, p) => s + p.cogs + p.expenses, 0))}.`
        : `Month-wise revenue and expenses for the current financial year. Total revenue ${formatPKR(points.reduce((s, p) => s + p.revenue, 0))}, total expenses ${formatPKR(points.reduce((s, p) => s + p.cogs + p.expenses, 0))}.`,
      table: {
        title: 'Monthly revenue vs expenses',
        columns: [{ label: 'Month' }, { label: 'Revenue', numeric: true }, { label: 'Expenses', numeric: true }, { label: 'Profit', numeric: true }],
        rows: points.map((p) => [p.label, formatPKR(p.revenue), formatPKR(p.cogs + p.expenses), formatPKR(p.profit)]),
      },
      links: [{ label: 'Dashboard charts', to: '/' }, { label: 'P&L report', to: '/reports' }],
    };
  }

  /* ---------------- receivables ---------------- */
  if (/\b(receivable|receivables|lena|wasooli|collection|outstanding from customers)\b/.test(t) || /(وصولی|لینی ہے|لینا ہے)/.test(t)) {
    const customers = ds.parties.filter((p) => p.type === 'customer')
      .map((p) => ({ p, b: partyBalance(ds, p.id) }))
      .filter((x) => x.b.side === 'receivable')
      .sort((a, b) => b.b.balance - a.b.balance);
    const total = customers.reduce((s, c) => s + c.b.balance, 0);
    return {
      intent: 'finance.receivables', intentLabel: 'Finance · Receivables', module: 'Parties',
      language,
      text: ur
        ? `Customers se total **${formatPKR(total)}** receivable hain. Sab se bara ${customers[0]?.p.name ?? '—'} (${formatPKR(customers[0]?.b.balance ?? 0)}).`
        : `Customers owe **${formatPKR(total)}** in total. The largest balance is ${customers[0]?.p.name ?? '—'} at ${formatPKR(customers[0]?.b.balance ?? 0)}.`,
      metrics: [
        { label: 'Total receivable', value: formatPKR(total) },
        { label: 'Customers with balance', value: String(customers.length) },
        { label: 'Control account 1100', value: formatPKR(naturalBalance(ds, '1100', { end: ds.demoToday })) },
      ],
      table: {
        title: 'Receivable by customer',
        columns: [{ label: 'Customer' }, { label: 'Terms' }, { label: 'Balance', numeric: true }],
        rows: customers.map((c) => [c.p.name, c.p.paymentTerms, formatPKR(c.b.balance)]),
      },
      links: [{ label: 'Parties', to: '/parties' }],
    };
  }

  /* ---------------- payables ---------------- */
  if (/\b(payable|payables|dena|supplier balance)\b/.test(t) || /(سپلائرز|دینا ہے|ادائیگی)/.test(t)) {
    const suppliers = ds.parties.filter((p) => p.type === 'supplier')
      .map((p) => ({ p, b: partyBalance(ds, p.id) }))
      .filter((x) => x.b.side === 'payable')
      .sort((a, b) => b.b.balance - a.b.balance);
    const total = suppliers.reduce((s, c) => s + c.b.balance, 0);
    return {
      intent: 'finance.payables', intentLabel: 'Finance · Payables', module: 'Parties',
      language,
      text: ur
        ? `Suppliers ko total **${formatPKR(total)}** dena hai. Sab se zyada ${suppliers[0]?.p.name ?? '—'} ko (${formatPKR(suppliers[0]?.b.balance ?? 0)}).`
        : `Suppliers are owed **${formatPKR(total)}** in total. The largest is ${suppliers[0]?.p.name ?? '—'} at ${formatPKR(suppliers[0]?.b.balance ?? 0)}.`,
      metrics: [
        { label: 'Total payable', value: formatPKR(total) },
        { label: 'Suppliers with balance', value: String(suppliers.length) },
        { label: 'Control account 2000', value: formatPKR(naturalBalance(ds, '2000', { end: ds.demoToday })) },
      ],
      table: {
        title: 'Payable by supplier',
        columns: [{ label: 'Supplier' }, { label: 'Terms' }, { label: 'Balance', numeric: true }],
        rows: suppliers.map((c) => [c.p.name, c.p.paymentTerms, formatPKR(c.b.balance)]),
      },
      links: [{ label: 'Parties', to: '/parties' }],
    };
  }

  /* ---------------- top customers ---------------- */
  if ((/\b(top|best|largest|biggest)\b/.test(t) || /(ٹاپ|بہترین|سب سے بڑے)/.test(t)) && (/\b(customers?|clients?)\b/.test(t) || /(کسٹمرز?|گاہک)/.test(t))) {
    const range = buildRange('year', ds.demoToday);
    const totals = new Map<string, number>();
    for (const e of ds.entries) {
      if (e.type !== 'sales' || e.date < range.start || e.date > range.end) continue;
      const partyId = e.lines.find((l) => l.partyId)?.partyId;
      if (!partyId) continue;
      const rev = e.lines.filter((l) => l.accountId === '4000').reduce((s, l) => s + l.credit, 0);
      totals.set(partyId, (totals.get(partyId) ?? 0) + rev);
    }
    const rows = [...totals.entries()]
      .map(([id, value]) => ({ name: ds.parties.find((p) => p.id === id)?.name ?? id, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return {
      intent: 'finance.top_customers', intentLabel: 'Finance · Top customers', module: 'Dashboard',
      language,
      text: ur
        ? `Is financial year ke top customers ye hain. ${rows[0]?.name} sab se aage hain ${formatPKR(rows[0]?.value ?? 0)} ke saath.`
        : `Top customers this financial year. ${rows[0]?.name} leads with ${formatPKR(rows[0]?.value ?? 0)} in sales.`,
      table: {
        title: 'Top 5 customers by sales',
        columns: [{ label: '#', numeric: true }, { label: 'Customer' }, { label: 'Sales', numeric: true }],
        rows: rows.map((r, i) => [i + 1, r.name, formatPKR(r.value)]),
      },
      links: [{ label: 'Dashboard', to: '/' }],
    };
  }

  /* ---------------- foreign currency: USD ---------------- */
  if (/\b(usd|dollar|dollars|ڈالر)\b/.test(t) && (/\b(balance|kitna|available|rate|cost|paas|holdings?)\b/.test(t) || /(بیلنس|کتنا|کتنے|موجود|ریٹ)/.test(t))) {
    const balances = computeFxBalances(ds.fxTransactions ?? []);
    const usd = balances.USD;
    return {
      intent: 'forex.usd_balance', intentLabel: 'Forex · USD Balance', module: 'Currency Exchange',
      language,
      text: ur
        ? `Aap ke paas **${formatFxAmount(usd.availableBalance, 'USD')}** available hain. Weighted Average Cost **${formatFxRate(usd.weightedAvgCostRate, 'USD')}** hai, jis ki total PKR value **${formatPKR(usd.totalPKRInvested)}** hai.`
        : `You have **${formatFxAmount(usd.availableBalance, 'USD')}** available. The Weighted Average Cost is **${formatFxRate(usd.weightedAvgCostRate, 'USD')}**, with a total invested value of **${formatPKR(usd.totalPKRInvested)}**.`,
      metrics: [
        { label: 'Available USD', value: formatFxAmount(usd.availableBalance, 'USD') },
        { label: 'Weighted Avg Cost', value: formatFxRate(usd.weightedAvgCostRate, 'USD') },
        { label: 'Total Invested (PKR)', value: formatPKR(usd.totalPKRInvested) },
        { label: 'Realized P&L (PKR)', value: `${usd.totalRealizedProfitLossPKR >= 0 ? '+' : ''}${formatPKR(usd.totalRealizedProfitLossPKR)}` },
      ],
      links: [{ label: 'Forex Desk', to: '/currency-exchange' }, { label: 'Currency Reports', to: '/currency-reports' }],
    };
  }

  /* ---------------- foreign currency: AED / Dirham ---------------- */
  if (/\b(aed|dirham|dirhams|درہم)\b/.test(t) && (/\b(balance|kitna|available|rate|cost|purchase|holdings?)\b/.test(t) || /(بیلنس|کتنا|کتنے|موجود|ریٹ|خرید)/.test(t))) {
    const balances = computeFxBalances(ds.fxTransactions ?? []);
    const aed = balances.AED;
    return {
      intent: 'forex.aed_balance', intentLabel: 'Forex · AED Balance', module: 'Currency Exchange',
      language,
      text: ur
        ? `Aap ke paas **${formatFxAmount(aed.availableBalance, 'AED')}** available hain. Weighted Average Cost **${formatFxRate(aed.weightedAvgCostRate, 'AED')}** hai (Total PKR: **${formatPKR(aed.totalPKRInvested)}**).`
        : `You have **${formatFxAmount(aed.availableBalance, 'AED')}** available at a Weighted Average Cost of **${formatFxRate(aed.weightedAvgCostRate, 'AED')}** (Total PKR: **${formatPKR(aed.totalPKRInvested)}**).`,
      metrics: [
        { label: 'Available AED', value: formatFxAmount(aed.availableBalance, 'AED') },
        { label: 'Weighted Avg Cost', value: formatFxRate(aed.weightedAvgCostRate, 'AED') },
        { label: 'Total Invested (PKR)', value: formatPKR(aed.totalPKRInvested) },
        { label: 'Total Purchased', value: formatFxAmount(aed.totalPurchased, 'AED') },
      ],
      links: [{ label: 'Forex Desk', to: '/currency-exchange' }, { label: 'Currency Reports', to: '/currency-reports' }],
    };
  }

  /* ---------------- foreign currency: Iranian Rial (IRR vs Toman) ---------------- */
  if (/\b(irr|rial|rials|iran|iranian|toman|ریال|ایرانی|تومان)\b/.test(t)) {
    const balances = computeFxBalances(ds.fxTransactions ?? []);
    const irr = balances.IRR;
    return {
      intent: 'forex.irr_balance', intentLabel: 'Forex · Iranian Rial Balance', module: 'Currency Exchange',
      language,
      text: ur
        ? `Iranian currency ka current balance **${formatFxAmount(irr.availableBalance, 'IRR')}** hai. Note: Demo records official ISO Iranian Rial (IRR) mein hain (0 decimals), Toman mein nahi (1 Toman = 10 IRR). Weighted Average Cost: ${formatFxRate(irr.weightedAvgCostRate, 'IRR')}.`
        : `Current Iranian currency holding is **${formatFxAmount(irr.availableBalance, 'IRR')}**. Note: All entries reflect official ISO Iranian Rial (IRR) with 0 decimals, NOT Toman (1 Toman = 10 IRR). Weighted Average Cost: ${formatFxRate(irr.weightedAvgCostRate, 'IRR')}.`,
      metrics: [
        { label: 'Available IRR', value: formatFxAmount(irr.availableBalance, 'IRR') },
        { label: 'Standard', value: 'ISO IRR (0 decimals)' },
        { label: 'Conversion Note', value: '1 Toman = 10 IRR' },
        { label: 'Weighted Avg Cost', value: formatFxRate(irr.weightedAvgCostRate, 'IRR') },
        { label: 'Total PKR Basis', value: formatPKR(irr.totalPKRInvested) },
      ],
      links: [{ label: 'Forex Desk', to: '/currency-exchange' }, { label: 'Currency Reports', to: '/currency-reports' }],
    };
  }

  /* ---------------- foreign currency: Realized Exchange P&L ---------------- */
  if ((/\b(forex|currency|exchange|tabadla)\b/.test(t) || /(فاریکس|کرنسی|تبادلہ)/.test(t)) && (/\b(profit|gain|loss|pnl|munafa|kamai)\b/.test(t) || /(منافع|نفع|آمدن)/.test(t))) {
    const balances = computeFxBalances(ds.fxTransactions ?? []);
    let totalRealized = 0;
    for (const b of Object.values(balances)) {
      totalRealized += b.totalRealizedProfitLossPKR;
    }
    const isProfit = totalRealized >= 0;
    return {
      intent: 'forex.profit', intentLabel: 'Forex · Realized Gain/Loss', module: 'Currency Reports',
      language,
      text: ur
        ? `Foreign currency trading se ab tak ka realized net profit **${formatPKR(totalRealized)}** hai. Ye Weighted Average Cost (WAC) formula ke mutabiq sales par calculate kiya gaya hai.`
        : `Cumulative realized currency exchange ${isProfit ? 'profit' : 'loss'} is **${formatPKR(totalRealized)}**, calculated strictly using the Weighted Average Cost (WAC) method on currency disposals.`,
      metrics: [
        { label: 'Realized Forex Gain/Loss', value: `${isProfit ? '+' : ''}${formatPKR(totalRealized)}` },
        { label: 'USD Realized P&L', value: formatPKR(balances.USD.totalRealizedProfitLossPKR) },
        { label: 'AED Realized P&L', value: formatPKR(balances.AED.totalRealizedProfitLossPKR) },
        { label: 'IRR Realized P&L', value: formatPKR(balances.IRR.totalRealizedProfitLossPKR) },
      ],
      links: [{ label: 'Currency Reports', to: '/currency-reports' }, { label: 'Forex Desk', to: '/currency-exchange' }],
    };
  }

  /* ---------------- inter-warehouse stock transfers ---------------- */
  if (/\b(transfer|transfers|muntaqil|bheja|bheji)\b/.test(t) && (/\b(stock|goods|maal|warehouse|dubai|lahore|karachi)\b/.test(t) || /(منتقل|ٹرانسفر|مال|اسٹاک)/.test(t))) {
    const transfers = ds.stockTransfers ?? [];
    const inTransit = transfers.filter((t) => t.status === 'in_transit');
    return {
      intent: 'trade.stock_transfers', intentLabel: 'Trade · Stock Transfers', module: 'Stock Transfers',
      language,
      text: ur
        ? `Total **${transfers.length}** stock transfers record hue hain, jin mein se **${inTransit.length}** in-transit hain. Destination par stock sirf verified physical receipt ke baad add hota hai.`
        : `There are **${transfers.length}** recorded stock transfers, with **${inTransit.length}** currently in transit. Stock is only added to the destination after verified physical receipt.`,
      metrics: [
        { label: 'Total Transfers', value: String(transfers.length) },
        { label: 'Currently In Transit', value: String(inTransit.length) },
        { label: 'Completed Transfers', value: String(transfers.filter((t) => t.status === 'received').length) },
      ],
      table: {
        title: 'Recent Inter-Warehouse Transfers',
        columns: [{ label: 'Ref' }, { label: 'Product' }, { label: 'From' }, { label: 'To' }, { label: 'Qty' }, { label: 'Status' }],
        rows: transfers.map((t) => [t.reference, t.productName, t.sourceLocationName, t.destinationLocationName, `${t.quantity} ${t.unit}`, t.status.toUpperCase()]),
      },
      links: [{ label: 'Stock Transfers', to: '/stock-transfers' }],
    };
  }

  /* ---------------- warehouse stock / location stock ---------------- */
  if (/\b(warehouse|godam|location|karachi warehouse|dubai warehouse|lahore warehouse|main warehouse)\b/.test(t) || /(گودام|ویئرہاؤس)/.test(t)) {
    let targetWh = ds.warehouses?.find((w) => t.includes(w.name.toLowerCase()) || t.includes(w.city.toLowerCase()));
    if (!targetWh && (t.includes('karachi') || t.includes('کراچی'))) {
      targetWh = ds.warehouses?.find((w) => w.id === 'LOC-KHI-PORT' || w.id === 'LOC-MAIN');
    }
    if (!targetWh && (t.includes('dubai') || t.includes('دبئی'))) {
      targetWh = ds.warehouses?.find((w) => w.id === 'LOC-DXB');
    }
    if (!targetWh && (t.includes('lahore') || t.includes('لاہور'))) {
      targetWh = ds.warehouses?.find((w) => w.id === 'LOC-LHR');
    }

    if (targetWh) {
      let totalAvail = 0;
      let totalRsvd = 0;
      const rows: (string | number)[][] = [];
      for (const p of ds.inventory ?? []) {
        const loc = p.locations[targetWh.id] || { available: 0, reserved: 0 };
        totalAvail += loc.available;
        totalRsvd += loc.reserved;
        if (loc.available > 0 || loc.reserved > 0) {
          rows.push([p.name, p.sku, `${loc.available} ${p.unit}`, `${loc.reserved} ${p.unit}`]);
        }
      }
      return {
        intent: 'trade.warehouse_stock', intentLabel: 'Trade · Warehouse Stock', module: 'Inventory',
        language,
        text: ur
          ? `**${targetWh.name}** (${targetWh.city}) mein total **${totalAvail.toLocaleString()} units** available stock hai (aur ${totalRsvd.toLocaleString()} reserved).`
          : `**${targetWh.name}** (${targetWh.city}) currently holds **${totalAvail.toLocaleString()} available units** (and ${totalRsvd.toLocaleString()} reserved).`,
        metrics: [
          { label: 'Warehouse', value: targetWh.name },
          { label: 'Available Stock', value: totalAvail.toLocaleString() },
          { label: 'Reserved Stock', value: totalRsvd.toLocaleString() },
          { label: 'Facility City', value: targetWh.city },
        ],
        table: {
          title: `Stock at ${targetWh.name}`,
          columns: [{ label: 'Product' }, { label: 'SKU' }, { label: 'Available' }, { label: 'Reserved' }],
          rows,
        },
        links: [{ label: 'Inventory Matrix', to: '/inventory' }, { label: 'Stock Transfers', to: '/stock-transfers' }],
      };
    }

    const totalValuation = calculateTotalInventoryValuation(ds.inventory ?? []);
    return {
      intent: 'trade.all_warehouses', intentLabel: 'Trade · All Warehouses', module: 'Inventory',
      language,
      text: ur
        ? `Humare paas 4 warehouses hain (Main, Karachi Port, Dubai, Lahore). Consolidated stock valuation **${formatPKR(totalValuation)}** hai.`
        : `We operate 4 demonstration facilities (Main, Karachi Port, Dubai, Lahore) with a total inventory valuation of **${formatPKR(totalValuation)}**.`,
      metrics: [
        { label: 'Total Valuation', value: formatPKR(totalValuation) },
        { label: 'Active Warehouses', value: String(ds.warehouses?.length ?? 4) },
        { label: 'Products Tracked', value: String(ds.inventory?.length ?? 0) },
      ],
      links: [{ label: 'Location Matrix', to: '/inventory' }, { label: 'Stock Transfers', to: '/stock-transfers' }],
    };
  }

  /* ---------------- low stock alerts ---------------- */
  if (/\b(low stock|reorder|kam stock|khatam|danger level)\b/.test(t) || /(کم سٹاک|ری آرڈر|خاتمہ)/.test(t)) {
    const low = (ds.inventory ?? []).filter(isLowStock);
    return {
      intent: 'trade.low_stock', intentLabel: 'Trade · Low Stock Reorder', module: 'Inventory',
      language,
      text: ur
        ? low.length > 0
          ? `**${low.length}** products low stock safety limit par hain: ${low.map((p) => p.name).join(', ')}. In ko reorder karna zaroori hai.`
          : 'Tamam products ka stock safe reorder level se upar hai.'
        : low.length > 0
          ? `There are **${low.length}** items at or below safety reorder levels: ${low.map((p) => p.name).join(', ')}.`
          : 'All inventory items are currently above their safety replenishment thresholds.',
      metrics: [
        { label: 'Low Stock Items', value: String(low.length) },
        { label: 'Total Products', value: String(ds.inventory?.length ?? 0) },
      ],
      table: {
        title: 'Low Stock Items Requiring Reorder',
        columns: [{ label: 'Product' }, { label: 'SKU' }, { label: 'Available' }, { label: 'Min Level' }, { label: 'Unit' }],
        rows: low.map((p) => {
          const s = getProductTotalStock(p);
          return [p.name, p.sku, s.available, p.minStockLevel, p.unit];
        }),
      },
      links: [{ label: 'Inventory Management', to: '/inventory' }, { label: 'Record Import', to: '/imports' }],
    };
  }

  /* ---------------- import shipments ---------------- */
  if (/\b(import|imports|baramad|dar-amad|daramad|bahr se mangwaya)\b/.test(t) || /(درآمد|امپورٹ|درآمدات)/.test(t)) {
    const imports = ds.imports ?? [];
    const totalLanded = imports.reduce((acc, s) => acc + s.totalLandedCostPKR, 0);
    const inTransit = imports.filter((s) => s.status === 'in_transit' || s.status === 'ordered');
    return {
      intent: 'trade.imports', intentLabel: 'Trade · Import Shipments', module: 'Imports',
      language,
      text: ur
        ? `Total **${imports.length}** import shipments hain, jin ki total landed cost **${formatPKR(totalLanded)}** hai. **${inTransit.length}** shipments currently active/in-transit hain.`
        : `Total **${imports.length}** import consignments recorded with a total landed cost of **${formatPKR(totalLanded)}**. **${inTransit.length}** shipments are active or in transit.`,
      metrics: [
        { label: 'Total Landed Imports', value: formatPKR(totalLanded) },
        { label: 'Total Shipments', value: String(imports.length) },
        { label: 'In Transit / Ordered', value: String(inTransit.length) },
        { label: 'Customs & Port Duties', value: formatPKR(imports.reduce((acc, s) => acc + s.customsChargesPKR, 0)) },
      ],
      table: {
        title: 'Import Consignments',
        columns: [{ label: 'Ref' }, { label: 'Supplier' }, { label: 'Product' }, { label: 'Foreign Val' }, { label: 'Landed (PKR)' }, { label: 'Status' }],
        rows: imports.map((s) => [s.reference, s.supplierName, s.productName, formatFxAmount(s.totalPurchaseAmountForeign, s.currency), formatPKR(s.totalLandedCostPKR), s.status.toUpperCase()]),
      },
      links: [{ label: 'Import Management', to: '/imports' }],
    };
  }

  /* ---------------- export shipments ---------------- */
  if (/\b(export|exports|baramad|baramadad|bheja bahr|bahir bheja)\b/.test(t) || /(برآمد|ایکسپورٹ|برآمدات)/.test(t)) {
    const exports = ds.exports ?? [];
    const totalSales = exports.reduce((acc, s) => acc + s.totalSaleAmountPKR, 0);
    const dispatched = exports.filter((s) => s.status === 'dispatched' || s.status === 'ready_for_dispatch');
    return {
      intent: 'trade.exports', intentLabel: 'Trade · Export Shipments', module: 'Exports',
      language,
      text: ur
        ? `Total **${exports.length}** export consignments hain, jin ki total sale value **${formatPKR(totalSales)}** hai. **${dispatched.length}** consignments active dispatch stage par hain.`
        : `Total **${exports.length}** commercial export contracts recorded with a total value of **${formatPKR(totalSales)}**. **${dispatched.length}** shipments are currently active.`,
      metrics: [
        { label: 'Total Export Sales', value: formatPKR(totalSales) },
        { label: 'Total Consignments', value: String(exports.length) },
        { label: 'Active Dispatches', value: String(dispatched.length) },
        { label: 'Delivered', value: String(exports.filter((s) => s.status === 'delivered').length) },
      ],
      table: {
        title: 'Export Consignments',
        columns: [{ label: 'Ref' }, { label: 'Customer' }, { label: 'Destination' }, { label: 'Product' }, { label: 'Value (PKR)' }, { label: 'Status' }],
        rows: exports.map((s) => [s.reference, s.customerName, s.destinationCountry, s.productName, formatPKR(s.totalSaleAmountPKR), s.status.toUpperCase()]),
      },
      links: [{ label: 'Export Management', to: '/exports' }],
    };
  }

  /* ---------------- inventory ---------------- */
  if (/\b(inventory|stock|maal)\b/.test(t) || /(انونٹری|سٹاک|مال)/.test(t)) {
    const inv = naturalBalance(ds, '1200', { end: ds.demoToday });
    const purchases = ds.entries.filter((e) => e.type === 'purchase' && e.date >= buildRange('year', ds.demoToday).start)
      .reduce((s, e) => s + entryAmount(e), 0);
    return {
      intent: 'finance.inventory', intentLabel: 'Finance · Inventory', module: 'Dashboard',
      language,
      text: ur
        ? `Inventory ki current value **${formatPKR(inv)}** hai. Is financial year mein purchases ${formatPKR(purchases)} hui hain.`
        : `Current inventory value is **${formatPKR(inv)}**, against ${formatPKR(purchases)} of purchases this financial year.`,
      metrics: [
        { label: 'Inventory value', value: formatPKR(inv) },
        { label: 'Purchases (FY)', value: formatPKR(purchases) },
      ],
      links: [{ label: 'Chart of accounts', to: '/chart-of-accounts' }],
    };
  }

  /* ---------------- trial balance / integrity ---------------- */
  if (/\b(trial balance|balance sheet|reconcil|integrity|balanced|audit)\b/.test(t) || /(ٹرائل بیلنس|بیلنس شیٹ|حساب کتاب|آڈٹ)/.test(t)) {
    const tb = trialBalance(ds, ds.demoToday);
    const bs = balanceSheet(ds, ds.demoToday);
    return {
      intent: 'accounting.integrity', intentLabel: 'Accounting · Books health', module: 'Reports',
      language,
      text: ur
        ? `Books check: trial balance ${tb.balanced ? 'balanced hai' : 'balanced nahi'} — debit ${formatPKR(tb.totalDebit)}, credit ${formatPKR(tb.totalCredit)}. Balance sheet ${bs.balanced ? 'bhi balance hai' : 'balance nahi'}.`
        : `Books check: the trial balance is ${tb.balanced ? 'balanced' : 'NOT balanced'} — debits ${formatPKR(tb.totalDebit)} vs credits ${formatPKR(tb.totalCredit)}. The balance sheet is ${bs.balanced ? 'also in balance' : 'NOT in balance'} (assets ${formatPKR(bs.totalAssets)} vs liabilities + equity ${formatPKR(bs.totalLiabilities + bs.totalEquity)}).`,
      metrics: [
        { label: 'Trial balance', value: tb.balanced ? 'Balanced' : 'Out of balance' },
        { label: 'Total debits', value: formatPKR(tb.totalDebit) },
        { label: 'Total credits', value: formatPKR(tb.totalCredit) },
        { label: 'Assets', value: formatPKR(bs.totalAssets) },
        { label: 'Liabilities + Equity', value: formatPKR(bs.totalLiabilities + bs.totalEquity) },
      ],
      links: [{ label: 'Trial balance report', to: '/reports' }],
    };
  }

  /* ---------------- help / fallback ---------------- */
  const capabilities = ur
    ? 'Main in cheezon mein madad kar sakta hoon:\n• Sales, profit aur expenses ke jawab\n• Foreign currency balances (USD, AED, IRR)\n• Warehouse stock & inter-warehouse transfers\n• Import aur export consignments\n• Kisi party ka ledger\n• Cash aur bank balances\n• Payment/receipt draft banana (approval ke sath)\n• Last transactions ki list'
    : 'I can help with:\n• Sales, profit and expense questions\n• Foreign currency holdings (USD, AED, IRR) and realized Forex P&L\n• Multi-warehouse inventory balances & stock transfers\n• Import and export shipment registers\n• Any party ledger or outstanding balance\n• Cash and bank positions\n• Drafting a payment or receipt for approval\n• Recent transaction lists';
  return {
    intent: 'assistant.help', intentLabel: 'Assistant · Guidance', module: 'AI',
    language,
    text: `${ur ? 'Main samajh nahi paya. ' : 'I could not match that command to a module. '}${capabilities}\n\n${ur ? 'Misal: "Mere paas kitna dollar available hai?" ya "Karachi warehouse mein kitna stock hai?".' : 'Try: "How much USD balance do we have?" or "Show me the last 10 transactions".'}`,
    links: [{ label: 'AI Command Center', to: '/ai' }, { label: 'Dashboard', to: '/' }],
  };
}

/* ------------------------------------------------------------------ */
/* suggested prompts                                                   */
/* ------------------------------------------------------------------ */
export interface SuggestedPrompt { text: string; label: string; sub: string; lang: 'en' | 'roman-urdu' }

export const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { text: 'Aaj ki total sales kitni hain?', label: 'Aaj ki total sales kitni hain?', sub: 'Roman Urdu · Sales today', lang: 'roman-urdu' },
  { text: 'Ahmed ka ledger dikhao.', label: 'Ahmed ka ledger dikhao.', sub: 'Roman Urdu · Party ledger', lang: 'roman-urdu' },
  { text: 'Is month ka profit calculate karo.', label: 'Is month ka profit calculate karo.', sub: 'Roman Urdu · Profit', lang: 'roman-urdu' },
  { text: 'Business ka current cash balance batao.', label: 'Business ka current cash balance batao.', sub: 'Roman Urdu · Cash position', lang: 'roman-urdu' },
  { text: 'Aaj ki expenses ki report banao.', label: 'Aaj ki expenses ki report banao.', sub: 'Roman Urdu · Expenses today', lang: 'roman-urdu' },
  { text: 'Ali Traders ko kitni payment deni hai?', label: 'Ali Traders ko kitni payment deni hai?', sub: 'Roman Urdu · Payable', lang: 'roman-urdu' },
  { text: 'Show me the last 10 transactions.', label: 'Show me the last 10 transactions.', sub: 'English · Recent activity', lang: 'en' },
  { text: 'Prepare a payment of Rs. 25,000 to ABC Traders.', label: 'Prepare a payment of Rs. 25,000 to ABC Traders.', sub: 'English · Draft action', lang: 'en' },
  { text: 'Show monthly revenue and expenses.', label: 'Show monthly revenue and expenses.', sub: 'English · Monthly trend', lang: 'en' },
  { text: 'What is the total receivable from customers?', label: 'What is the total receivable from customers?', sub: 'English · Receivables', lang: 'en' },
  { text: 'Check whether the books are balanced.', label: 'Check whether the books are balanced.', sub: 'English · Books health', lang: 'en' },
  { text: 'Top customers is saal ke kaun hain?', label: 'Top customers is saal ke kaun hain?', sub: 'Roman Urdu · Top customers', lang: 'roman-urdu' },
];

export const TRADE_CURRENCY_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  { text: 'Mere paas kitna dollar available hai?', label: 'Mere paas kitna dollar available hai?', sub: 'Roman Urdu · USD Forex Holdings', lang: 'roman-urdu' },
  { text: 'Karachi warehouse mein kitna stock hai?', label: 'Karachi warehouse mein kitna stock hai?', sub: 'Roman Urdu · Warehouse Stock', lang: 'roman-urdu' },
  { text: 'Iranian currency ka current balance kya hai?', label: 'Iranian currency ka current balance kya hai?', sub: 'Roman Urdu · Iranian Rial (IRR)', lang: 'roman-urdu' },
  { text: 'Is month ka currency exchange profit kitna hai?', label: 'Is month ka currency exchange profit kitna hai?', sub: 'Roman Urdu · Realized Forex P&L', lang: 'roman-urdu' },
  { text: 'Total import value kitni hai?', label: 'Total import value kitni hai?', sub: 'Roman Urdu · Import Shipments', lang: 'roman-urdu' },
  { text: 'Low stock products ki list dikhao.', label: 'Low stock products ki list dikhao.', sub: 'Roman Urdu · Inventory Reorder', lang: 'roman-urdu' },
  { text: 'Dubai warehouse se Lahore kitna stock transfer hua?', label: 'Dubai warehouse se Lahore kitna stock transfer hua?', sub: 'Roman Urdu · Inter-WH Transfer', lang: 'roman-urdu' },
];

export const CONVERSATION_STARTERS = [
  { q: 'Aaj ki total sales kitni hain?', a: 'Today’s sales are pulled live from the shared demo ledger.' },
  { q: 'Ali Traders ko kitni payment deni hai?', a: 'Reads the supplier ledger and reports the outstanding payable.' },
  { q: 'Prepare a payment of Rs. 25,000 to ABC Traders.', a: 'Creates a draft in Approvals — nothing is posted automatically.' },
];
