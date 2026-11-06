/**
 * Server-render smoke test: renders every route in a jsdom environment and
 * checks for crashes, key content and basic accounting markers.
 * Run: node scripts/smoke.mjs
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost:5173/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.navigator = window.navigator;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.localStorage = window.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
globalThis.matchMedia = window.matchMedia;
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.URL.createObjectURL = () => 'blob:mock';
globalThis.IS_REACT_ACT_ENVIRONMENT = false;

const { renderRoute } = await import('../.smoke/smoke-entry.js');

/** Normalise SSR output: strip React comment separators and decode entities. */
function norm(html) {
  return html
    .replace(/<!--\s*-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

const CASES = [
  ['/', ['Business at a glance', 'Total Cash Balance', 'Recent Transactions', 'Top Customers']],
  ['/ai', ['Command Center', 'Suggested prompts', 'AI Business Secretary']],
  ['/parties', ['Parties', 'Ahmed Enterprises', 'ABC Traders']],
  ['/parties/CUS-001', ['Ahmed Enterprises', 'Ledger history', 'Current balance']],
  ['/chart-of-accounts', ['Chart of Accounts', 'Cash in Hand', 'Cost of Goods Sold']],
  ['/transactions', ['Transactions', 'New transaction', 'Ledger vouchers']],
  ['/ledgers', ['Ledgers', 'Opening balance', 'Closing balance']],
  ['/banks', ['Bank Accounts', 'HBL Business Account', 'Meezan Business Account']],
  ['/income-expenses', ['Expenses & Income', 'Expense breakdown', 'Recent sales invoices']],
  ['/reports', ['Financial Reports', 'Profit & Loss', 'Total revenue']],
  ['/documents', ['Document Intelligence', 'Extracted fields', 'Simulated extraction']],
  ['/approvals', ['Approvals', 'Action queue', 'Pending Approval']],
  ['/settings', ['Settings', 'Feature status matrix', 'Integrations']],
];

let failures = 0;
console.log('\n===== SERVER-RENDER SMOKE TEST =====');
for (const [route, needles] of CASES) {
  let html = '';
  let error = null;
  try {
    html = norm(renderRoute(route));
  } catch (e) {
    error = e;
  }
  if (error) {
    failures++;
    console.log(`FAIL  ${route.padEnd(24)} crashed: ${error.message.split('\n')[0]}`);
    continue;
  }
  const missing = needles.filter((n) => !html.includes(n));
  const hasNav = html.includes('Dashboard') && html.includes('Approvals');
  const ok = missing.length === 0 && hasNav && html.length > 2000;
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(24)} ${String(html.length).padStart(7)} bytes` +
    (missing.length ? ` | missing: ${missing.join(', ')}` : '') +
    (hasNav ? '' : ' | nav not rendered'),
  );
}

/* consistency: dashboard KPI numbers must appear from the ledger */
const dash = norm(renderRoute('/'));
const pl = norm(renderRoute('/reports'));
const extract = (html, re) => (html.match(re) || [])[1];
const dashSales = extract(dash, /Total Sales[\s\S]{0,400}?PKR\s?([\d,]+)/);
const reportRevenue = extract(pl, /Total revenue<\/td><td class="num">PKR\s?([\d,]+)/);
console.log(`\nDashboard Total Sales: ${dashSales} | Report Total revenue: ${reportRevenue}`);
const consistent = dashSales && reportRevenue && dashSales === reportRevenue;
if (!consistent) failures++;
console.log(`${consistent ? 'PASS' : 'FAIL'}  Dashboard sales == P&L revenue`);

// balanced markers
const balanceMarker = dash.includes('Books balanced') && dash.includes('journal entries');
if (!balanceMarker) failures++;
console.log(`${balanceMarker ? 'PASS' : 'FAIL'}  Dashboard shows "Books balanced"`);

console.log(`\n===== RESULT: ${failures === 0 ? 'ALL SMOKE CHECKS PASSED' : failures + ' FAILURE(S)'} =====\n`);
if (typeof process !== 'undefined') process.exit(failures === 0 ? 0 : 1);
