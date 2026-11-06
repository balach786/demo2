/**
 * PHASE 5 — AI Secretary commands (required list + edge cases)
 * PHASE 6 — document upload / extraction / draft creation
 * PHASE 9 — security & demo-data safety checks (non-destructive)
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch, check, summary, goto, getState, resetDemo, money, lastToast } from './harness.mjs';
import { ai, analyze } from '../../.qa/figures-entry.js';

const TMP = path.resolve('qa-tmp');
fs.mkdirSync(TMP, { recursive: true });

const { browser, page, errors } = await launch();
const externalRequests = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('blob:')) {
    externalRequests.push(u);
  }
});

const ask = async (text) => {
  await page.fill('.chat-input', text);
  await page.locator('button:has-text("Send")').click();
  await page.waitForTimeout(1300);
  const bubbles = page.locator('.msg.ai .bubble');
  return await bubbles.last().innerText();
};

const stateNow = async () => getState(page);

/* ==================================================================== */
console.log('\n=== PHASE 5: REQUIRED AI COMMANDS ===');
await resetDemo(page);
await goto(page, '/ai');
const entriesBeforeAI = analyze(await stateNow()).entryCount;

const REQUIRED = [
  'Aaj ki total sales kitni hain?',
  'Aaj ke total expenses batao.',
  'Ahmed ka ledger dikhao.',
  'Is month ka profit calculate karo.',
  'Business ka current cash balance batao.',
  'Ali Traders ko kitni payment deni hai?',
  'Show me the last 10 transactions.',
  'Prepare a payment of Rs. 25,000 to ABC Traders.',
  'Show monthly revenue and expenses.',
];

const EXPECTED_INTENT = {
  'Aaj ki total sales kitni hain?': 'finance.sales',
  'Aaj ke total expenses batao.': 'finance.expenses',
  'Ahmed ka ledger dikhao.': 'party.ledger',
  'Is month ka profit calculate karo.': 'finance.profit',
  'Business ka current cash balance batao.': 'finance.cash',
  'Ali Traders ko kitni payment deni hai?': 'party.payable',
  'Show me the last 10 transactions.': 'accounting.transactions',
  'Prepare a payment of Rs. 25,000 to ABC Traders.': 'action.payment.draft',
  'Show monthly revenue and expenses.': 'finance.monthly_trend',
};

for (const cmd of REQUIRED) {
  const uiText = await ask(cmd);
  const exp = ai(cmd);
  const intentTag = await page.locator('.msg.ai .bubble .tag').last().innerText().catch(() => '');
  const shownIntent = intentTag.replace('intent:', '').trim();
  const numbersUI = [...new Set((uiText.match(/PKR\s?[\d,]+/g) || []).map((s) => Math.round(money(s))))].sort((a, b) => a - b);
  const expCorpus = [exp.text, ...(exp.metrics || []), ...(exp.tableRows || [])].join(' | ');
  const numbersExp = [...new Set((expCorpus.match(/PKR\s?[\d,]+/g) || []).map((s) => Math.round(money(s))))].sort((a, b) => a - b);
  // every number the UI shows must exist in the engine's answer for the same command
  const extraInUI = numbersUI.filter((n) => !numbersExp.includes(n));
  const numbersMatch = extraInUI.length === 0 && numbersUI.length > 0;

  check(`ai:${exp.intent}`, `"${cmd}" → correct intent + figures`, shownIntent === EXPECTED_INTENT[cmd] && numbersMatch,
    `intent=${shownIntent || '(none)'} invented=${extraInUI.join(',') || 'none'} uiNums=${numbersUI.length}`);
}

/* no postings from questions */
const afterQuestions = analyze(await stateNow());
const draftsCreated = afterQuestions.approvals.length - 5;
check('ai:no-postings', 'Questions never post to the ledger', afterQuestions.entryCount === entriesBeforeAI,
  `${entriesBeforeAI} → ${afterQuestions.entryCount}`);
check('ai:drafts-pending', 'Financial command created a pending draft (not a posting)', draftsCreated >= 1,
  `${draftsCreated} new approval(s)`);

/* ==================================================================== */
console.log('\n=== PHASE 5b: AI EDGE CASES ===');
await goto(page, '/ai');

// empty message
const msgsBefore = await page.locator('.msg').count();
await page.fill('.chat-input', '');
const sendDisabled = await page.locator('button:has-text("Send")').isDisabled();
await page.locator('button:has-text("Send")').click({ force: true }).catch(() => {});
await page.waitForTimeout(700);
const msgsAfter = await page.locator('.msg').count();
check('ai:empty', 'Empty message is blocked and adds no message', sendDisabled || msgsAfter === msgsBefore,
  `disabled=${sendDisabled} msgs ${msgsBefore}→${msgsAfter}`);

// whitespace only
await page.fill('.chat-input', '    ');
const wsDisabled = await page.locator('button:has-text("Send")').isDisabled();
check('ai:whitespace', 'Whitespace-only message is blocked', wsDisabled === true);

// unknown command
const unknown = await ask('What is the weather in Karachi tomorrow?');
check('ai:unknown', 'Unknown command gets a helpful guidance response (no invented figures)',
  /could not match|help with|madad kar sakta/i.test(unknown) && !/PKR/.test(unknown), unknown.slice(0, 120));

// missing party
const noParty = await ask('Record a payment of Rs. 5,000');
check('ai:missing-party', 'Missing party triggers a clarification question', /party|ABC Traders|batana/i.test(noParty),
  noParty.slice(0, 110));

// missing amount
const noAmount = await ask('Record a payment to ABC Traders');
check('ai:missing-amount', 'Missing amount triggers a clarification question', /kitna|what amount|amount should/i.test(noAmount),
  noAmount.slice(0, 110));

// invalid amount (zero / negative)
const zero = await ask('Prepare a payment of Rs. 0 to ABC Traders.');
check('ai:zero-amount', 'Zero amount does not create a draft', /kitna|what amount|amount should/i.test(zero), zero.slice(0, 110));
const negative = await ask('Prepare a payment of Rs. -5000 to ABC Traders.');
const negState = analyze(await stateNow());
const negDraft = negState.approvals[0];
check('ai:negative-amount', 'Negative amount is not blindly accepted as a positive payment',
  !(negDraft && negDraft.amount === 5000 && negState.approvals.length > 6),
  `approvals=${negState.approvals.length} latest=${negDraft ? negDraft.amount : 'n/a'}`);

// unavailable record
const missing = await ask('Show me the ledger for Crescent Textiles Limited.');
const missingState = analyze(await stateNow());
check('ai:unknown-party', 'Unknown party does not create a draft or fabricate a ledger',
  missingState.approvals.length === negState.approvals.length, missing.slice(0, 100));

// repeated command determinism
const first = await ask('Business ka current cash balance batao.');
const second = await ask('Business ka current cash balance batao.');
check('ai:repeat', 'Repeated command returns the same deterministic answer', first === second,
  `${first.slice(0, 60)} vs ${second.slice(0, 60)}`);

// injection attempt must be rendered as text, not executed
let dialogSeen = false;
page.on('dialog', async (d) => { dialogSeen = true; await d.dismiss(); });
const xss = await ask('<script>alert("xss")</script> Aaj ki total sales kitni hain?');
await page.waitForTimeout(600);
check('ai:xss', 'Script payload is treated as text (no dialog, no execution)', dialogSeen === false, `dialog=${dialogSeen}`);
check('ai:xss-text', 'Script payload is not injected as HTML', !(await page.locator('.msg.ai .bubble script').count()), 'ok');

// history + suggested prompts
const historyItems = await page.locator('.ai-side .prompt-item').count();
check('ai:history', 'Conversation history records commands', historyItems > 0, `${historyItems} entries`);
await goto(page, '/ai');
await page.locator('.ai-side .prompt-item').first().click();
await page.waitForTimeout(1300);
const chipAnswer = await page.locator('.msg.ai .bubble').last().innerText();
check('ai:suggested', 'Suggested prompt chip runs a real command', chipAnswer.length > 40, `${chipAnswer.length} chars`);

/* ==================================================================== */
console.log('\n=== PHASE 6: DOCUMENT UPLOAD ===');
await resetDemo(page);
await goto(page, '/documents');

// build test files
const pngPath = path.join(TMP, 'qa-receipt.png');
// 1x1 png
fs.writeFileSync(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const jpgPath = path.join(TMP, 'qa-invoice.jpg');
fs.writeFileSync(jpgPath, Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64'));
const pdfPath = path.join(TMP, 'qa-slip.pdf');
fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'));
const txtPath = path.join(TMP, 'qa-notes.txt');
fs.writeFileSync(txtPath, 'not a document');
const emptyPath = path.join(TMP, 'qa-empty.png');
fs.writeFileSync(emptyPath, Buffer.alloc(0));
const bigPath = path.join(TMP, 'qa-large.png');
fs.writeFileSync(bigPath, Buffer.concat([fs.readFileSync(pngPath), Buffer.alloc(6 * 1024 * 1024, 1)]));

const libCount = async () => page.locator('.card:has-text("Document library")').locator('div[role="button"]').count();

const upload = async (file) => {
  await page.setInputFiles('input[type="file"]', file);
  await page.waitForTimeout(900);
  return await lastToast(page);
};

const baseLib = await libCount();
check('doc:library', 'Document library lists the 3 bundled samples', baseLib === 3, `${baseLib}`);

let t = await upload(pngPath);
check('doc:png', 'PNG upload accepted with feedback', /Document added/i.test(t), t.slice(0, 90));
t = await upload(jpgPath);
check('doc:jpg', 'JPG upload accepted with feedback', /Document added/i.test(t), t.slice(0, 90));
t = await upload(pdfPath);
check('doc:pdf', 'PDF upload accepted with feedback', /Document added/i.test(t), t.slice(0, 90));
t = await upload(txtPath);
check('doc:unsupported', 'Unsupported file type is rejected with an error toast', /Unsupported/i.test(t), t.slice(0, 90));
t = await upload(emptyPath);
check('doc:empty', 'Zero-byte file is rejected with an explanation', /Empty file/i.test(t), t.slice(0, 90));
check('doc:empty-nocrash', 'Zero-byte file does not crash the app', (await page.locator('.page-title').count()) === 1, t.slice(0, 80));
t = await upload(bigPath);
check('doc:large', 'Large 6MB file uploads without crashing', (await page.locator('.page-title').count()) === 1, t.slice(0, 80));
t = await upload(pngPath);
check('doc:duplicate', 'Duplicate upload is handled and flagged', /duplicate name/i.test(t), t.slice(0, 100));
check('doc:duplicate-nocrash', 'Duplicate upload does not crash', (await page.locator('.page-title').count()) === 1, t.slice(0, 80));

const libAfter = await libCount();
check('doc:count', 'Uploaded documents appear in the library', libAfter >= baseLib + 5, `${baseLib} → ${libAfter}`);

// no invented extraction for user uploads
const amountField = page.locator('.card:has-text("Extracted fields") input[type="number"]');
const amountValue = await amountField.inputValue();
const partyValue = await page.locator('.card:has-text("Extracted fields") select').inputValue();
check('doc:no-invention', 'User uploads show NO invented extraction values', amountValue === '' && partyValue === '',
  `amount="${amountValue}" party="${partyValue}"`);

// draft requires an amount
await page.locator('button:has-text("Prepare transaction draft")').click();
await page.waitForTimeout(600);
const amountToast = (await page.locator('.toast').allInnerTexts().catch(() => [])).join(' ');
check('doc:guard', 'Draft creation blocked until an amount is entered', /Amount required/i.test(amountToast), amountToast.slice(0, 80));

// manual correction then draft
await amountField.fill('185000');
await page.locator('.card:has-text("Extracted fields") select').selectOption({ index: 1 });
await page.locator('.card:has-text("Extracted fields") input.input:not([type="number"]):not([type="date"])').fill('QA-REF-001');
const beforeDraft = analyze(await stateNow());
await page.locator('button:has-text("Prepare transaction draft")').click();
await page.waitForTimeout(1100);
check('doc:draft-route', 'Draft creation routes to Approvals', page.url().includes('/approvals'), page.url().replace(/^https?:\/\/[^/]+/, ''));
const afterDraft = analyze(await stateNow());
check('doc:draft-no-post', 'Document draft is NOT posted automatically', afterDraft.entryCount === beforeDraft.entryCount,
  `${beforeDraft.entryCount} → ${afterDraft.entryCount}`);
const docPending = afterDraft.approvals.filter((a) => a.status === 'pending').length;
check('doc:draft-pending', 'Document draft is pending approval', docPending >= 1, `${docPending} pending`);

// bundled sample extraction is present and labelled
await goto(page, '/documents');
await page.locator('text=HBL-Deposit-Slip-4417.pdf').first().click();
await page.waitForTimeout(500);
const samplePanel = await page.locator('.card:has-text("Extracted fields")').innerText();
check('doc:sample-extraction', 'Bundled sample shows an extraction with a confidence score',
  /Confidence\s*\d+%/i.test(samplePanel) && /Ahmed Enterprises|Ali Suppliers|Shahid Brothers/.test(samplePanel),
  samplePanel.replace(/\n/g, ' ').slice(0, 110));
check('doc:simulated-label', 'Extraction is explicitly labelled as simulated',
  /SIMULATED EXTRACTION/i.test(samplePanel), 'label present');

/* ==================================================================== */
console.log('\n=== PHASE 9: SECURITY & DEMO-DATA SAFETY ===');
await goto(page, '/');
await page.waitForTimeout(600);

check('sec:no-external-calls', 'Session makes no external network requests', externalRequests.length === 0,
  externalRequests.slice(0, 3).join(' | '));

const consoleText = await page.evaluate(() => document.documentElement.outerHTML);
const secretPatterns = [/mongodb\+srv/i, /sk-[A-Za-z0-9]{20,}/, /api[_-]?key\s*[:=]/i, /Bearer\s+[A-Za-z0-9._-]{20,}/, /password\s*[:=]/i];
const foundSecrets = secretPatterns.filter((re) => re.test(consoleText)).map(String);
check('sec:no-secrets-dom', 'No credentials or connection strings in the rendered DOM', foundSecrets.length === 0, foundSecrets.join(','));

const storageKeys = await page.evaluate(() => Object.keys(localStorage));
check('sec:storage-scope', 'localStorage holds only the isolated demo key', storageKeys.length === 1 && storageKeys[0] === 'absa.demo.state.v1',
  storageKeys.join(','));

const demoBadge = await page.locator('.demo-pill').first().innerText();
check('sec:demo-badge', 'DEMO MODE indicator is visible on the main screen', /demo mode/i.test(demoBadge), demoBadge);

const st = await stateNow();
check('sec:fictional-data', 'Dataset is fictional demo data (ABC Trading Company, no real PII)',
  st.business.name === 'ABC Trading Company' && st.parties.every((p) => /\.example$|@.*\.pk$/.test(p.email)), st.business.name);

// AI cannot post directly: approving is the only path
const beforeGate = analyze(await stateNow()).entryCount;
await goto(page, '/ai');
await ask('Prepare a payment of Rs. 7,000 to ABC Traders.');
const afterGate = analyze(await stateNow()).entryCount;
check('sec:approval-gate', 'AI commands cannot post to the ledger without approval',
  afterGate === beforeGate, `${beforeGate} → ${afterGate}`);

/* bundle scan (production build output) */
const distDir = path.resolve('dist/assets');
let bundleFindings = [];
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(distDir, f), 'utf8');
    for (const re of [/(sk-[A-Za-z0-9]{20,})/, /(mongodb\+srv:\/\/[^\s"']+)/, /(AIza[0-9A-Za-z_-]{20,})/, /(ghp_[A-Za-z0-9]{20,})/]) {
      const m = content.match(re);
      if (m) bundleFindings.push(`${f}: ${m[0].slice(0, 24)}…`);
    }
  }
}
check('sec:bundle-scan', 'Built JS bundle contains no API keys or DB connection strings', bundleFindings.length === 0,
  bundleFindings.join(' | '));

check('sec:console', 'No console/page errors during AI, document and security tests',
  errors.console.length === 0 && errors.page.length === 0,
  [...errors.console.slice(0, 3), ...errors.page.slice(0, 3)].join(' | '));

fs.writeFileSync('qa-shots/phase5-6-9-results.json', JSON.stringify(summary('PHASE 5+6+9'), null, 2));
await browser.close();
process.exit(0);
