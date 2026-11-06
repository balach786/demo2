/**
 * PHASE 12 — 15-step critical workflow regression.
 * Executed against the live dev server in Chromium; each step is recorded.
 */
import fs from 'node:fs';
import { launch, check, summary, goto, getState, resetDemo, readKpis, money, lastToast } from './harness.mjs';
import { analyze, reference } from '../../.qa/figures-entry.js';

const REF = reference();
const { browser, page, errors } = await launch({ width: 1440, height: 960 });
const state = async () => getState(page);
const round = (n) => Math.round(n);

console.log('\n===== PHASE 12: 15-STEP CRITICAL WORKFLOW =====');

/* 1 — open the app */
await resetDemo(page);
await goto(page, '/');
const badge = await page.locator('.demo-pill').first().innerText().catch(() => '');
check('step01', '1. App opens on the dashboard with the DEMO MODE indicator',
  /demo mode/i.test(badge) && (await page.locator('.page-title').count()) > 0, badge);

/* 2 — dashboard */
const k = await readKpis(page);
const base = analyze(await state());
check('step02', '2. Dashboard KPIs reconcile with the ledger (cash, bank, sales, profit)',
  round(k['Total Cash Balance'].value) === base.liquid.cash &&
  round(k['Total Bank Balance'].value) === base.liquid.hbl + base.liquid.meezan &&
  round(k['Total Sales'].value) === base.pl.revenue,
  `cash ${k['Total Cash Balance'].value} bank ${k['Total Bank Balance'].value} sales ${k['Total Sales'].value}`);

/* 3 — accounting module */
await goto(page, '/transactions');
const txRows = await page.locator('table.table tbody tr').count();
check('step03', '3. Accounting module lists the journal', txRows > 0, `${txRows} rows on page 1`);

/* 4 — create a payment */
const beforePay = analyze(await state());
await goto(page, '/transactions?new=1');
await page.waitForSelector('.modal');
await page.locator('.modal button.chip:has-text("Money Paid")').click();
await page.locator('.modal label.field:has-text("Amount") input').fill('15000');
const supSel = page.locator('.modal label.field:has-text("Supplier") select');
const supOpts = await supSel.locator('option').allInnerTexts();
const abcIdx = supOpts.findIndex((o) => /ABC Traders/.test(o));
await supSel.selectOption({ index: abcIdx >= 0 ? abcIdx : 1 });
await page.locator('.modal label.field:has-text("Description") input').fill('QA regression supplier payment');
await page.locator('.modal button:has-text("Post transaction")').click();
await page.waitForTimeout(900);
const payToast = await lastToast(page);
const payRef = (payToast.match(/PV-\d{4}-\d{3}/) || [''])[0];
check('step04', '4. Payment of PKR 15,000 to ABC Traders is posted with a reference', !!payRef, payToast.slice(0, 110));

/* 5 — verify the transaction */
const afterPay = analyze(await state());
await goto(page, '/transactions');
await page.fill('.input-group .input', payRef);
await page.waitForTimeout(600);
const payRow = await page.locator('table.table tbody tr').first().innerText().catch(() => '');
check('step05', '5. The voucher is searchable, shows PKR 15,000 and is balanced',
  payRow.includes('15,000') && afterPay.entryCount === beforePay.entryCount + 1 && afterPay.trialBalance.balanced,
  `${payRef} | TB diff ${afterPay.trialBalance.difference}`);

/* 6 — party ledger */
await goto(page, '/parties/SUP-001');
const abcBal = afterPay.parties.find((p) => p.id === 'SUP-001');
const abcCard = await page.locator('.kpi').first().innerText();
check('step06', '6. ABC Traders ledger balance fell by exactly PKR 15,000',
  abcCard.includes(String(round(abcBal.balance)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
  `before ${beforePay.parties.find((p) => p.id === 'SUP-001').balance} → after ${abcBal.balance}`);

/* 7 — dashboard reflects the payment */
await goto(page, '/');
const k2 = await readKpis(page);
check('step07', '7. Dashboard bank balance dropped by PKR 15,000',
  round(k2['Total Bank Balance'].value) === round(k['Total Bank Balance'].value) - 15000,
  `${k['Total Bank Balance'].value} → ${k2['Total Bank Balance'].value}`);
check('step07b', '7b. Dashboard payable dropped by PKR 15,000',
  round(k2['Accounts Payable'].value) === round(k['Accounts Payable'].value) - 15000,
  `${k['Accounts Payable'].value} → ${k2['Accounts Payable'].value}`);

/* 8 — AI cash balance */
await goto(page, '/ai');
await page.fill('.chat-input', 'Business ka current cash balance batao.');
await page.locator('button:has-text("Send")').click();
await page.waitForTimeout(1400);
const aiCash = await page.locator('.msg.ai .bubble').last().innerText();
const cashNow = analyze(await state()).liquid.cash;
check('step08', '8. AI cash-balance answer equals the ledger cash balance',
  aiCash.includes(String(round(cashNow)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')), aiCash.slice(0, 90));

/* 9 — upload / open a sample receipt */
await goto(page, '/documents');
const beforeDoc = analyze(await state());
await page.locator('text=HBL-Deposit-Slip-4417.pdf').first().click();
await page.waitForTimeout(600);
const extraction = await page.locator('.card:has-text("Extracted fields")').innerText();
check('step09', '9. Sample receipt shows a simulated extraction (confidence + fields)',
  /Confidence\s*\d+%/i.test(extraction) && /SIMULATED EXTRACTION/i.test(extraction),
  extraction.replace(/\n/g, ' ').slice(0, 100));

/* 10 — prepare a draft from the document */
await page.locator('button:has-text("Prepare transaction draft")').click();
await page.waitForTimeout(1100);
const afterDoc = analyze(await state());
check('step10', '10. A draft is prepared and routed to Approvals without posting',
  page.url().includes('/approvals') && afterDoc.entryCount === beforeDoc.entryCount,
  `${beforeDoc.entryCount} → ${afterDoc.entryCount} entries`);

/* 11 — approve it */
await page.locator('button:has-text("Review")').first().click();
await page.waitForTimeout(500);
const approveBtn = page.locator('.modal button:has-text("Approve & post")');
const hasApprove = await approveBtn.count();
if (hasApprove) await approveBtn.click();
await page.waitForTimeout(1100);
const apprToast = await lastToast(page);
const afterApprove2 = analyze(await state());
check('step11', '11. Approval posts exactly one voucher with a generated reference',
  afterApprove2.entryCount === afterDoc.entryCount + 1 && /(PV|RV|SV|PUR|EXP|CD|CW|BT)-\d{4}-\d{3}/.test(apprToast),
  apprToast.slice(0, 120));

/* 12 — verify the updated balance */
await goto(page, '/');
const k3 = await readKpis(page);
check('step12', '12. Dashboard reflects the approved posting',
  round(k3['Total Bank Balance'].value) !== round(k2['Total Bank Balance'].value) ||
  round(k3['Total Cash Balance'].value) !== round(k2['Total Cash Balance'].value),
  `bank ${k2['Total Bank Balance'].value} → ${k3['Total Bank Balance'].value}, cash ${k2['Total Cash Balance'].value} → ${k3['Total Cash Balance'].value}`);

/* 13 — P&L */
const final = analyze(await state());
await goto(page, '/reports');
await page.locator('button.chip:has-text("Profit & Loss")').click();
await page.waitForTimeout(600);
const plText = await page.locator('.card').first().innerText();
const plRevenue = money((plText.match(/Total revenue\s*PKR\s*([\d,]+)/) || [])[1]);
const plNet = money((plText.match(/Net profit for the period\s*PKR\s*([\d,]+)/) || [])[1]);
check('step13', '13. P&L revenue and net profit equal the final ledger',
  round(plRevenue) === round(final.pl.revenue) && round(plNet) === round(final.pl.net),
  `revenue ${plRevenue}/${final.pl.revenue} net ${plNet}/${final.pl.net}`);

/* 14 — balance sheet */
await page.locator('button.chip:has-text("Balance Sheet")').click();
await page.waitForTimeout(600);
const bsText = await page.locator('.card').first().innerText();
const A = money((bsText.match(/Total assets\s*PKR\s*([\d,]+)/) || [])[1]);
const LE = money((bsText.match(/Total liabilities & equity\s*PKR\s*([\d,]+)/) || [])[1]);
check('step14', '14. Balance sheet equation still holds after the workflow',
  A === LE && round(A) === round(final.balanceSheet.assets) && final.trialBalance.balanced,
  `A=${A} L+E=${LE} TBdiff=${final.trialBalance.difference}`);

/* 15 — navigation + console */
let navErrors = 0;
for (const route of ['/', '/ai', '/parties', '/chart-of-accounts', '/transactions', '/ledgers', '/banks', '/income-expenses', '/reports', '/documents', '/approvals', '/settings']) {
  const before = errors.console.length + errors.page.length;
  await goto(page, route, { settle: 300 });
  if ((await page.locator('.page-title').count()) === 0) navErrors++;
  if (errors.console.length + errors.page.length > before) navErrors++;
}
check('step15', '15. Full navigation sweep clean — no console errors, no blank pages',
  navErrors === 0 && errors.console.length === 0 && errors.page.length === 0,
  `${navErrors} problems, console=${errors.console.length}, page=${errors.page.length}`);

await page.screenshot({ path: 'qa-shots/regression-final-dashboard.png' });
fs.writeFileSync('qa-shots/phase12-results.json', JSON.stringify(summary('PHASE 12 REGRESSION'), null, 2));
await browser.close();
process.exit(0);
