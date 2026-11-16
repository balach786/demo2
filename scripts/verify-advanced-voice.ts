/**
 * ADVANCED VOICE ASSISTANT VERIFICATION SUITE
 * Tests:
 * 1. Multi-turn conversation context slots & follow-up resolution
 * 2. Pronoun & reference resolution ("aur dirham?", "uska profit?", "aur Lahore mein?")
 * 3. Language detection (Urdu script, Roman Urdu, English, mixed phrasing)
 * 4. Deterministic business tools accuracy
 * 5. Security & read-only safety restrictions
 */

import { buildDemoDataset } from '../src/demo/seed';
import { ConversationManager } from '../src/ai/voice/conversationManager';
import { detectTextLanguage, resolveEffectiveLanguage } from '../src/ai/voice/languageDetection';
import { voiceAssistantService } from '../src/ai/voice/voiceAssistantService';
import {
  getDashboardSummary,
  getCurrencyBalances,
  getCurrencyProfit,
  getStockByWarehouse,
  getProductStock,
  getLowStockProducts,
  getImportsSummary,
  getExportsSummary,
  getCashAndBankSummary,
  getFinancialStatementsSummary,
} from '../src/ai/voice/businessTools';

const SEED_DATASET = buildDemoDataset();

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`  PASS  ${msg}`);
}

async function run() {
  console.log('\n=== ADVANCED CONVERSATIONAL VOICE ASSISTANT VERIFICATION ===\n');

  /* ------------------------------------------------------------------ */
  /* 1. Language Detection & Preferences                                */
  /* ------------------------------------------------------------------ */
  console.log('=== 1. LANGUAGE DETECTION & PREFERENCES ===');
  assert(detectTextLanguage('How many dollars do I have?') === 'en', 'Detects standard English');
  assert(detectTextLanguage('Mere paas kitne dollar hain?') === 'roman-urdu', 'Detects Roman Urdu');
  assert(detectTextLanguage('آج کی سیلز کتنی ہیں؟') === 'urdu', 'Detects Urdu script');
  assert(detectTextLanguage('Karachi warehouse ka stock dikhao') === 'roman-urdu', 'Detects mixed Urdu-English phrasing');
  assert(detectTextLanguage('What about last month?') === 'en', 'Detects English follow-up');

  assert(resolveEffectiveLanguage('en', 'auto') === 'en', 'Auto mode keeps English');
  assert(resolveEffectiveLanguage('roman-urdu', 'auto') === 'roman-urdu', 'Auto mode keeps Roman Urdu');
  assert(resolveEffectiveLanguage('en', 'ur') === 'roman-urdu', 'Urdu preference converts to Urdu/Roman response');
  assert(resolveEffectiveLanguage('roman-urdu', 'en') === 'en', 'English preference converts to English response');

  /* ------------------------------------------------------------------ */
  /* 2. Multi-Turn Context & Reference Resolution                       */
  /* ------------------------------------------------------------------ */
  console.log('\n=== 2. MULTI-TURN CONTEXT & REFERENCE RESOLUTION ===');
  const conv = new ConversationManager('auto');

  // Turn 1: User asks about USD
  const t1 = conv.resolveContextualIntent('Mere paas kitne dollars hain?', SEED_DATASET);
  assert(t1.explicitOrInferredCurrency === 'USD', 'Turn 1 extracts USD currency');
  conv.recordTurn(
    'Mere paas kitne dollars hain?',
    'Aapke paas 23,000 USD available hain.',
    'forex.usd_balance',
    'Currency Exchange',
    'Forex · USD Balance',
    { activeCurrency: 'USD', activeModule: 'forex' }
  );

  // Turn 2: User asks follow-up: "Aur dirham?"
  const t2 = conv.resolveContextualIntent('Aur dirham?', SEED_DATASET);
  assert(t2.isFollowUp === true, 'Turn 2 detects elliptical follow-up');
  assert(t2.referentSlot === 'currency', 'Turn 2 references currency slot');
  assert(t2.explicitOrInferredCurrency === 'AED', 'Turn 2 switches active currency to AED');
  conv.recordTurn(
    'Aur dirham?',
    'Aapke paas 50,000 AED available hain.',
    'forex.aed_balance',
    'Currency Exchange',
    'Forex · AED Balance',
    { activeCurrency: 'AED', activeModule: 'forex' }
  );

  // Turn 3: User asks pronoun reference: "Uska profit kitna hua?"
  const t3 = conv.resolveContextualIntent('Uska profit kitna hua?', SEED_DATASET);
  assert(t3.isFollowUp === true, 'Turn 3 detects pronoun reference');
  assert(t3.referentSlot === 'currency_profit', 'Turn 3 resolves "uska" to currency profit');
  assert(t3.explicitOrInferredCurrency === 'AED', 'Turn 3 maintains AED currency context');

  // Multi-Turn Warehouse Flow
  conv.clear();
  const w1 = conv.resolveContextualIntent('Karachi warehouse mein kitna stock hai?', SEED_DATASET);
  assert(w1.explicitOrInferredWarehouse === 'Main Warehouse', 'Warehouse Turn 1 extracts Karachi');
  conv.recordTurn(
    'Karachi warehouse mein kitna stock hai?',
    'Main Warehouse Karachi mein total stock details...',
    'trade.warehouse_stock',
    'Trade & Logistics',
    'Inventory · Warehouse Stock',
    { activeWarehouseName: 'Main Warehouse', activeModule: 'inventory' }
  );

  // Warehouse Turn 2: "Aur Lahore mein?"
  const w2 = conv.resolveContextualIntent('Aur Lahore mein?', SEED_DATASET);
  assert(w2.isFollowUp === true, 'Warehouse Turn 2 detected as follow-up');
  assert(w2.referentSlot === 'warehouse', 'Warehouse Turn 2 references warehouse slot');
  assert(w2.explicitOrInferredWarehouse === 'Lahore Distribution Center', 'Warehouse Turn 2 resolves to Lahore Distribution Center');

  /* ------------------------------------------------------------------ */
  /* 3. Deterministic Business Tools Verification                       */
  /* ------------------------------------------------------------------ */
  console.log('\n=== 3. DETERMINISTIC BUSINESS TOOLS AUDIT ===');
  const dash = getDashboardSummary(SEED_DATASET);
  assert(dash.salesFY === 23_896_700, 'Dashboard tool returns exact Sales FY (PKR 23,896,700)');
  assert(dash.totalLiquidity === 16_899_450, 'Dashboard tool returns exact liquid cash+bank (PKR 16,899,450)');
  assert(dash.inventoryValuation === 122_435_000, 'Dashboard tool returns exact inventory valuation (PKR 122,435,000)');
  assert(Math.round(dash.totalForexRealizedProfit) === 120_286, 'Dashboard tool returns exact realized forex gain (~PKR 120,286)');

  const usdBalance = getCurrencyBalances(SEED_DATASET, 'USD');
  assert(usdBalance.availableBalance === 23_000, 'Currency tool returns exact USD balance (23,000)');
  assert(Math.round(usdBalance.wacRatePKR ?? 0) === 279, 'Currency tool returns exact USD WAC (~279.14)');
  assert(Math.round(usdBalance.realizedProfitPKR ?? 0) === 52_286, 'Currency tool returns exact USD realized profit (PKR 52,286)');

  const fxProfit = getCurrencyProfit(SEED_DATASET);
  assert(Math.round(fxProfit.totalRealizedProfitPKR ?? 0) === 120_286, 'Profit tool returns exact cumulative profit (~PKR 120,286)');
  assert(fxProfit.aedProfitPKR === 36_000, 'Profit tool returns exact AED profit (PKR 36,000)');
  assert(fxProfit.irrProfitPKR === 32_000, 'Profit tool returns exact IRR profit (PKR 32,000)');

  const lowStock = getLowStockProducts(SEED_DATASET);
  assert(lowStock.count === 2, 'Low stock tool identifies exactly 2 reorder items');
  assert(lowStock.products.some((p) => p.name.includes('Saffron')), 'Identifies Saffron as low stock');
  assert(lowStock.products.some((p) => p.name.includes('Ball Bearings')), 'Identifies Ball Bearings as low stock');

  const statements = getFinancialStatementsSummary(SEED_DATASET);
  assert(statements.trialBalance.balanced === true, 'Statements tool confirms Trial Balance is balanced');
  assert(statements.trialBalance.difference === 0, 'Statements tool confirms Trial Balance diff is 0');
  assert(statements.balanceSheet.balanced === true, 'Statements tool confirms Balance Sheet is balanced');

  /* ------------------------------------------------------------------ */
  /* 4. End-to-End Voice Assistant Service Simulation                   */
  /* ------------------------------------------------------------------ */
  console.log('\n=== 4. END-TO-END VOICE ASSISTANT SERVICE ===');
  voiceAssistantService.clearConversation();

  // Test Query 1
  const res1 = await voiceAssistantService.processQuery('Mere paas kitna dollar available hai?', SEED_DATASET);
  assert(res1.result.intent === 'forex.usd_balance', 'Service routes query 1 to forex.usd_balance');
  assert(res1.turn.text.includes('23,000') && res1.turn.text.includes('USD'), 'Service response 1 includes exact 23,000 USD balance');

  // Test Follow-up Query 2: "Aur dirham?"
  const res2 = await voiceAssistantService.processQuery('Aur dirham?', SEED_DATASET);
  assert(res2.result.intent === 'forex.aed_balance', 'Service routes follow-up "Aur dirham?" to forex.aed_balance');
  assert(res2.turn.text.includes('50,000') && res2.turn.text.includes('AED'), 'Service response 2 includes exact 50,000 AED balance');

  // Test Follow-up Query 3: "Uska profit kitna hua?"
  const res3 = await voiceAssistantService.processQuery('Uska profit kitna hua?', SEED_DATASET);
  assert(res3.result.intent === 'forex.profit', 'Service routes pronoun "Uska profit" to forex.profit');
  assert(Boolean(res3.turn.text.includes('120,286') || res3.result.metrics?.some((m) => m.value.includes('120,286'))), 'Service response 3 includes verified profit figures');

  /* ------------------------------------------------------------------ */
  /* 5. Security & Safety Compliance                                    */
  /* ------------------------------------------------------------------ */
  console.log('\n=== 5. SECURITY & READ-ONLY SAFETY ===');
  const providerStatus = voiceAssistantService['providerAdapter'].getStatus();
  assert(providerStatus.isConnected === false, 'Honestly reports external cloud LLM is not connected');
  assert(providerStatus.providerType === 'deterministic-local', 'Provider is purely deterministic local engine');
  assert(providerStatus.securityNote.includes('Zero external network calls'), 'Zero external calls guaranteed');

  // Test action draft workflow
  const testState = { draftCreated: false };
  const actionRes = await voiceAssistantService.processQuery(
    'Prepare a payment of Rs. 25,000 to ABC Traders.',
    SEED_DATASET,
    (draft) => {
      testState.draftCreated = true;
      assert(draft.draft.amount === 25_000, 'Draft amount is exact 25,000');
      assert(draft.draft.partyId === 'SUP-001', 'Draft party is ABC Traders');
      return 'approval-123';
    }
  );

  assert(testState.draftCreated, 'Financial action creates draft callback');
  assert(actionRes.result.intent === 'action.payment.draft', 'Intent is action.payment.draft');
  assert(actionRes.turn.approvalId === 'approval-123', 'Turn attaches approval ID for human confirmation');

  console.log('\n=== ALL ADVANCED VOICE ASSISTANT VERIFICATION CHECKS PASSED ===\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
