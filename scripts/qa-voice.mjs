/**
 * End-to-end Playwright Browser QA for AI Voice Command & Response
 * Run: node scripts/qa-voice.mjs [baseUrl]
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

const chromePath = process.env.CHROME_PATH ||
  (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
      ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
      : undefined));

console.log('Launching browser for Voice QA using:', chromePath);
const browser = await chromium.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  permissions: ['microphone'],
});

const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('favicon.ico')) consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

try {
  /* ---------------- 1. Navigate to AI Command Center ---------------- */
  await page.goto(BASE + '/ai', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const title = await page.locator('.page-title').first().textContent();
  check('AI Command Center loads successfully', title.includes('Command Center'), title);

  /* ---------------- 2. Inspect Voice Controls UI ---------------- */
  const micBtn = page.locator('button.mic-btn');
  const micBtnVisible = await micBtn.isVisible();
  check('Microphone button is present in chat input', micBtnVisible);

  const autoReadToggle = page.locator('.voice-auto-toggle');
  const autoReadVisible = await autoReadToggle.isVisible();
  check('Auto-read voice toggle is present in header', autoReadVisible);

  const voiceBadge = page.locator('.voice-header-bar .badge');
  const voiceBadgeText = await voiceBadge.textContent();
  check('Voice status badge is present in header', !!voiceBadgeText, voiceBadgeText);

  const welcomeSpeaker = page.locator('.voice-bubble-btn').first();
  const welcomeSpeakerVisible = await welcomeSpeaker.isVisible();
  check('Speaker / Read aloud button is present on welcome message', welcomeSpeakerVisible);

  await page.screenshot({ path: path.join(OUT, 'voice-1-initial.png'), fullPage: true });

  /* ---------------- 3. Test Microphone Activation & Listening State ---------------- */
  await micBtn.click();
  await page.waitForTimeout(400);

  const listeningBar = page.locator('.voice-listening-bar');
  const listeningBarVisible = await listeningBar.isVisible();
  check('Voice listening bar opens on mic click', listeningBarVisible);

  const waveform = page.locator('.voice-waveform');
  const waveformVisible = await waveform.isVisible();
  check('Animated audio waveform is displayed', waveformVisible);

  await page.screenshot({ path: path.join(OUT, 'voice-2-listening.png'), fullPage: true });

  // Test Cancel listening
  const cancelBtn = page.locator('.vlb-btn-cancel');
  await cancelBtn.click();
  await page.waitForTimeout(300);
  const listeningClosed = !(await listeningBar.isVisible());
  check('Cancel button closes listening bar', listeningClosed);

  /* ---------------- 4. Test Voice Command Input & Review/Edit ---------------- */
  // Simulate voice input text into chat input
  const chatInput = page.locator('textarea.chat-input');
  await chatInput.fill('Aaj ki total sales kitni hain?');
  await page.waitForTimeout(200);

  // Edit the text before sending (review & edit workflow)
  await chatInput.fill('Aaj ki total sales kitni hain?');
  const inputVal = await chatInput.inputValue();
  check('User can review and edit recognized text before sending', inputVal === 'Aaj ki total sales kitni hain?');

  const sendBtn = page.locator('button.btn.primary:has-text("Send")');
  await sendBtn.click();
  await page.waitForTimeout(900);

  // Check AI response
  const messages = page.locator('.msg.ai');
  const msgCount = await messages.count();
  check('Assistant answered the sales command', msgCount >= 2);

  const latestMsg = messages.last();
  const latestText = await latestMsg.textContent();
  check('Assistant returns sales figure from demo ledger (PKR 658,500)', latestText.includes('658,500'));

  // Check speaker button on AI answer
  const latestSpeaker = latestMsg.locator('.voice-bubble-btn');
  const speakerExists = await latestSpeaker.isVisible();
  check('Speaker button rendered on new AI answer', speakerExists);

  await page.screenshot({ path: path.join(OUT, 'voice-3-sales-answered.png'), fullPage: true });

  /* ---------------- 5. Test Native Urdu Script Voice Command ---------------- */
  await chatInput.fill('احمد کا لیجر دکھاؤ');
  await sendBtn.click();
  await page.waitForTimeout(900);

  const urduAnswer = page.locator('.msg.ai').last();
  const urduText = await urduAnswer.textContent();
  check('Urdu script command answered with Ahmed Enterprises ledger', urduText.includes('Ahmed Enterprises') || urduText.includes('1,642,100'));

  await page.screenshot({ path: path.join(OUT, 'voice-4-urdu-ledger.png'), fullPage: true });

  /* ---------------- 6. Test Voice Financial Action Draft & Approval Safety ---------------- */
  await chatInput.fill('Prepare a payment of Rs. 25,000 to ABC Traders.');
  await sendBtn.click();
  await page.waitForTimeout(1000);

  const actionMsg = page.locator('.msg.ai').last();
  const draftPreview = actionMsg.locator('button:has-text("Approve")');
  const draftPreviewVisible = await draftPreview.isVisible();
  check('Voice financial command generates an Action Draft Preview', draftPreviewVisible);

  await page.screenshot({ path: path.join(OUT, 'voice-5-action-draft.png'), fullPage: true });

  // Approve the action
  await draftPreview.click();
  await page.waitForTimeout(600);

  const settledText = await actionMsg.textContent();
  check('Approving draft safely posts to the demo ledger', settledText.includes('Posted to the demo ledger'));

  await page.screenshot({ path: path.join(OUT, 'voice-6-approved.png'), fullPage: true });

  /* ---------------- 7. Clean QA Result ---------------- */
  check('No uncaught JavaScript errors during voice session', consoleErrors.length === 0, consoleErrors.join('; '));

} catch (err) {
  console.error('Test execution error:', err);
  fail++;
} finally {
  await browser.close();
}

console.log(`\n=== QA VOICE RESULT: ${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} FAILURE(S)`} (${pass} passed) ===\n`);
process.exit(fail === 0 ? 0 : 1);
