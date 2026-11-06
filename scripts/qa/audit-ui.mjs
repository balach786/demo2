/**
 * PHASE 2 / 8 — startup, routing, console health, responsive layout.
 * Runs every route at 4 viewport sizes and reports overflow, blank pages,
 * broken assets, console errors and network failures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BASE, launch, check, summary, goto } from './harness.mjs';

const OUT = path.resolve('qa-shots');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ['/', 'Dashboard'],
  ['/ai', 'AI Command Center'],
  ['/parties', 'Parties'],
  ['/parties/CUS-001', 'Party detail'],
  ['/chart-of-accounts', 'Chart of Accounts'],
  ['/transactions', 'Transactions'],
  ['/ledgers', 'Ledgers'],
  ['/banks', 'Bank Accounts'],
  ['/income-expenses', 'Expenses & Income'],
  ['/reports', 'Financial Reports'],
  ['/documents', 'Documents'],
  ['/approvals', 'Approvals'],
  ['/settings', 'Settings'],
];

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const { browser, page, errors } = await launch();

console.log('\n=== PHASE 2: STARTUP, ROUTING, CONSOLE HEALTH ===');
for (const [route, label] of ROUTES) {
  const before = errors.console.length + errors.page.length;
  await goto(page, route, { settle: 500 });
  const titleCount = await page.locator('.page-title').count();
  const bodyText = (await page.locator('#root').innerText().catch(() => '')).trim();
  const newErrors = errors.console.length + errors.page.length - before;
  const brokenImgs = await page.evaluate(() =>
    Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(0, 80)),
  );
  check(`startup:${route}`, `${label} renders (${route})`,
    titleCount >= 1 && bodyText.length > 200 && newErrors === 0 && brokenImgs.length === 0,
    `title=${titleCount} body=${bodyText.length} errs=${newErrors} brokenImgs=${brokenImgs.length}`);
}

/* any 404 / failed request during the sweep? */
check('startup:network', 'No failed HTTP responses during route sweep', errors.network.length === 0,
  errors.network.slice(0, 3).join(' | '));

/* -------- sidebar navigation (click-through, not just URL loads) -------- */
console.log('\n=== PHASE 8a: SIDEBAR NAVIGATION (click-through) ===');
await goto(page, '/');
const navLinks = await page.locator('.sidebar .nav-item').allInnerTexts();
check('nav:count', 'Sidebar exposes 12 working destinations', navLinks.length === 12, `${navLinks.length} items`);
let navOk = 0;
for (const rawLabel of navLinks) {
  const label = rawLabel.split('\n')[0].trim();
  await page.locator('.sidebar .nav-item', { hasText: label }).first().click();
  await page.waitForTimeout(320);
  const active = await page.locator('.nav-item.active').innerText().catch(() => '');
  const hasTitle = await page.locator('.page-title').count();
  if (active.includes(label.split(' ')[0]) && hasTitle > 0) navOk++;
  else console.log(`   nav mismatch for "${label}" → active="${active.split('\n')[0]}"`);
}
check('nav:clickthrough', 'Every sidebar item navigates to its own page', navOk === navLinks.length, `${navOk}/${navLinks.length}`);

/* unknown route redirects home */
await goto(page, '/this-route-does-not-exist', { settle: 600 });
check('nav:fallback', 'Unknown route redirects to dashboard', page.url().replace(BASE, '') === '/', page.url().replace(BASE, ''));

/* -------- responsive sweep -------- */
console.log('\n=== PHASE 8b: RESPONSIVE LAYOUT (overflow / clipping) ===');
for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  let overflowRoutes = [];
  for (const [route] of ROUTES) {
    await goto(page, route, { settle: 320 });
    const metrics = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      clipped: Array.from(document.querySelectorAll('.card, .kpi, .chat-card, .table-wrap'))
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2).length,
    }));
    const overflow = metrics.scrollW - metrics.clientW;
    if (overflow > 2 || metrics.clipped > 0) overflowRoutes.push(`${route}(+${overflow}px,clip:${metrics.clipped})`);
  }
  check(`responsive:${vp.name}`, `No horizontal overflow at ${vp.width}×${vp.height}`, overflowRoutes.length === 0,
    overflowRoutes.join(' '));

  // mobile drawer only where applicable
  if (vp.width <= 1024) {
    await goto(page, '/');
    const menuVisible = await page.locator('.menu-btn').isVisible();
    let drawerWorks = false;
    if (menuVisible) {
      await page.locator('.menu-btn').click();
      await page.waitForTimeout(400);
      drawerWorks = (await page.locator('.sidebar.open').count()) > 0;
      await page.screenshot({ path: path.join(OUT, `responsive-${vp.name}-sidebar.png`) });
      await page.locator('.sidebar-overlay').click({ position: { x: 5, y: 5 } }).catch(() => {});
    }
    check(`responsive:${vp.name}:drawer`, `Mobile drawer opens at ${vp.width}px`, menuVisible && drawerWorks,
      `menu=${menuVisible} opened=${drawerWorks}`);
  } else {
    const sidebarVisible = await page.locator('.sidebar').isVisible();
    check(`responsive:${vp.name}:sidebar`, `Persistent sidebar visible at ${vp.width}px`, sidebarVisible);
  }

  await goto(page, '/');
  await page.screenshot({ path: path.join(OUT, `responsive-${vp.name}-dashboard.png`), fullPage: false });
  await goto(page, '/transactions');
  await page.screenshot({ path: path.join(OUT, `responsive-${vp.name}-transactions.png`), fullPage: false });
}

/* -------- empty / error state presence -------- */
console.log('\n=== PHASE 8c: EMPTY & FILTER STATES ===');
await page.setViewportSize({ width: 1440, height: 960 });
await goto(page, '/transactions');
await page.fill('.input-group .input', 'ZZZ-no-such-voucher-999');
await page.waitForTimeout(500);
const emptyVisible = await page.locator('.empty-title').isVisible().catch(() => false);
check('ui:empty-state', 'Search with no matches shows an empty state', emptyVisible);

// clear
await page.locator('button:has-text("Clear")').click();
await page.waitForTimeout(400);

// toasts
await goto(page, '/ai');
await page.fill('.chat-input', 'Check whether the books are balanced.');
await page.locator('button:has-text("Send")').click();
await page.waitForTimeout(1200);
const aiAnswered = await page.locator('.msg.ai .bubble').last().innerText();
check('ui:feedback', 'AI action produces a visible response bubble', aiAnswered.length > 40, `${aiAnswered.length} chars`);

check('ui:console-health', 'No console or page errors during the UI sweep',
  errors.console.length === 0 && errors.page.length === 0,
  [...errors.console.slice(0, 3), ...errors.page.slice(0, 3)].join(' | '));

fs.writeFileSync('qa-shots/phase2-8-results.json', JSON.stringify(summary('PHASE 2 + 8'), null, 2));
await browser.close();
process.exit(0);
