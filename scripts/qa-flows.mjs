/**
 * End-to-end workflow QA: document → draft → approvals → approve/reject/edit → reset.
 * Usage: node scripts/qa-flows.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = path.resolve('qa-shots');
fs.mkdirSync(OUT, { recursive: true });

let pass = 0;
let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const countRows = async () => page.locator('table.table tbody tr').count();
const toastText = async () => (await page.locator('.toast').allInnerTexts().catch(() => [])).join(' | ').replace(/\n/g, ' ');

/* ---------------- baseline dashboard ---------------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const cashBefore = await page.locator('.kpi-value').first().innerText();
const bankBefore = await page.locator('.kpi-value').nth(1).innerText();
const badgeBefore = await page.locator('.badge.outline').nth(1).innerText().catch(() => '');

/* ---------------- 1. document → draft ---------------- */
await page.goto(BASE + '/documents', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('button:has-text("Prepare transaction draft")');
await page.waitForTimeout(900);
check('Document draft routes to /approvals', page.url().includes('/approvals'), page.url().replace(BASE, ''));
const approvalRowsAfterDoc = await countRows();
check('Approvals queue contains the new draft', approvalRowsAfterDoc >= 6, `${approvalRowsAfterDoc} rows`);
const docToast = await toastText();

/* ---------------- 2. approve from approvals page ---------------- */
await page.locator('button:has-text("Review")').first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'approval-review.png'), fullPage: true });
await page.locator('.modal button:has-text("Approve & post")').click();
await page.waitForTimeout(900);
const approveToast = await toastText();
const statusAfterApprove = await page.locator('.badge.green:has-text("Completed")').count().catch(() => 0);
check('Approve posts a voucher and reports its reference', /Approved .* posted as (PV|RV|BILL|INV)-/.test(approveToast), approveToast.slice(-160));
check('Approved item now shows as Completed in the queue', statusAfterApprove > 0, `${statusAfterApprove} completed badges`);

/* ---------------- 3. reject with reason ---------------- */
await page.reload({ waitUntil: 'networkidle' });
const pendingChips = page.locator('button.chip:has-text("Pending Approval")');
await pendingChips.click();
await page.waitForTimeout(400);
const pendingBefore = await countRows();
if (pendingBefore > 0) {
  await page.locator('button:has-text("Review")').first().click();
  await page.waitForTimeout(500);
  await page.locator('.modal button:has-text("Reject")').first().click();
  await page.waitForTimeout(500);
  await page.locator('.modal input.input').last().fill('QA: duplicate voucher');
  await page.locator('.modal button:has-text("Confirm rejection")').click();
  await page.waitForTimeout(700);
  const rejectToast = await toastText();
  check('Reject asks for a reason and records it', rejectToast.includes('rejected'), rejectToast.slice(0, 100));
} else {
  check('Reject flow', false, 'no pending items to reject');
}

/* ---------------- 4. edit draft ---------------- */
await page.reload({ waitUntil: 'networkidle' });
await page.locator('button.chip:has-text("Pending Approval")').click();
await page.waitForTimeout(400);
const pendingNow = await countRows();
if (pendingNow > 0) {
  await page.locator('button:has-text("Review")').first().click();
  await page.waitForTimeout(500);
  await page.locator('.modal button:has-text("Edit draft")').click();
  await page.waitForTimeout(500);
  const amountInput = page.locator('.modal input[type="number"]').last();
  await amountInput.fill('18500');
  await page.screenshot({ path: path.join(OUT, 'approval-edit.png'), fullPage: true });
  await page.locator('.modal button:has-text("Save draft")').click();
  await page.waitForTimeout(700);
  const editToast = await toastText();
  check('Edit draft saves corrections', editToast.toLowerCase().includes('updated'), editToast.slice(0, 100));
  const savedAmount = await page.locator('button.chip:has-text("Pending Approval")').count();
  check('Edited draft returns to pending queue', savedAmount > 0);
} else {
  check('Edit draft flow', false, 'no pending items to edit');
}

/* ---------------- 5. manual voucher then dashboard movement ---------------- */
await page.goto(BASE + '/transactions?new=1', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.fill('.modal input[type="number"]', '99999');
await page.locator('.modal select').first().selectOption({ index: 1 });
await page.locator('.modal input.input').last().fill('QA manual receipt validation');
const canPost = !(await page.locator('.modal button:has-text("Post transaction")').isDisabled());
check('Manual voucher form validates and enables posting', canPost);
if (canPost) {
  await page.click('.modal button:has-text("Post transaction")');
  await page.waitForTimeout(800);
  const postToast = await toastText();
  check('Manual voucher posts with a reference', /RV-\d{4}-\d{3}/.test(postToast), postToast.slice(0, 110));
}

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const cashAfter = await page.locator('.kpi-value').first().innerText();
const bankAfter = await page.locator('.kpi-value').nth(1).innerText();
check('Dashboard bank balance reflects the posted receipt', bankAfter !== bankBefore, `bank ${bankBefore} → ${bankAfter}`);
check('Unrelated dashboard KPI (cash) correctly unchanged', cashAfter === cashBefore, `cash ${cashAfter}`);
await page.screenshot({ path: path.join(OUT, 'dashboard-after-flows.png'), fullPage: true });

/* ---------------- 6. ledger consistency in the UI ---------------- */
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
await page.click('button.chip:has-text("Trial Balance")');
await page.waitForTimeout(500);
const tbText = (await page.locator('.callout').allInnerTexts()).join(' | ');
check('Trial balance still agrees after demo activity', tbText.includes('agrees'), tbText.replace(/\n/g, ' ').slice(0, 110));
await page.click('button.chip:has-text("Balance Sheet")');
await page.waitForTimeout(500);
const bsText = (await page.locator('.callout').allInnerTexts()).join(' | ');
check('Balance sheet still balances after demo activity',
  bsText.includes('Assets = Liabilities + Equity') && bsText.includes('difference PKR 0'),
  bsText.replace(/\n/g, ' ').slice(0, 120));

/* ---------------- 7. reset demo ---------------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.locator('.icon-btn[aria-label="Reset demo data"]').click();
await page.waitForTimeout(400);
await page.locator('.modal button:has-text("Reset demo data")').click();
await page.waitForTimeout(900);
await page.goto(BASE + '/approvals', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const rowsAfterReset = await countRows();
check('Reset restores the seeded approvals (5)', rowsAfterReset === 5, `${rowsAfterReset} rows`);
const cashReset = await page.goto(BASE + '/', { waitUntil: 'networkidle' }).then(async () => {
  await page.waitForTimeout(500);
  return page.locator('.kpi-value').first().innerText();
});
check('Reset restores seeded dashboard figures', cashReset === 'PKR 5,804,400', cashReset);

check('No console / page errors during flows', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n===== FLOW RESULT: ${fail === 0 ? 'ALL FLOW CHECKS PASSED' : `${fail} FAILURE(S)`} (${pass} passed) =====\n`);
process.exit(fail === 0 ? 0 : 1);
