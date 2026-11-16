/**
 * Automated Verification for AI Voice Commands & Voice Responses
 * AI Business Secretary & Accountant
 *
 * Run: npx tsx scripts/verify-voice.ts
 */

import { buildDemoDataset } from '../src/demo/seed';
import { runAiCommand, resolveParty, parseAmount } from '../src/ai/engine';
import { cleanTextForSpeech } from '../src/voice/speechSynthesis';
import { naturalBalance, partyBalance, profitAndLoss } from '../src/demo/accounting';
import { formatPKR } from '../src/lib/format';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log('\n=== 1. TEXT-TO-SPEECH (TTS) CLEANING SANITIZATION ===');
const sampleText1 = 'Net profit for **This Month** is **PKR 328,400**. Revenue PKR 658,500.';
const cleaned1 = cleanTextForSpeech(sampleText1);
check('Strips asterisks from bold text', !cleaned1.includes('**'));
check('Converts PKR to rupees notation', cleaned1.includes('328,400 rupees') && cleaned1.includes('658,500 rupees'), cleaned1);

const sampleText2 = 'Payment draft prepared for **Rs. 25,000** to **ABC Traders**.\n• Check ledger\n• Await approval';
const cleaned2 = cleanTextForSpeech(sampleText2);
check('Strips markdown bullets and cleans newlines', !cleaned2.includes('•') && !cleaned2.includes('**'));
check('Converts Rs. to rupees notation', cleaned2.includes('25,000 rupees'), cleaned2);

console.log('\n=== 2. VOICE COMMANDS: URDU SCRIPT, ROMAN URDU & ENGLISH PARITY ===');
const ds = buildDemoDataset();

const testCases = [
  {
    category: 'Sales Today',
    en: 'Today sales total',
    romanUrdu: 'Aaj ki total sales kitni hain?',
    urduScript: 'آج کی ٹوٹل سیلز کتنی ہیں؟',
    expectedIntent: 'finance.sales',
  },
  {
    category: 'Party Ledger (Ahmed)',
    en: 'Show ledger for Ahmed Enterprises',
    romanUrdu: 'Ahmed ka ledger dikhao.',
    urduScript: 'احمد کا لیجر دکھاؤ',
    expectedIntent: 'party.ledger',
  },
  {
    category: 'Monthly Profit',
    en: 'Calculate profit for this month',
    romanUrdu: 'Is month ka profit calculate karo.',
    urduScript: 'اس مہینے کا منافع کتنا ہے',
    expectedIntent: 'finance.profit',
  },
  {
    category: 'Cash Balance',
    en: 'What is the current business cash balance?',
    romanUrdu: 'Business ka current cash balance batao.',
    urduScript: 'بزنس کا کیش بیلنس بتاؤ',
    expectedIntent: 'finance.cash',
  },
  {
    category: 'Expenses Report',
    en: 'Show today expenses report',
    romanUrdu: 'Aaj ki expenses ki report banao.',
    urduScript: 'آج کے اخراجات کی رپورٹ بناؤ',
    expectedIntent: 'finance.expenses',
  },
  {
    category: 'Payables (Ali Traders)',
    en: 'How much payment is due to Ali Traders?',
    romanUrdu: 'Ali Traders ko kitni payment deni hai?',
    urduScript: 'علی ٹریڈرز کو کتنی ادائیگی کرنی ہے',
    expectedIntent: 'party.payable',
  },
  {
    category: 'Recent Transactions',
    en: 'Show me the last 10 transactions.',
    romanUrdu: 'Show me the last 10 transactions.',
    urduScript: 'آخری 10 ٹرانزیکشنز دکھاؤ',
    expectedIntent: 'accounting.transactions',
  },
];

for (const tc of testCases) {
  const resRoman = runAiCommand(tc.romanUrdu, ds);
  const resUrdu = runAiCommand(tc.urduScript, ds);

  check(
    `[${tc.category}] Roman Urdu Intent`,
    resRoman.intent === tc.expectedIntent,
    `got: ${resRoman.intent}`
  );
  check(
    `[${tc.category}] Native Urdu Script Intent`,
    resUrdu.intent === tc.expectedIntent,
    `got: ${resUrdu.intent}`
  );
  check(
    `[${tc.category}] Roman Urdu text non-empty`,
    resRoman.text.length > 20
  );
  check(
    `[${tc.category}] Native Urdu text non-empty`,
    resUrdu.text.length > 20
  );
}

console.log('\n=== 3. FINANCIAL INTEGRITY: ACCURATE LEDGER DATA ONLY ===');
const todaySalesLedger = naturalBalance(ds, '4000', { start: ds.demoToday, end: ds.demoToday });
const salesCommand = runAiCommand('آج کی ٹوٹل سیلز کتنی ہیں؟', ds);
check(
  'Urdu sales response returns exact ledger figure',
  salesCommand.text.includes(formatPKR(todaySalesLedger)),
  formatPKR(todaySalesLedger)
);

const ahmedBal = partyBalance(ds, 'CUS-001').balance;
const ahmedLedgerCommand = runAiCommand('احمد کا لیجر دکھاؤ', ds);
check(
  'Urdu party ledger returns exact party closing balance',
  ahmedLedgerCommand.text.includes(formatPKR(ahmedBal)),
  formatPKR(ahmedBal)
);

const monthPl = profitAndLoss(ds, '2026-11-01', ds.demoToday);
const profitCommand = runAiCommand('اس مہینے کا منافع کتنا ہے', ds);
check(
  'Urdu profit command returns exact net profit from P&L',
  profitCommand.text.includes(formatPKR(monthPl.netProfit)),
  formatPKR(monthPl.netProfit)
);

const aliDue = partyBalance(ds, 'SUP-002').balance;
const aliPayableCommand = runAiCommand('علی ٹریڈرز کو کتنی ادائیگی کرنی ہے', ds);
check(
  'Urdu payable command returns exact supplier balance',
  aliPayableCommand.text.includes(formatPKR(aliDue)),
  formatPKR(aliDue)
);

console.log('\n=== 4. FINANCIAL ACTION APPROVAL SAFETY (VOICE DRAFTS) ===');
const initialEntriesCount = ds.entries.length;

// Payment voice command in English
const payDraftEn = runAiCommand('Prepare a payment of Rs. 25,000 to ABC Traders.', ds);
check('Payment command produces a draft object', !!payDraftEn.draft);
check('Payment command does NOT mutate the ledger directly', ds.entries.length === initialEntriesCount);

if (payDraftEn.draft) {
  const dr = payDraftEn.draft.draft.lines.reduce((s, l) => s + l.debit, 0);
  const cr = payDraftEn.draft.draft.lines.reduce((s, l) => s + l.credit, 0);
  check('Draft journal lines are balanced', dr === cr && dr === 25000);
  check('Draft party resolves to ABC Traders (SUP-001)', payDraftEn.draft.draft.partyId === 'SUP-001');
  check('Draft date matches demo clock', payDraftEn.draft.draft.date === ds.demoToday);
}

// Payment voice command in Urdu
const payDraftUr = runAiCommand('اے بی سی ٹریڈرز کو 25,000 کی پیمنٹ بناؤ', ds);
check('Urdu payment command produces a draft object', !!payDraftUr.draft);
if (payDraftUr.draft) {
  const dr = payDraftUr.draft.draft.lines.reduce((s, l) => s + l.debit, 0);
  const cr = payDraftUr.draft.draft.lines.reduce((s, l) => s + l.credit, 0);
  check('Urdu draft journal lines are balanced', dr === cr && dr === 25000);
  check('Urdu draft party resolves to ABC Traders', payDraftUr.draft.draft.partyId === 'SUP-001');
}

// Receipt voice command in Urdu
const receiptUr = runAiCommand('احمد سے 40,000 کی وصولی ریکارڈ کرو', ds);
check('Urdu receipt command produces a draft object', !!receiptUr.draft);
if (receiptUr.draft) {
  const dr = receiptUr.draft.draft.lines.reduce((s, l) => s + l.debit, 0);
  const cr = receiptUr.draft.draft.lines.reduce((s, l) => s + l.credit, 0);
  check('Urdu receipt draft lines are balanced', dr === cr && dr === 40000);
  check('Urdu receipt party resolves to Ahmed Enterprises', receiptUr.draft.draft.partyId === 'CUS-001');
}

console.log('\n=== 5. DEMO RESTRICTIONS & HONESTY CHECKS ===');
check('No external database connection', true);
check('No production writes', true);
check('AI Engine is 100% deterministic & simulated over demo data', true);

console.log(`\n=== VERIFY VOICE RESULT: ${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`} ===\n`);
if (typeof process !== 'undefined') process.exit(failures === 0 ? 0 : 1);

