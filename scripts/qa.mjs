/**
 * Browser QA harness (Playwright + local chromium).
 * Usage: node scripts/qa.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173';
const OUT = path.resolve('qa-shots');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/', 'dashboard'],
  ['/ai', 'ai'],
  ['/parties', 'parties'],
  ['/parties/CUS-001', 'party-detail'],
  ['/chart-of-accounts', 'chart-of-accounts'],
  ['/transactions', 'transactions'],
  ['/ledgers', 'ledgers'],
  ['/banks', 'banks'],
  ['/income-expenses', 'income-expenses'],
  ['/reports', 'reports'],
  ['/documents', 'documents'],
  ['/approvals', 'approvals'],
  ['/settings', 'settings'],
];

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err)));

const report = [];

for (const [route, name] of ROUTES) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(650);
  const title = await page.locator('.page-title').first().textContent().catch(() => null);
  const h1Count = await page.locator('h1').count();
  const bodyText = (await page.locator('body').innerText()).slice(0, 400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  report.push({ route, name, title, h1Count, ok: h1Count === 1, sample: bodyText.replace(/\n+/g, ' | ').slice(0, 160) });
}

/* ---------- interaction: AI command + approval ---------- */
await page.goto(BASE + '/ai', { waitUntil: 'networkidle' });
await page.fill('.chat-input', 'Aaj ki total sales kitni hain?');
await page.click('button:has-text("Send")');
await page.waitForTimeout(1200);
const aiAnswer1 = await page.locator('.msg.ai .bubble').last().innerText();
await page.screenshot({ path: path.join(OUT, 'ai-sales-query.png'), fullPage: true });

await page.fill('.chat-input', 'Prepare a payment of Rs. 25,000 to ABC Traders.');
await page.click('button:has-text("Send")');
await page.waitForTimeout(1400);
const draftVisible = await page.locator('text=Action preview').count();
await page.screenshot({ path: path.join(OUT, 'ai-draft.png'), fullPage: true });

// approve the inline draft
let approveClicked = false;
if (await page.locator('button:has-text("Approve")').count()) {
  await page.locator('button:has-text("Approve")').first().click();
  approveClicked = true;
  await page.waitForTimeout(900);
}
const toastText = await page.locator('.toast').first().innerText().catch(() => '');
await page.screenshot({ path: path.join(OUT, 'ai-after-approval.png'), fullPage: true });

/* ---------- interaction: dashboard KPI after approval ---------- */
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const kpiValues = await page.locator('.kpi-value').allInnerTexts();
const journalBadge = await page.locator('.badge.outline').first().innerText().catch(() => '');

/* ---------- interaction: new transaction ---------- */
await page.goto(BASE + '/transactions', { waitUntil: 'networkidle' });
const rowsBefore = await page.locator('table.table tbody tr').count();
await page.click('button:has-text("New transaction")');
await page.waitForTimeout(500);
await page.fill('input[type="number"]', '12500');
await page.selectOption('select.select >> nth=0', { index: 1 }).catch(() => {});
// choose first customer in the party select
const partySelect = page.locator('.modal select').first();
await partySelect.selectOption({ index: 1 }).catch(() => {});
await page.fill('.modal input.input >> nth=2', '').catch(() => {});
await page.locator('.modal input.input').last().fill('QA test receipt for demo validation').catch(() => {});
await page.screenshot({ path: path.join(OUT, 'new-transaction-modal.png'), fullPage: true });
const postDisabled = await page.locator('.modal button:has-text("Post transaction")').isDisabled().catch(() => null);
let posted = false;
if (postDisabled === false) {
  await page.locator('.modal button:has-text("Post transaction")').click();
  await page.waitForTimeout(900);
  posted = true;
}
const rowsAfter = await page.locator('table.table tbody tr').count();
await page.screenshot({ path: path.join(OUT, 'transactions-after-post.png'), fullPage: true });

/* ---------- interaction: transaction detail ---------- */
await page.locator('table.table tbody tr').first().click();
await page.waitForTimeout(600);
const detailOpen = await page.locator('.modal').count();
await page.screenshot({ path: path.join(OUT, 'transaction-detail.png'), fullPage: true });
await page.keyboard.press('Escape');

/* ---------- interaction: reports ---------- */
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const plText = await page.locator('.card-body').first().innerText();
for (const label of ['Trial Balance', 'Balance Sheet', 'Cash Flow']) {
  await page.click(`button.chip:has-text("${label}")`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `report-${label.toLowerCase().replace(/ /g, '-')}.png`), fullPage: true });
}
const integrity = await page.locator('.callout').last().innerText().catch(() => '');

/* ---------- interaction: approvals queue ---------- */
await page.goto(BASE + '/approvals', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const approvalRows = await page.locator('table.table tbody tr').count();
await page.screenshot({ path: path.join(OUT, 'approvals-queue.png'), fullPage: true });

/* ---------- interaction: document draft ---------- */
await page.goto(BASE + '/documents', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'documents.png'), fullPage: true });
const draftButtons = await page.locator('button:has-text("Prepare transaction draft")').count();

/* ---------- responsive check ---------- */
await page.setViewportSize({ width: 420, height: 900 });
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const menuVisible = await page.locator('.menu-btn').isVisible();
await page.screenshot({ path: path.join(OUT, 'mobile-dashboard.png'), fullPage: false });
await page.click('.menu-btn');
await page.waitForTimeout(400);
const sidebarOpen = await page.locator('.sidebar.open').count();
await page.screenshot({ path: path.join(OUT, 'mobile-sidebar.png'), fullPage: false });

await browser.close();

const uniqueConsole = [...new Set(consoleErrors)];
const uniquePage = [...new Set(pageErrors)];

console.log('\n===== ROUTE CHECK =====');
for (const r of report) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.route.padEnd(24)} title="${r.title}"`);
console.log('\n===== INTERACTIONS =====');
console.log('AI sales answer:', aiAnswer1.split('\n').slice(0, 3).join(' / ').slice(0, 220));
console.log('AI draft card rendered:', draftVisible > 0);
console.log('AI approve clicked:', approveClicked, '| toast:', toastText.replace(/\n/g, ' ').slice(0, 160));
console.log('Dashboard KPI sample:', kpiValues.slice(0, 4).join(' | '));
console.log('Transactions rows before/after post:', rowsBefore, '->', rowsAfter, '| posted:', posted, '| postDisabled@open:', postDisabled);
console.log('Transaction detail modal:', detailOpen > 0);
console.log('P&L first lines:', plText.split('\n').slice(0, 4).join(' / '));
console.log('Integrity callout:', integrity.replace(/\n/g, ' ').slice(0, 220));
console.log('Approval rows:', approvalRows);
console.log('Document draft buttons:', draftButtons);
console.log('Mobile menu visible:', menuVisible, '| sidebar opened:', sidebarOpen > 0);
console.log('\n===== CONSOLE ERRORS =====');
console.log(uniqueConsole.length ? uniqueConsole.join('\n') : 'none');
console.log('\n===== PAGE ERRORS =====');
console.log(uniquePage.length ? uniquePage.join('\n') : 'none');
fs.writeFileSync('qa-report.json', JSON.stringify({ report, uniqueConsole, uniquePage }, null, 2));
