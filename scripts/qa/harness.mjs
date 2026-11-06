/**
 * Shared browser-QA harness (Playwright).
 * No app code is imported here — everything is driven through the real UI.
 */
import { chromium } from 'playwright';

export const BASE = process.env.BASE_URL || 'http://localhost:5173';
export const STORAGE_KEY = 'absa.demo.state.v1';

export const results = [];
let passCount = 0;
let failCount = 0;

export function check(id, label, ok, detail = '') {
  results.push({ id, label, status: ok ? 'PASS' : 'FAIL', detail: String(detail).slice(0, 400) });
  ok ? passCount++ : failCount++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${id}] ${label}${detail ? ` — ${String(detail).slice(0, 180)}` : ''}`);
  return ok;
}

export function summary(name) {
  console.log(`\n===== ${name}: ${failCount === 0 ? 'ALL CHECKS PASSED' : `${failCount} FAILURE(S)`} (${passCount} passed / ${passCount + failCount} total) =====\n`);
  return { name, pass: passCount, fail: failCount, results };
}

export function failCountTotal() {
  return failCount;
}

export async function launch({ width = 1440, height = 960 } = {}) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = { console: [], page: [], network: [] };

  page.on('console', (m) => {
    if (m.type() === 'error') errors.console.push(m.text());
  });
  page.on('pageerror', (e) => errors.page.push(String(e)));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.network.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => errors.network.push(`FAILED ${r.url()}`));

  return { browser, context, page, errors };
}

/** Parse "PKR 5,804,400" / "PKR (1,234)" / "12,500" into a number. */
export function money(text) {
  if (text == null) return NaN;
  const cleaned = String(text).replace(/[^\d.,()\-]/g, '').trim();
  const negative = /^\(/.test(cleaned) || cleaned.includes('-');
  const n = Number(cleaned.replace(/[(),\-]/g, ''));
  return negative ? -n : n;
}

export async function goto(page, path, { settle = 450 } = {}) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.page-title, .empty-title', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(settle);
}

/** Read the demo state that the app actually persisted in the browser. */
export async function getState(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return parsed.data ?? parsed;
}

/** Click the topbar reset control and confirm. */
export async function resetDemo(page) {
  await goto(page, '/');
  await page.locator('.icon-btn[aria-label="Reset demo data"]').click();
  await page.waitForTimeout(300);
  await page.locator('.modal button:has-text("Reset demo data")').click();
  await page.waitForTimeout(700);
}

/** Text of the most recent toast only (toasts accumulate in the DOM). */
export async function lastToast(page) {
  const all = await page.locator('.toast').allInnerTexts().catch(() => []);
  return (all[all.length - 1] ?? '').replace(/\n/g, ' ').trim();
}

/** Read all KPI cards as { label -> { value, meta } }. */
export async function readKpis(page) {
  const cards = page.locator('.kpi');
  const n = await cards.count();
  const out = {};
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    const label = (await card.locator('.kpi-label').innerText().catch(() => '')).trim();
    const value = (await card.locator('.kpi-value').innerText().catch(() => '')).trim();
    if (label) out[label] = { value: money(value), raw: value, meta: (await card.locator('.kpi-meta').innerText().catch(() => '')).trim() };
  }
  return out;
}

/** Set the global reporting period through the topbar modal. */
export async function setPeriod(page, label) {
  await page.locator('.topbar .btn:has-text("This Year"), .topbar .btn:has-text("This Month"), .topbar .btn:has-text("Today"), .topbar .btn:has-text("This Week"), .topbar .btn:has-text("Last Month")').first().click();
  await page.waitForTimeout(300);
  await page.locator(`.modal button.chip:has-text("${label}")`).click();
  await page.waitForTimeout(600);
}
