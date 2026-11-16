# ADVANCED AI VOICE ASSISTANT AUDIT & ARCHITECTURE PLAN
**AI Business Secretary & Accountant Management System**

**Audit Date:** November 2026  
**Project Architecture:** React 18 + TypeScript + Vite + Tailwind CSS / Vanilla CSS  
**Persistence Layer:** Browser `localStorage` (`absa.demo.state.v1`) + React Context Store  
**Scope:** Upgrade from basic single-turn voice commands to an **Advanced Conversational Voice Assistant (Option A)** supporting Urdu and English with multi-turn conversation context, entity resolution, and deterministic business tools.

---

## 1. Executive Summary

This audit assesses the existing speech, AI, and business logic infrastructure within the project. 

The application currently has a solid client-side foundation:
- A responsive Web Speech API speech-to-text controller (`VoiceRecognitionController`).
- A Text-to-Speech synthesis controller (`VoiceSynthesisController`) with Markdown text sanitization and Urdu voice fallback detection.
- A deterministic single-turn rule-based intent router (`runAiCommand`).
- A rich double-entry accounting engine (`accounting.ts`), multi-warehouse inventory engine, and multi-currency exchange desk (`tradeLogic.ts`).

**The Core Limitation Identified:**
The current AI engine is completely **stateless**. Every command is processed in total isolation without awareness of prior turns. Pronouns and follow-up queries (such as *"Aur dirham?"*, *"Uska profit kitna hua?"*, *"Aur Lahore mein?"*, *"What about last month?"*) cannot resolve their referent entity or topic.

This document lays out the architectural upgrade to introduce:
1. **Conversation Context Manager & Slot Tracking** across turns.
2. **Contextual Reference & Pronoun Resolver** for Urdu (*uska, iska, aur, wahan*) and English (*it, that, and for, there*).
3. **Language-Aware Speech & Text Routing** (Urdu, English, Roman Urdu with Auto/Urdu/English preference).
4. **Decoupled Business Tools Layer** providing audited, read-only data access.
5. **Secure Provider Adapter Architecture** (deterministic browser engine + pluggable external LLM proxy boundary without leaking keys).

---

## 2. Detailed Audit of Existing Codebase

### 2.1 Voice Input & Microphone Handling
* **Location:** `src/voice/speechRecognition.ts` & `src/components/VoiceControls.tsx`
* **Mechanism:**
  - Uses `window.SpeechRecognition` or `window.webkitSpeechRecognition`.
  - Captures microphone stream via `navigator.mediaDevices.getUserMedia({ audio: true })` to power an `AudioContext` and `AnalyserNode`.
  - Calculates real-time root-mean-square audio energy (0.0 to 1.0) to drive the dynamic 7-bar `VoiceWaveform` component.
  - Manages states: `idle`, `requesting`, `listening`, `processing`, `error`, `unsupported`.
  - Provides a listening preview bar (`VoiceListeningBar`) with interim transcripts.
  - Places recognized speech into the input field for user review and editing before dispatch.
* **Limitations:**
  - Language selection is currently manual (`ur-PK`, `en-US`, `en-PK`); lacks automatic language detection and seamless dynamic switching.
  - Firefox and unsupported browsers display an alert but lack an integrated simulated voice mode for demo testing.

### 2.2 Speech Synthesis (Voice Output)
* **Location:** `src/voice/speechSynthesis.ts`
* **Mechanism:**
  - Uses `window.speechSynthesis` and `SpeechSynthesisUtterance`.
  - `cleanTextForSpeech` removes Markdown characters (`**`, `#`, `*`, `_`), URL links, and formats currency (`PKR 25,000` $\rightarrow$ `25,000 rupees`).
  - `getBestVoice` searches for native Urdu OS voices (e.g., Microsoft Asad/Gul, Google ur-PK) and falls back gracefully to system English voice with a clear visual fallback badge.
  - Provides Play, Pause, Resume, and Stop controls per message bubble.
  - Persists an `autoPlayVoice` toggle in `localStorage` (`ai_secretary_voice_auto_play`).
* **Limitations:**
  - Speech rate and pitch controls are not exposed in a dedicated settings panel.
  - Synthesis is triggered on a per-message basis without a global voice assistant status bar.

### 2.3 AI Command Engine & Interpretation
* **Location:** `src/ai/engine.ts`
* **Mechanism:**
  - Single entry point: `runAiCommand(input: string, ds: DemoDataset): AiResult`.
  - Detects language: checks Arabic script unicode regex `[\u0600-\u06FF]` or counts Roman Urdu markers (`aaj`, `kitni`, `batao`, `munafa`, etc.).
  - Extracts entities: party aliases (`PARTY_ALIASES`), currency amounts (`parseAmount`), periods (`detectPeriod`).
  - Matches 20+ business intents (sales, expenses, profit, cash, ledgers, approvals, forex, warehouses, transfers, imports, exports).
* **Limitations:**
  - **Zero context memory:** Does not accept previous conversation history, previous intent, or entity slots.
  - **No reference resolution:** Does not understand *"aur dirham?"* after *"how many dollars do I have?"*.
  - **Direct coupling:** Business calculations are embedded directly within string-matching conditional blocks instead of cleanly separated into reusable business tool interfaces.

### 2.4 Shared Demo Data & Financial Calculators
* **Location:** `src/demo/store.tsx`, `src/demo/accounting.ts`, `src/demo/tradeLogic.ts`
* **Available Verified Business Functions:**
  - `profitAndLoss(ds, range)`: Net profit, revenue, COGS, opex.
  - `trialBalance(ds)`: DR/CR trial balance (PKR 108,539,000).
  - `balanceSheet(ds)`: Assets, liabilities, equity (PKR 28,082,950).
  - `partyBalance(ds, partyId)` & `partyLedger(ds, partyId)`: Customer/supplier ledgers.
  - `sumAccounts(ds, accountIds)`: Liquid cash & bank balances.
  - `computeFxBalances(fxTransactions)`: USD, AED, IRR balances, WAC rates, realized P&L.
  - `getProductTotalStock(product)` & `calculateTotalInventoryValuation(products)`: Multi-warehouse stock and valuation.
  - `DEMO_IMPORTS` & `DEMO_EXPORTS`: In-transit shipments and net realization.
* **Integrity:**
  - Pure deterministic TypeScript logic.
  - 100% synchronized with `localStorage` key `absa.demo.state.v1`.

---

## 3. Architecture Blueprint for Advanced Voice Assistant

```
+---------------------------------------------------------------------------------------+
|                                    USER INTERFACE                                     |
|  [VoiceConversationPanel]  /  [AiCommandCenter]                                       |
|  - Real-time Listening Waveform     - Multilingual Transcript (Urdu / English / Roman)|
|  - Voice Input / Text Input         - Spoken Audio Playback & Replay Controls          |
|  - Language Setting (Auto/Ur/En)    - Voice Settings (Speed, Auto-Speak, Voice Info)  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                             VOICE ASSISTANT SERVICE                                   |
|  `src/ai/voice/voiceAssistantService.ts`                                              |
|  Coordinates STT, Language Detection, Conversation State, Tool Calling, and TTS      |
+---------------------------------------------------------------------------------------+
          |                                                               |
          v                                                               v
+----------------------------------+            +---------------------------------------+
|     SPEECH RECOGNITION (STT)     |            |       SPEECH SYNTHESIS (TTS)          |
|  - Language-aware Web Speech API |            |  - Urdu Native & System Fallback      |
|  - Auto Urdu (ur-PK) / English   |            |  - Natural Markdown & Number Cleaner  |
|  - Real-time audio analyser      |            |  - Play / Pause / Resume / Stop       |
+----------------------------------+            +---------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       CONVERSATION & CONTEXT MANAGER                                  |
|  `src/ai/voice/conversationManager.ts`                                                |
|  - Multi-Turn History (User & Assistant turns)                                        |
|  - Active Context Slots:                                                              |
|      * activeModule: 'forex' | 'inventory' | 'accounting' | 'trade'                   |
|      * activeCurrency: 'USD' | 'AED' | 'IRR'                                          |
|      * activeWarehouse: 'wh-khi-main' | 'wh-khi-port' | 'wh-dxb-01' | 'wh-lhr-01'     |
|      * activeProduct: SKU / Name                                                      |
|      * activeParty: Customer / Supplier ID                                            |
|      * activePeriod: Today | This Month | Last Month | This Year                      |
|  - Reference & Pronoun Resolver:                                                      |
|      * Urdu: "aur dirham?", "uska profit?", "aur Lahore mein?", "pichle mahine?"     |
|      * English: "and dirhams?", "its profit?", "and in Lahore?", "last month?"        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         PROVIDER ADAPTER (SECURITY BOUNDARY)                          |
|  `src/ai/voice/providerAdapter.ts`                                                    |
|  - Primary: Deterministic Conversational Agent (Zero external calls, zero API keys)   |
|  - Extensible: Optional Secure Backend Proxy Interface (No frontend secrets)          |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                           AUDITED BUSINESS TOOLS LAYER                                |
|  `src/ai/voice/businessTools.ts`                                                      |
|  Deterministic, read-only tools calling core verified models:                         |
|  - getDashboardSummary()          - getCurrencyBalances()                             |
|  - getCurrencyTrades()            - getCurrencyProfit()                               |
|  - getStockByWarehouse()          - getProductStock()                                 |
|  - getImportSummary()             - getExportSummary()                                |
|  - getReceivables()               - getPayables()                                     |
|  - getCashAndBankBalances()       - getPartyLedger()                                  |
|  - getProfitAndLoss()             - getTrialBalance()                                 |
+---------------------------------------------------------------------------------------+
```

---

## 4. Multi-Turn Conversation & Follow-Up Resolution Logic

### 4.1 Context Slots Schema
```typescript
export interface ConversationContextSlots {
  activeModule?: 'forex' | 'inventory' | 'trade' | 'accounting' | 'general';
  activeCurrency?: 'USD' | 'AED' | 'IRR';
  activeWarehouseId?: string;
  activeWarehouseName?: string;
  activeProductId?: string;
  activeProductName?: string;
  activePartyId?: string;
  activePartyName?: string;
  activePeriod?: {
    key: 'today' | 'month' | 'lastMonth' | 'year';
    label: string;
    start: string;
    end: string;
  };
  lastIntent?: string;
  lastTopic?: string;
}
```

### 4.2 Follow-Up Reference Resolution Matrix
| User Follow-Up Query | Previous Turn Context | Resolved Intent & Parameters |
|---|---|---|
| *"Aur dirham?"* | `activeCurrency: 'USD'`, `activeModule: 'forex'` | `forex.aed_balance` with AED currency |
| *"Pichle month kitni purchase hui thi?"* | `activeCurrency: 'USD'`, `activeModule: 'forex'` | `forex.purchases` with period: `lastMonth` |
| *"Uska profit kitna hua?"* | `activeCurrency: 'USD'`, `activeModule: 'forex'` | `forex.profit` for USD |
| *"Karachi warehouse mein kitna stock hai?"* $\rightarrow$ *"Aur Lahore mein?"* | `activeWarehouse: 'Karachi'`, `activeModule: 'inventory'` | `trade.warehouse_stock` for Lahore |
| *"Is month import kitni hui?"* | `activeModule: 'trade'` | `trade.imports` with period: `thisMonth` |
| *"Mujhe outstanding payments batao."* | `activeModule: 'accounting'` | `finance.payables` or `finance.receivables` |

---

## 5. Security & Safety Compliance

1. **Zero External Secrets:** No API keys in `VITE_*` or client-side files.
2. **Deterministic Financial Accuracy:** All numbers generated through mathematical functions; zero hallucination.
3. **Read-Only Voice First:** Voice commands do not execute destructive operations. Any financial preparation (e.g. payment draft) requires the existing 2-step human approval workflow.
4. **Demo Data Boundary:** Maintains `absa.demo.state.v1` in `localStorage` without cloud DB writes.

---

## 6. Implementation Action Plan

1. **Phase 1: Voice Architecture Foundation**
   - Create `src/ai/voice/voiceTypes.ts`.
   - Create `src/ai/voice/languageDetection.ts` (supports Urdu, English, Roman Urdu with preference options).
   - Create `src/ai/voice/businessTools.ts` (encapsulating all 16 business query tools).
2. **Phase 2: Conversation Manager & Multi-Turn Intelligence**
   - Create `src/ai/voice/conversationManager.ts` (manages history, context slot retention, and reference resolution).
   - Create `src/ai/voice/providerAdapter.ts` (deterministic conversational agent with pluggable proxy contract).
   - Create `src/ai/voice/voiceAssistantService.ts` (unified orchestrator).
3. **Phase 3: UI Upgrades & Settings Panel**
   - Create `src/components/VoiceSettingsModal.tsx` (language setting Auto/Urdu/English, voice rate, auto-speak).
   - Update `src/pages/AiCommandCenter.tsx` to use the unified conversational voice assistant.
   - Upgrade `VoiceControls.tsx` with speech state transitions and clear feedback.
4. **Phase 4: Backward Compatibility & Parity**
   - Ensure `runAiCommand` in `src/ai/engine.ts` is preserved and extended to use the context manager.
   - Ensure all existing text commands and baseline tests pass with zero regression.
5. **Phase 5: Automated Testing & Reports**
   - Create `scripts/verify-advanced-voice.ts` and run browser QA.
   - Generate all 4 required reports.
