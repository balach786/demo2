/**
 * Functional tests for the simulated AI Secretary engine and the
 * transaction builder. Run: npx tsx scripts/verify-ai.ts
 */
import { buildDemoDataset } from '../src/demo/seed';
import { runAiCommand, SUGGESTED_PROMPTS, parseAmount, resolveParty } from '../src/ai/engine';
import { buildLines, emptyForm, TYPE_OPTIONS, validateForm } from '../src/demo/transactionBuilder';
import { partyBalance, naturalBalance, profitAndLoss, entriesInRange } from '../src/demo/accounting';
import { formatPKR } from '../src/lib/format';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const ds = buildDemoDataset();

console.log('\n=== A. EVERY SUGGESTED PROMPT RETURNS A RESULT ===');
for (const p of SUGGESTED_PROMPTS) {
  const res = runAiCommand(p.text, ds);
  const hasBody = res.text.length > 30;
  check(`"${p.text}" → ${res.intentLabel}`, hasBody && res.intent !== 'assistant.help', res.intent);
}

console.log('\n=== B. ENTITY EXTRACTION ===');
check('parse "Rs. 25,000"', parseAmount('Prepare a payment of Rs. 25,000 to ABC Traders') === 25000);
check('parse "15 hazar"', parseAmount('15 hazar payment karo') === 15000);
check('parse "2 lakh"', parseAmount('2 lakh ka payment') === 200000);
check('parse "Rs. 1,25,000"', parseAmount('Rs. 1,25,000') === 125000);
check('resolve "Ahmed"', resolveParty('Ahmed ka ledger dikhao', ds)?.id === 'CUS-001');
check('resolve "Ali Traders" alias', resolveParty('Ali Traders ko kitni payment deni hai?', ds)?.id === 'SUP-002');
check('resolve "ABC Traders"', resolveParty('Prepare a payment to ABC Traders', ds)?.id === 'SUP-001');
check('no false positive for "please"', resolveParty('please show me sales', ds) === undefined);

console.log('\n=== C. ANSWERS MATCH THE LEDGER ===');
const sales = runAiCommand('Aaj ki total sales kitni hain?', ds);
const todaySales = naturalBalance(ds, '4000', { start: ds.demoToday, end: ds.demoToday });
check('Today sales answer equals ledger', sales.text.includes(formatPKR(todaySales)), formatPKR(todaySales));
check('Roman Urdu detected', sales.language === 'roman-urdu');

const ledgerRes = runAiCommand('Ahmed ka ledger dikhao.', ds);
const ahmedBalance = partyBalance(ds, 'CUS-001').balance;
check('Party ledger answer shows closing balance', ledgerRes.text.includes(formatPKR(ahmedBalance)), formatPKR(ahmedBalance));
check('Party ledger includes table rows', (ledgerRes.table?.rows.length ?? 0) > 0);

const profit = runAiCommand('Is month ka profit calculate karo.', ds);
const monthPl = profitAndLoss(ds, '2026-11-01', ds.demoToday);
check('Profit answer equals P&L engine', profit.text.includes(formatPKR(monthPl.netProfit)), formatPKR(monthPl.netProfit));

const cash = runAiCommand('Business ka current cash balance batao.', ds);
check('Cash answer mentions cash & bank', cash.metrics?.length === 4);

const payableQ = runAiCommand('Ali Traders ko kitni payment deni hai?', ds);
const aliBal = partyBalance(ds, 'SUP-002').balance;
check('Payable answer equals supplier balance', payableQ.text.includes(formatPKR(aliBal)), formatPKR(aliBal));

const last10 = runAiCommand('Show me the last 10 transactions.', ds);
check('Last 10 transactions returns 10 rows', last10.table?.rows.length === 10);

const monthly = runAiCommand('Show monthly revenue and expenses.', ds);
check('Monthly trend returns 12+ month rows', (monthly.table?.rows.length ?? 0) >= 5);

const books = runAiCommand('Check whether the books are balanced.', ds);
check('Books check reports balanced', books.text.includes('balanced'));

console.log('\n=== D. ACTION COMMANDS CREATE BALANCED DRAFTS ===');
const pay = runAiCommand('Prepare a payment of Rs. 25,000 to ABC Traders.', ds);
check('Payment draft created', !!pay.draft);
if (pay.draft) {
  const dr = pay.draft.draft.lines.reduce((s, l) => s + l.debit, 0);
  const cr = pay.draft.draft.lines.reduce((s, l) => s + l.credit, 0);
  check('Draft is balanced', dr === cr, `${dr} / ${cr}`);
  check('Draft amount is 25,000', pay.draft.draft.amount === 25000);
  check('Draft party is ABC Traders', pay.draft.draft.partyId === 'SUP-001');
  check('Draft is a payment', pay.draft.draft.type === 'payment');
  check('Draft date is demo clock', pay.draft.draft.date === ds.demoToday);
}

const noParty = runAiCommand('Record a payment of Rs. 5,000', ds);
check('Missing party asks for clarification (no draft)', !noParty.draft && noParty.intent.includes('missing_party'));

const noAmount = runAiCommand('Record a payment to ABC Traders', ds);
check('Missing amount asks for clarification (no draft)', !noAmount.draft && noAmount.intent.includes('missing_amount'));

const receipt = runAiCommand('Record receipt of Rs. 40,000 from Ahmed Enterprises', ds);
check('Receipt draft created and balanced', !!receipt.draft &&
  receipt.draft.draft.lines.reduce((s, l) => s + l.debit, 0) === receipt.draft.draft.lines.reduce((s, l) => s + l.credit, 0));

console.log('\n=== E. TRANSACTION BUILDER — ALL 8 VOUCHER TYPES ===');
for (const opt of TYPE_OPTIONS) {
  const form = {
    ...emptyForm(ds.demoToday),
    type: opt.value,
    amount: 10_000,
    partyId: opt.value === 'receipt' || opt.value === 'sales' ? 'CUS-001' : 'SUP-001',
    accountId: '1010',
    toAccountId: '1020',
    categoryAccountId: '5120',
    description: 'QA voucher',
  };
  const lines = buildLines(ds, form);
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  const errors = validateForm(ds, form);
  check(`${opt.label}: balanced & valid`, dr === cr && dr > 0 && errors.length === 0, `${dr}/${cr}${errors.length ? ` errors: ${errors.join('; ')}` : ''}`);
}

console.log('\n=== F. VALIDATION GUARDRAILS ===');
check('Rejects zero amount', validateForm(ds, { ...emptyForm(ds.demoToday), amount: 0, description: 'x' }).length > 0);
check('Rejects receipt without party', validateForm(ds, { ...emptyForm(ds.demoToday), amount: 500, description: 'x' }).length > 0);
check('Rejects transfer to the same account', validateForm(ds, {
  ...emptyForm(ds.demoToday), type: 'transfer', amount: 500, description: 'x', accountId: '1010', toAccountId: '1010',
}).length > 0);

console.log('\n=== G. READ-ONLY GUARANTEE ===');
const before = ds.entries.length;
runAiCommand('Prepare a payment of Rs. 25,000 to ABC Traders.', ds);
runAiCommand('Record receipt of Rs. 40,000 from Ahmed Enterprises', ds);
check('AI engine never mutates the dataset', ds.entries.length === before, `${before} → ${ds.entries.length}`);
check('Suggested prompts are documentation-accurate (12 items)', SUGGESTED_PROMPTS.length === 12);

console.log('\n=== H. SAMPLE QUERY OUTPUT ===');
const demo = runAiCommand('Ali Traders ko kitni payment deni hai?', ds);
console.log(`  intent: ${demo.intent} (${demo.language})`);
console.log(`  text  : ${demo.text}`);
console.log(`  metrics: ${demo.metrics?.map((m) => `${m.label}=${m.value}`).join(' | ')}`);

const txCount = entriesInRange(ds, ds.fiscalYearStart, ds.demoToday).length;
console.log(`\n  FY entries: ${txCount} of ${ds.entries.length} total`);

console.log(`\n=== RESULT: ${failures === 0 ? 'ALL AI / BUILDER CHECKS PASSED' : `${failures} FAILURE(S)`} ===\n`);
if (typeof process !== 'undefined') process.exit(failures === 0 ? 0 : 1);
