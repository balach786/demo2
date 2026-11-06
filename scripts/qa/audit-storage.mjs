/**
 * STORAGE / PERSISTENCE AUDIT
 * Proves, in a real browser, that:
 *   – demo state is written to one designated key only
 *   – records survive a refresh and a second tab
 *   – Reset Demo Data needs confirmation, restores the seed, and never touches
 *     unrelated browser storage
 *   – corrupt / foreign / wrong-version payloads fall back to the seed instead of crashing
 *   – the app still runs when localStorage is unavailable
 */
import { chromium } from 'playwright';
import { check, summary, goto, getState, lastToast, BASE, money } from './harness.mjs';
import { analyze } from '../../.qa/figures-entry.js';

const KEY = 'absa.demo.state.v1';
const DECOYS = { 'unrelated.app.data': 'keep-me', theme: 'dark', 'absa.demo.other': 'keep-me-too', 'auth.token': 'not-a-real-token' };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const keys = () => page.evaluate(() => Object.keys(localStorage).sort());
const seed = analyze(await (async () => { await goto(page, '/'); return getState(page); })());

console.log('\n===== STORAGE AUDIT =====');
console.log(`Baseline seed: ${seed.entryCount} entries, cash ${seed.liquid.cash}`);

/* ---------- S1: first load ---------- */
await goto(page, '/');
let k = await keys();
check('S1', 'First load writes exactly one key, the designated demo key', k.length === 1 && k[0] === KEY, k.join(','));

const payload = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
check('S1b', 'Persisted payload is versioned and holds the demo dataset',
  payload.version === 1 && payload.data.entries.length === seed.entryCount && payload.data.business.name === 'ABC Trading Company',
  `v${payload.version}, ${payload.data.entries.length} entries, ${payload.data.business.name}`);

const sizeKb = await page.evaluate((key) => Math.round((localStorage.getItem(key) || '').length / 1024), KEY);
check('S1c', 'Payload size is reasonable for localStorage', sizeKb > 10 && sizeKb < 2048, `${sizeKb} KB`);

/* ---------- S2: plant unrelated keys ---------- */
await page.evaluate((decoys) => Object.entries(decoys).forEach(([k, v]) => localStorage.setItem(k, v)), DECOYS);
check('S2', 'Unrelated app keys planted for the isolation test', (await keys()).length === 5, (await keys()).join(','));

/* ---------- S3: create a record, verify it is persisted ---------- */
await goto(page, '/transactions?new=1');
await page.waitForSelector('.modal');
await page.locator('.modal button.chip:has-text("Money Paid")').click();
await page.locator('.modal label.field:has-text("Amount") input').fill('12345');
const supSel = page.locator('.modal label.field:has-text("Supplier") select');
const opts = await supSel.locator('option').allInnerTexts();
const idx = opts.findIndex((o) => /ABC Traders/.test(o));
await supSel.selectOption({ index: idx >= 0 ? idx : 1 });
await page.locator('.modal label.field:has-text("Description") input').fill('Persistence probe payment');
await page.locator('.modal button:has-text("Post transaction")').click();
await page.waitForTimeout(900);
const afterPost = await getState(page);
check('S3', 'Posting a voucher updates the persisted state immediately',
  afterPost.entries.length === seed.entryCount + 1, `${seed.entryCount} → ${afterPost.entries.length}`);

/* ---------- S4: refresh survives ---------- */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.page-title');
await page.waitForTimeout(600);
const afterReload = await getState(page);
const persistedRow = afterReload.entries.find((e) => e.description === 'Persistence probe payment');
check('S4', 'The record survives a full page refresh',
  !!persistedRow && afterReload.entries.length === seed.entryCount + 1,
  `entries=${afterReload.entries.length} ref=${persistedRow?.reference ?? 'MISSING'}`);

await goto(page, '/');
const cashAfter = await page.locator('.kpi').first().innerText();
const ledgerCash = analyze(afterReload).liquid.cash;
check('S4b', 'Dashboard figures after refresh match the persisted ledger',
  Math.round(money(cashAfter.split('\n')[0])) === Math.round(ledgerCash) || cashAfter.includes(String(Math.round(ledgerCash)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')),
  `UI="${cashAfter.replace(/\n/g, ' ').slice(0, 60)}" ledger=${ledgerCash}`);

/* ---------- S5: second tab shares the same store ---------- */
const page2 = await context.newPage();
await page2.goto(BASE + '/transactions', { waitUntil: 'domcontentloaded' });
await page2.waitForSelector('.page-title');
await page2.waitForTimeout(700);
const tab2State = await page2.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), KEY);
check('S5', 'A second tab sees the same persisted records',
  tab2State?.data?.entries?.length === seed.entryCount + 1, `${tab2State?.data?.entries?.length} entries`);
await page2.close();

/* ---------- S6: reset requires confirmation ---------- */
await goto(page, '/');
await page.locator('.icon-btn[aria-label="Reset demo data"]').click();
await page.waitForTimeout(350);
const confirmVisible = await page.locator('.modal').count();
check('S6', 'Reset opens a confirmation dialog instead of acting immediately', confirmVisible === 1);
await page.locator('.modal button:has-text("Cancel")').first().click();
await page.waitForTimeout(500);
const afterCancel = await getState(page);
check('S6b', 'Cancelling the reset leaves all demo data intact',
  afterCancel.entries.length === seed.entryCount + 1, `${afterCancel.entries.length} entries`);

/* ---------- S7: confirmed reset restores the seed ---------- */
await page.locator('.icon-btn[aria-label="Reset demo data"]').click();
await page.waitForTimeout(300);
await page.locator('.modal button:has-text("Reset demo data")').click();
await page.waitForTimeout(800);
const afterReset = await getState(page);
check('S7', 'Confirmed reset restores the seeded dataset',
  afterReset.entries.length === seed.entryCount &&
  !afterReset.entries.some((e) => e.description === 'Persistence probe payment'),
  `${afterReset.entries.length} entries`);

await goto(page, '/');
const cashReset = await page.locator('.kpi').first().innerText();
check('S7b', 'Dashboard returns to the seeded figure after reset',
  cashReset.includes('5,804,400'), cashReset.replace(/\n/g, ' ').slice(0, 60));

/* ---------- S8: reset must not touch other storage ---------- */
const keysAfterReset = await keys();
const decoysSurvived = Object.keys(DECOYS).every((d) => keysAfterReset.includes(d));
const decoyValues = await page.evaluate((decoys) => Object.fromEntries(Object.keys(decoys).map((k) => [k, localStorage.getItem(k)])), DECOYS);
const decoyValuesIntact = Object.entries(DECOYS).every(([k, v]) => decoyValues[k] === v);
check('S8', 'Reset only affects the designated demo key — unrelated keys survive untouched',
  decoysSurvived && decoyValuesIntact, `keys=${keysAfterReset.join(',')}`);

const foreignLeft = keysAfterReset.filter((x) => x !== KEY && !(x in DECOYS));
check('S8b', 'The app creates no storage keys beyond its own designated key',
  foreignLeft.length === 0, foreignLeft.join(',') || 'none');

/* ---------- S9: reset survives a refresh (no resurrection) ---------- */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.page-title');
await page.waitForTimeout(500);
const afterResetReload = await getState(page);
check('S9', 'After reset + refresh the demo is still on the seed (nothing resurrects)',
  afterResetReload.entries.length === seed.entryCount);

/* ---------- S10: corrupt payload ---------- */
await page.evaluate((key) => localStorage.setItem(key, '{ this is not valid json'), KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const afterCorrupt = await page.evaluate((key) => localStorage.getItem(key), KEY);
const corruptRendered = await page.locator('.page-title').count();
check('S10', 'Corrupt saved data does not white-screen the app',
  corruptRendered > 0 && errors.length === 0, `titles=${corruptRendered} errors=${errors.length}`);
check('S10b', 'Corrupt saved data is replaced by a clean seeded dataset',
  afterCorrupt.includes('ABC Trading Company'), `${afterCorrupt.length} chars rewritten`);

/* ---------- S11: wrong version ---------- */
await page.evaluate((key) => {
  const fresh = { version: 99, data: { business: { name: 'ABC Trading Company' }, entries: [], parties: [], accounts: [], approvals: [], documents: [], activity: [] } };
  localStorage.setItem(key, JSON.stringify(fresh));
}, KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const afterVersion = await getState(page);
check('S11', 'An unknown schema version is rejected and the seed is rebuilt',
  afterVersion.entries.length === seed.entryCount, `${afterVersion.entries.length} entries`);

/* ---------- S12: payload belonging to another business ---------- */
await page.evaluate((key) => {
  const raw = JSON.parse(localStorage.getItem(key));
  raw.data.business.name = 'Some Other Company Ltd';
  raw.data.entries = raw.data.entries.slice(0, 3);
  localStorage.setItem(key, JSON.stringify(raw));
}, KEY);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
const afterForeign = await getState(page);
check('S12', 'A payload that does not describe this demo business is not adopted',
  afterForeign.entries.length === seed.entryCount && afterForeign.business.name === 'ABC Trading Company',
  `${afterForeign.entries.length} entries, "${afterForeign.business.name}"`);

/* ---------- S13: approvals / documents survive refresh ---------- */
await goto(page, '/approvals');
await page.locator('button.chip:has-text("Pending Approval")').click();
await page.waitForTimeout(400);
const pendingBefore = (await getState(page)).approvals.filter((a) => a.status === 'pending').length;
await page.locator('button:has-text("Review")').first().click();
await page.waitForTimeout(500);
await page.locator('.modal button:has-text("Approve & post")').click();
await page.waitForTimeout(900);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
const afterApprovalReload = await getState(page);
const completed = afterApprovalReload.approvals.filter((a) => a.status === 'completed').length;
const seededCompleted = seed.approvals.filter((a) => a.status === 'completed').length;
check('S13', 'Approval decisions survive a refresh (not just transactions)',
  completed === seededCompleted + 1 && afterApprovalReload.entries.length === seed.entryCount + 1,
  `completed ${seededCompleted} → ${completed}, entries ${afterApprovalReload.entries.length}`);

check('S13b', 'No console/page errors during the whole storage run', errors.length === 0, errors.slice(0, 3).join(' | '));

/* ---------- S13c: a saved upload from a previous session must degrade gracefully ---------- */
await page.evaluate((key) => {
  const raw = JSON.parse(localStorage.getItem(key));
  raw.data.documents.push({
    id: 'DOC-QA-DEAD-BLOB', name: 'qa-receipt-from-yesterday.png', kind: 'bank-slip',
    uploadedAt: new Date().toISOString(), uploadedBy: 'Demo User', sizeLabel: '12 KB',
    isSample: false, status: 'extracted',
    extraction: { documentType: 'Unclassified upload', partyName: '—', amount: 0, date: '2026-11-06', confidence: 0, missingFields: ['Party'] },
    fileUrl: 'blob:http://localhost:5173/dead-blob-from-a-previous-session',
  });
  localStorage.setItem(key, JSON.stringify(raw));
}, KEY);
await goto(page, '/documents');
await page.locator('text=qa-receipt-from-yesterday.png').first().click();
await page.waitForTimeout(900);
const docPage = await page.locator('.page').innerText();
check('S13c', 'A saved upload whose preview URL expired shows a clear fallback (no broken image)',
  /No preview available/i.test(docPage) && /expired when this browser session ended/i.test(docPage),
  docPage.includes('No preview available') ? 'fallback shown' : 'BROKEN PREVIEW');

/* ---------- S14: cookies / session storage isolation ---------- */
const cookies = await context.cookies();
const sessionKeys = await page.evaluate(() => Object.keys(sessionStorage));
check('S14', 'The demo stores nothing in cookies or sessionStorage',
  cookies.length === 0 && sessionKeys.length === 0, `cookies=${cookies.length} session=${sessionKeys.length}`);

/* ---------- S15: localStorage unavailable ---------- */
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await ctx2.addInitScript(() => {
  const block = () => { throw new DOMException('QuotaExceededError'); };
  Storage.prototype.setItem = block;
  Storage.prototype.getItem = block;
  Storage.prototype.removeItem = block;
});
const page3 = await ctx2.newPage();
const bootErrors = [];
page3.on('pageerror', (e) => bootErrors.push(String(e)));
await page3.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page3.waitForTimeout(1200);
const rendered = await page3.locator('.page-title').count();
check('S15', 'App still boots and renders when localStorage throws', rendered > 0 && bootErrors.length === 0,
  `titles=${rendered} errors=${bootErrors.length}`);
await page3.goto(BASE + '/settings', { waitUntil: 'domcontentloaded' });
await page3.waitForTimeout(700);
const settingsText = await page3.locator('.page').innerText();
check('S15b', 'UI honestly reports that nothing is being persisted',
  /In memory only/i.test(settingsText), /In memory only/i.test(settingsText) ? 'shows "In memory only"' : 'status not shown');
await ctx2.close();

const out = summary('STORAGE / PERSISTENCE');
(await import('node:fs')).writeFileSync('qa-shots/storage-results.json', JSON.stringify(out, null, 2));
await browser.close();
process.exit(0);
