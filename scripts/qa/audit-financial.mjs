/**
 * PHASE 3 / 4 / 7 — dashboard figures, accounting module, double-entry,
 * bank maths, reports and the approval workflow.
 * Expected values come from the demo's own accounting engine (.qa/figures-entry.js),
 * so this compares "what the UI shows" against "what the ledger says".
 */
import fs from 'node:fs';
import { launch, check, summary, goto, getState, resetDemo, readKpis, money, setPeriod, lastToast } from './harness.mjs';
import { expected, analyze, reference } from '../../.qa/figures-entry.js';

const REF = reference();
const { browser, page, errors } = await launch();
const stateNow = async () => getState(page);
const round = (n) => Math.round(n);

/* ==================================================================== */
console.log('\n=== PHASE 3: DASHBOARD FIGURES vs LEDGER ===');
await resetDemo(page);
const exp = expected('year');
const kpis = await readKpis(page);

const pairs = [
  ['Total Cash Balance', exp.cash],
  ['Total Bank Balance', exp.bank],
  ['Total Sales', exp.sales],
  ['Total Purchases', exp.purchases],
  ['Total Expenses', exp.expenses],
  ['Net Profit', exp.netProfit],
  ['Accounts Receivable', exp.receivable],
  ['Accounts Payable', exp.payable],
  ['Total Inventory Value', exp.inventory],
];
for (const [label, expectedValue] of pairs) {
  const shown = kpis[label];
  check(`dash:kpi:${label}`, `KPI "${label}" matches ledger`, shown && round(shown.value) === round(expectedValue),
    `UI=${shown ? shown.value : 'MISSING'} ledger=${expectedValue}`);
}

/* period filters */
console.log('\n=== PHASE 3b: DATE-RANGE FILTERS ===');
for (const preset of ['Today', 'This Week', 'This Month', 'Last Month', 'This Year']) {
  await goto(page, '/');
  await setPeriod(page, preset);
  const k = await readKpis(page);
  const e = expected(
    preset === 'Today' ? 'today' : preset === 'This Week' ? 'week' : preset === 'This Month' ? 'month' : preset === 'Last Month' ? 'lastMonth' : 'year',
  );
  const ok = ['Total Sales', 'Total Purchases', 'Total Expenses', 'Net Profit'].every(
    (lbl) => k[lbl] && round(k[lbl].value) === round(e[lbl === 'Total Sales' ? 'sales' : lbl === 'Total Purchases' ? 'purchases' : lbl === 'Total Expenses' ? 'expenses' : 'netProfit']),
  );
  check(`dash:period:${preset}`, `Period "${preset}" recomputes sales/purchases/expenses/profit correctly`, ok,
    `sales UI=${k['Total Sales']?.value} ledger=${e.sales}`);
}
await setPeriod(page, 'This Year');

/* recent transactions / top customers / outstanding */
console.log('\n=== PHASE 3c: DASHBOARD LISTS ===');
const st = await stateNow();
const sorted = [...st.entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
const firstRow = await page.locator('table.table tbody tr').first().innerText().catch(() => '');
check('dash:recent', 'Recent transactions row 1 is the newest voucher in the ledger',
  firstRow.includes(sorted[0].reference), `row="${firstRow.replace(/\n/g, ' ').slice(0, 90)}" ref=${sorted[0].reference}`);

const barLabels = await page.locator('.bar-row').allInnerTexts().catch(() => []);
const topExpected = REF.topCustomerSales.slice(0, 3).map((t) => st.parties.find((p) => p.id === t.id)?.name ?? t.id);
const topShownOk = topExpected.every((name) => barLabels.some((b) => b.includes(name.split(' ')[0])));
check('dash:top-customers', 'Top customers list matches ledger ranking', topShownOk,
  `expected=${topExpected.join(', ')}`);

const arShown = kpis['Accounts Receivable'].value;
const apShown = kpis['Accounts Payable'].value;
const arFromParties = st.parties.filter((p) => p.type === 'customer').reduce((s, p) => {
  const bal = analyze(st).parties.find((x) => x.id === p.id);
  return s + (bal.side === 'receivable' ? bal.balance : 0);
}, 0);
const apFromParties = st.parties.filter((p) => p.type === 'supplier').reduce((s, p) => {
  const bal = analyze(st).parties.find((x) => x.id === p.id);
  return s + (bal.side === 'payable' ? bal.balance : 0);
}, 0);
check('dash:AR-reconciles', 'Receivable KPI equals sum of customer balances', round(arShown) === round(arFromParties),
  `UI=${arShown} parties=${arFromParties}`);
check('dash:AP-reconciles', 'Payable KPI equals sum of supplier balances', round(apShown) === round(apFromParties),
  `UI=${apShown} parties=${apFromParties}`);

/* charts render + tooltip */
const chartCount = await page.locator('.chart-svg').count();
check('dash:charts', 'All four dashboard charts render as SVG', chartCount >= 4, `${chartCount} charts`);
await page.locator('.chart-svg').first().scrollIntoViewIfNeeded();
const svgBox = await page.locator('.chart-svg').first().boundingBox();
if (svgBox) {
  await page.mouse.move(svgBox.x + svgBox.width * 0.55, svgBox.y + svgBox.height * 0.5);
  await page.waitForTimeout(350);
}
check('dash:chart-tooltip', 'Chart hover shows a tooltip with values',
  (await page.locator('.chart-tooltip').count()) > 0);

/* ==================================================================== */
console.log('\n=== PHASE 4A: PARTIES ===');
await goto(page, '/parties');
const partyRows = await page.locator('table.table tbody tr').count();
check('parties:count', 'Parties list shows every seeded party', partyRows === REF.partyCount, `${partyRows}/${REF.partyCount}`);
await page.locator('.segmented button:has-text("Customers")').click();
await page.waitForTimeout(400);
const custRows = await page.locator('table.table tbody tr').count();
check('parties:customers', 'Customers tab filters to customers only', custRows === REF.customerCount, `${custRows}/${REF.customerCount}`);
await page.locator('.segmented button:has-text("Suppliers")').click();
await page.waitForTimeout(400);
const supRows = await page.locator('table.table tbody tr').count();
check('parties:suppliers', 'Suppliers tab filters to suppliers only', supRows === REF.supplierCount, `${supRows}/${REF.supplierCount}`);
await page.locator('.segmented button:has-text("All")').click();
await page.waitForTimeout(300);
await page.fill('.card-head .input', 'Ahmed');
await page.waitForTimeout(450);
const searchTexts = await page.locator('table.table tbody tr').allInnerTexts();
check('parties:search', 'Party search narrows the list and every hit really contains the term',
  searchTexts.length >= 1 && searchTexts.length < REF.partyCount && searchTexts.every((t) => /ahmed/i.test(t)),
  `${searchTexts.length}/${REF.partyCount} rows`);

await goto(page, '/parties/CUS-001');
const detailText = await page.locator('.page').innerText();
const ahmedShown = await page.locator('.kpi').first().innerText();
check('parties:detail-balance', 'Party profile shows the ledger closing balance', ahmedShown.includes(String(round(REF.ahmedBalance)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
  `expected ${REF.ahmedBalance} | card="${ahmedShown.replace(/\n/g, ' ').slice(0, 80)}"`);
check('parties:detail-ledger', 'Party profile renders ledger rows', (await page.locator('table.table tbody tr').count()) > 5, detailText.length > 500);

/* ==================================================================== */
console.log('\n=== PHASE 4B/4C: POST ALL 8 VOUCHER TYPES + DOUBLE ENTRY ===');
await resetDemo(page);
const before = analyze(await stateNow());
check('de:baseline', 'Baseline ledger is fully balanced before mutations',
  before.unbalancedEntries.length === 0 && before.trialBalance.balanced && before.balanceSheet.balanced,
  `unbalanced=${before.unbalancedEntries.length} tbDiff=${before.trialBalance.difference} bsDiff=${before.balanceSheet.difference}`);

const AMT = 10000;

async function openNew(typeLabel) {
  await goto(page, '/transactions?new=1', { settle: 500 });
  await page.waitForSelector('.modal', { timeout: 8000 });
  await page.locator(`.modal button.chip:has-text("${typeLabel}")`).click();
  await page.waitForTimeout(250);
}

async function selectByText(selectLocator, needle) {
  const options = await selectLocator.locator('option').allInnerTexts();
  const idx = options.findIndex((o) => o.toLowerCase().includes(String(needle).toLowerCase()));
  await selectLocator.selectOption({ index: idx >= 0 ? idx : 1 });
  return options[idx >= 0 ? idx : 1] ?? '';
}

async function fill(fieldLabel, value, kind = 'input') {
  const el = page.locator(`.modal label.field:has-text("${fieldLabel}") ${kind}`).first();
  if (kind === 'select') return await selectByText(el, value);
  await el.fill(String(value));
  return String(value);
}

async function post() {
  const btn = page.locator('.modal button:has-text("Post transaction")');
  const disabled = await btn.isDisabled();
  if (disabled) return { posted: false, reason: 'button disabled (validation blocked)' };
  await btn.click();
  await page.waitForTimeout(800);
  const toast = (await page.locator('.toast').allInnerTexts().catch(() => [])).join(' ').replace(/\n/g, ' ');
  return { posted: /posted/i.test(toast), toast };
}

const CASES = [
  { label: 'Money Received', key: 'receipt', party: 'Ahmed Enterprises', account: 'HBL Business Account',
    expect: (b, a) => ({ bank: a.liquid.hbl - b.liquid.hbl, ar: a.accounts['1100'] - b.accounts['1100'] }) },
  { label: 'Money Paid', key: 'payment', party: 'ABC Traders', account: 'HBL Business Account',
    expect: (b, a) => ({ bank: a.liquid.hbl - b.liquid.hbl, ap: a.accounts['2000'] - b.accounts['2000'] }) },
  { label: 'Sales Invoice', key: 'sales', party: 'Ahmed Enterprises', account: 'HBL Business Account',
    expect: (b, a) => ({ ar: a.accounts['1100'] - b.accounts['1100'], revenue: a.accounts['4000'] - b.accounts['4000'], inventory: a.accounts['1200'] - b.accounts['1200'] }) },
  { label: 'Purchase Invoice', key: 'purchase', party: 'ABC Traders', account: 'HBL Business Account',
    expect: (b, a) => ({ inventory: a.accounts['1200'] - b.accounts['1200'], ap: a.accounts['2000'] - b.accounts['2000'] }) },
  { label: 'Expense', key: 'expense', party: null, account: 'Cash in Hand', expenseHead: 'Transport',
    expect: (b, a) => ({ cash: a.liquid.cash - b.liquid.cash, transport: a.accounts['5130'] - b.accounts['5130'] }) },
  { label: 'Cash Deposit', key: 'deposit', party: null, account: 'HBL Business Account',
    expect: (b, a) => ({ cash: a.liquid.cash - b.liquid.cash, bank: a.liquid.hbl - b.liquid.hbl, liquid: a.liquid.total - b.liquid.total }) },
  { label: 'Cash Withdrawal', key: 'withdrawal', party: null, account: 'HBL Business Account',
    expect: (b, a) => ({ cash: a.liquid.cash - b.liquid.cash, bank: a.liquid.hbl - b.liquid.hbl, liquid: a.liquid.total - b.liquid.total }) },
  { label: 'Bank Transfer', key: 'transfer', party: null, account: 'HBL Business Account', toAccount: 'Meezan Business Account',
    expect: (b, a) => ({ hbl: a.liquid.hbl - b.liquid.hbl, meezan: a.liquid.meezan - b.liquid.meezan, liquid: a.liquid.total - b.liquid.total }) },
];

for (const c of CASES) {
  await openNew(c.label);
  await fill('Amount', AMT);
  if (c.party) await fill(c.party === 'Ahmed Enterprises' ? 'Customer' : 'Supplier', c.party, 'select');
  let expenseOption = '';
  if (c.expenseHead) expenseOption = await fill('Expense head', c.expenseHead, 'select');
  // primary account select
  const accountSelect = page.locator('.modal select.select').filter({ hasText: /HBL|Meezan|Cash/ }).first();
  await selectByText(accountSelect, c.account);
  if (c.toAccount) {
    await selectByText(page.locator('.modal select.select').filter({ hasText: /Meezan|HBL/ }).last(), c.toAccount);
  }
  await fill('Description', `QA ${c.label} ${Date.now()}`);

  // journal preview must be balanced before posting
  const previewText = await page.locator('.modal').innerText();
  const balancedBadge = previewText.includes('Debits = Credits');
  check(`voucher:${c.key}:preview`, `${c.label}: live journal preview is balanced`, balancedBadge);

  const result = await post();
  if (!result.posted) {
    check(`voucher:${c.key}:post`, `${c.label}: posts a voucher`, false, result.reason ?? result.toast);
    continue;
  }
  const after = analyze(await stateNow());
  const delta = c.expect(before, after);
  const label = Object.entries(delta).map(([k, v]) => `${k}:${v}`).join(' ');

  let ok;
  if (c.key === 'receipt') ok = delta.bank === AMT && delta.ar === -AMT;
  else if (c.key === 'payment') ok = delta.bank === -AMT && delta.ap === -AMT; // AP is credit-normal
  else if (c.key === 'sales') ok = delta.ar === AMT && delta.revenue === AMT && delta.inventory === -Math.round(AMT * 0.7);
  else if (c.key === 'purchase') ok = delta.inventory === AMT && delta.ap === AMT;
  else if (c.key === 'expense') ok = delta.cash === -AMT && Math.abs(delta.transport) === AMT;
  else if (c.key === 'deposit') ok = delta.cash === -AMT && delta.bank === AMT;
  else if (c.key === 'withdrawal') ok = delta.cash === AMT && delta.bank === -AMT;
  else if (c.key === 'transfer') ok = delta.hbl === -AMT && delta.meezan === AMT;
  check(`voucher:${c.key}:post`, `${c.label}: posts and moves the correct accounts`, ok, `${label} [head=${expenseOption || '-'}]`);

  if (c.key === 'deposit' || c.key === 'withdrawal' || c.key === 'transfer') {
    check(`voucher:${c.key}:internal`, `${c.label}: total cash + bank unchanged (no money created)`,
      round(delta.liquid) === 0, `liquidΔ=${delta.liquid}`);
  }
  check(`de:${c.key}`, `Double entry intact after ${c.label}`,
    after.unbalancedEntries.length === 0 && after.trialBalance.balanced && after.balanceSheet.balanced,
    `unbalanced=${after.unbalancedEntries.length} tbDiff=${after.trialBalance.difference} bsDiff=${after.balanceSheet.difference}`);
  Object.assign(before, after);
}

/* validation guards in the UI */
console.log('\n=== PHASE 4B: FORM VALIDATION ===');
await openNew('Money Received');
await fill('Description', 'no amount no party');
let disabled = await page.locator('.modal button:has-text("Post transaction")').isDisabled();
check('voucher:validation:empty', 'Post is blocked with no amount / no party', disabled === true);
await fill('Amount', 0);
disabled = await page.locator('.modal button:has-text("Post transaction")').isDisabled();
check('voucher:validation:zero', 'Post is blocked for a zero amount', disabled === true);
await fill('Amount', 5000);
await fill('Customer', 'Ahmed Enterprises', 'select');
disabled = await page.locator('.modal button:has-text("Post transaction")').isDisabled();
check('voucher:validation:valid', 'Post becomes available once the form is valid', disabled === false);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
const modalGone = (await page.locator('.modal').count()) === 0;
check('voucher:cancel', 'Cancelling the form closes it and posts nothing', modalGone);
const afterCancel = analyze(await stateNow());
check('voucher:cancel:no-impact', 'Cancelled voucher did not change the ledger',
  afterCancel.entryCount === before.entryCount, `${before.entryCount} → ${afterCancel.entryCount}`);

/* ==================================================================== */
console.log('\n=== PHASE 4D/E: REPORTS vs LEDGER ===');
await resetDemo(page);
const baseState = await stateNow();
const a0 = analyze(baseState);
await goto(page, '/reports');

// P&L
await page.locator('button.chip:has-text("Profit & Loss")').click();
await page.waitForTimeout(500);
let plText = await page.locator('.card').first().innerText();
const revenueShown = money((plText.match(/Total revenue\s*PKR\s*([\d,]+)/) || [])[1]);
const netShown = money((plText.match(/Net profit for the period\s*PKR\s*([\d,]+)/) || [])[1]);
check('report:pl:revenue', 'P&L total revenue equals ledger revenue', round(revenueShown) === round(a0.pl.revenue),
  `UI=${revenueShown} ledger=${a0.pl.revenue}`);
check('report:pl:net', 'P&L net profit equals ledger net profit', round(netShown) === round(a0.pl.net),
  `UI=${netShown} ledger=${a0.pl.net}`);

// Trial balance
await page.locator('button.chip:has-text("Trial Balance")').click();
await page.waitForTimeout(500);
let tbText = await page.locator('.card').first().innerText();
const tbTotals = tbText.match(/Totals\s*PKR\s*([\d,]+)\s*PKR\s*([\d,]+)/);
check('report:tb:totals', 'Trial balance debits = credits in the UI',
  tbTotals && money(tbTotals[1]) === money(tbTotals[2]), tbTotals ? `${money(tbTotals[1])} vs ${money(tbTotals[2])}` : 'not parsed');
check('report:tb:ledger-match', 'Trial balance totals equal the ledger totals',
  tbTotals && round(money(tbTotals[1])) === round(a0.trialBalance.debit), `${tbTotals ? money(tbTotals[1]) : '?'} vs ${a0.trialBalance.debit}`);

// Balance sheet
await page.locator('button.chip:has-text("Balance Sheet")').click();
await page.waitForTimeout(500);
const bsText = await page.locator('.card').first().innerText();
const assetsM = bsText.match(/Total assets\s*PKR\s*([\d,]+)/);
const leM = bsText.match(/Total liabilities & equity\s*PKR\s*([\d,]+)/);
check('report:bs:equation', 'Balance sheet satisfies Assets = Liabilities + Equity',
  assetsM && leM && money(assetsM[1]) === money(leM[1]) && money(assetsM[1]) === round(a0.balanceSheet.assets),
  `A=${assetsM ? money(assetsM[1]) : '?'} L+E=${leM ? money(leM[1]) : '?'} ledgerA=${a0.balanceSheet.assets}`);

// Cash flow
await page.locator('button.chip:has-text("Cash Flow")').click();
await page.waitForTimeout(500);
const cfText = await page.locator('.card').first().innerText();
const cfOpen = money((cfText.match(/Opening cash & bank\s*PKR\s*([\d,]+)/) || [])[1]);
const cfClose = money((cfText.match(/Closing cash & bank\s*PKR\s*([\d,]+)/) || [])[1]);
check('report:cf:reconcile', 'Cash flow opening + movement = closing',
  cfText.includes('Reconciles') || (cfOpen && cfClose && round(cfOpen) === round(a0.cashFlow.opening) && round(cfClose) === round(a0.cashFlow.closing)),
  `open=${cfOpen} close=${cfClose} ledgerOpen=${a0.cashFlow.opening} ledgerClose=${a0.cashFlow.closing}`);

// Party + account ledger
await page.locator('button.chip:has-text("Party Ledger")').click();
await page.waitForTimeout(600);
const partyLedgerRows = await page.locator('table.table tbody tr').count();
check('report:party-ledger', 'Party ledger report renders entries', partyLedgerRows > 3, `${partyLedgerRows} rows`);
await page.locator('button.chip:has-text("Account Ledger")').click();
await page.waitForTimeout(600);
const accLedgerRows = await page.locator('table.table tbody tr').count();
check('report:account-ledger', 'Account ledger report renders entries', accLedgerRows > 3, `${accLedgerRows} rows`);

/* print */
let printCalled = false;
await page.evaluate(() => { window.__qaPrint = false; window.print = () => { window.__qaPrint = true; }; });
await page.locator('button:has-text("Print / PDF")').click();
await page.waitForTimeout(300);
printCalled = await page.evaluate(() => window.__qaPrint === true);
check('report:print', 'Print / PDF triggers the browser print dialog hook', printCalled);

/* CSV export */
const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
await page.locator('button:has-text("Export CSV")').click();
const download = await dl;
check('report:export', 'Export CSV produces a downloadable file', !!download, download ? await download.suggestedFilename() : 'no download event');

/* ==================================================================== */
console.log('\n=== PHASE 7: APPROVAL WORKFLOW ===');
await resetDemo(page);
const beforeApproval = analyze(await stateNow());
await goto(page, '/approvals');
const queueRows = await page.locator('table.table tbody tr').count();
check('approval:queue', 'Approval queue lists the seeded items', queueRows === 5, `${queueRows} rows`);

// approve via AI draft (fresh draft through the AI page)
await goto(page, '/ai');
await page.fill('.chat-input', 'Prepare a payment of Rs. 25,000 to ABC Traders.');
await page.locator('button:has-text("Send")').click();
await page.waitForTimeout(1400);
const draftCard = await page.locator('text=Action preview').count();
check('approval:draft-created', 'AI command creates an action preview (not a posting)', draftCard > 0);
const midState = analyze(await stateNow());
check('approval:draft-not-posted', 'Draft does not change the ledger before approval',
  midState.entryCount === beforeApproval.entryCount, `${beforeApproval.entryCount} → ${midState.entryCount}`);

await page.locator('button:has-text("Approve")').first().click();
await page.waitForTimeout(1000);
const afterApprove = analyze(await stateNow());
check('approval:posts', 'Approving posts exactly one voucher',
  afterApprove.entryCount === beforeApproval.entryCount + 1, `${beforeApproval.entryCount} → ${afterApprove.entryCount}`);
check('approval:balance', 'Payment reduced cash by exactly the approved amount',
  afterApprove.liquid.cash === beforeApproval.liquid.cash - 25000,
  `${beforeApproval.liquid.cash} → ${afterApprove.liquid.cash}`);
const toastApprove = await lastToast(page);
check('approval:reference', 'Approval toast shows the generated voucher reference', /(PV|RV|SV|PUR|EXP|CD|CW|BT)-\d{4}-\d{3}/.test(toastApprove),
  toastApprove.slice(-140));

/* duplicate approval attempt (double click on a fresh pending item) */
await goto(page, '/approvals');
await page.locator('button.chip:has-text("Pending Approval")').click();
await page.waitForTimeout(400);
const pendingRows = await page.locator('table.table tbody tr').count();
if (pendingRows > 0) {
  const beforeDup = analyze(await stateNow());
  await page.locator('button:has-text("Review")').first().click();
  await page.waitForTimeout(500);
  const btn = page.locator('.modal button:has-text("Approve & post")');
  await btn.click({ clickCount: 2, delay: 40 }).catch(() => btn.click());
  await page.waitForTimeout(1200);
  const afterDup = analyze(await stateNow());
  check('approval:idempotent-double-click', 'Double-clicking Approve creates only one voucher',
    afterDup.entryCount === beforeDup.entryCount + 1, `${beforeDup.entryCount} → ${afterDup.entryCount}`);
  await page.waitForTimeout(500);
  const modalOpen = await page.locator('.modal').count();
  const approveStillVisible = modalOpen ? await page.locator('.modal button:has-text("Approve & post")').count() : 0;
  check('approval:no-double-approve', 'After approval the item can no longer be approved again',
    approveStillVisible === 0, `modalOpen=${modalOpen} approveBtn=${approveStillVisible}`);
} else {
  check('approval:idempotent-double-click', 'Double-click approval guard', false, 'no pending rows');
}

/* reject path */
await goto(page, '/approvals');
await page.locator('button.chip:has-text("Pending Approval")').click();
await page.waitForTimeout(400);
if ((await page.locator('table.table tbody tr').count()) > 0) {
  const beforeReject = analyze(await stateNow());
  await page.locator('button:has-text("Review")').first().click();
  await page.waitForTimeout(450);
  await page.locator('.modal button:has-text("Reject")').first().click();
  await page.waitForTimeout(400);
  await page.locator('.modal input.input').last().fill('QA rejection reason');
  await page.locator('.modal button:has-text("Confirm rejection")').click();
  await page.waitForTimeout(800);
  const afterReject = analyze(await stateNow());
  check('approval:reject-no-posting', 'Rejected draft does not affect balances',
    afterReject.entryCount === beforeReject.entryCount && afterReject.liquid.total === beforeReject.liquid.total,
    `${beforeReject.entryCount} → ${afterReject.entryCount}`);
  await page.locator('button.chip:has-text("All")').first().click();
  await page.waitForTimeout(400);
  const rejectedBadge = await page.locator('td .badge:has-text("Rejected"), td .badge:has-text("rejected")').count();
  check('approval:reject-status', 'Rejected item shows the Rejected status', rejectedBadge > 0, `${rejectedBadge}`);
} else {
  check('approval:reject-no-posting', 'Reject flow', false, 'no pending rows');
}

/* edit draft */
await resetDemo(page);
await goto(page, '/approvals');
await page.locator('button.chip:has-text("Pending Approval")').click();
await page.waitForTimeout(400);
if ((await page.locator('table.table tbody tr').count()) > 0) {
  await page.locator('button:has-text("Review")').first().click();
  await page.waitForTimeout(450);
  await page.locator('.modal button:has-text("Edit draft")').click();
  await page.waitForTimeout(450);
  await page.locator('.modal input[type="number"]').last().fill('12345');
  await page.locator('.modal button:has-text("Save draft")').click();
  await page.waitForTimeout(800);
  const edited = await page.locator('table.table tbody tr').first().innerText();
  check('approval:edit', 'Edit draft saves the new amount and returns to pending', edited.includes('12,345'));
} else {
  check('approval:edit', 'Edit draft flow', false, 'no pending rows');
}

/* ==================================================================== */
check('phase4:console', 'No console/page errors during financial testing',
  errors.console.length === 0 && errors.page.length === 0,
  [...errors.console.slice(0, 4), ...errors.page.slice(0, 4)].join(' | '));

fs.writeFileSync('qa-shots/phase3-4-7-results.json', JSON.stringify(summary('PHASE 3+4+7'), null, 2));
await browser.close();
process.exit(0);
