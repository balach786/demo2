/**
 * CONVERSATION & CONTEXT MANAGER
 * AI Business Secretary & Accountant Management System
 *
 * Maintains multi-turn conversation memory, slot filling,
 * reference/pronoun resolution (e.g., "aur dirham?", "uska profit?", "aur Lahore mein?"),
 * and contextual carryover without corrupting baseline single-turn rules.
 */

import type { DemoDataset, FxCurrency, Party } from '../../demo/types';
import type {
  ConversationContextSlots,
  ConversationTurn,
  DetectedLanguage,
  LanguagePreference,
} from './voiceTypes';
import { detectTextLanguage, resolveEffectiveLanguage } from './languageDetection';
import { resolveParty, parseAmount } from '../engine';

export class ConversationManager {
  private turns: ConversationTurn[] = [];
  private slots: ConversationContextSlots = {};
  private languagePreference: LanguagePreference = 'auto';

  constructor(preference: LanguagePreference = 'auto') {
    this.languagePreference = preference;
  }

  public setLanguagePreference(pref: LanguagePreference) {
    this.languagePreference = pref;
  }

  public getLanguagePreference(): LanguagePreference {
    return this.languagePreference;
  }

  public getSlots(): Readonly<ConversationContextSlots> {
    return { ...this.slots };
  }

  public getTurns(): ReadonlyArray<ConversationTurn> {
    return [...this.turns];
  }

  public clear() {
    this.turns = [];
    this.slots = {};
  }

  /**
   * Resolves a user's natural input against the accumulated multi-turn context.
   * Handles elliptical follow-ups, pronoun references, and slot inheritance.
   */
  public resolveContextualIntent(
    rawText: string,
    ds: DemoDataset
  ): {
    resolvedQuery: string;
    explicitOrInferredCurrency?: FxCurrency;
    explicitOrInferredWarehouse?: string;
    explicitOrInferredParty?: Party;
    explicitOrInferredPeriodKey?: 'today' | 'month' | 'lastMonth' | 'year' | 'week';
    isFollowUp: boolean;
    referentSlot?: string;
  } {
    const text = rawText.trim();
    const t = text.toLowerCase();

    let isFollowUp = false;
    let referentSlot: string | undefined;
    let inferredCurrency: FxCurrency | undefined = this.slots.activeCurrency;
    let inferredWarehouse: string | undefined = this.slots.activeWarehouseName || this.slots.activeWarehouseId;
    let inferredParty: Party | undefined = this.slots.activePartyId
      ? ds.parties.find((p) => p.id === this.slots.activePartyId)
      : undefined;
    let inferredPeriodKey = this.slots.activePeriod?.key;

    // 1. Detect explicit currency mentions
    if (/\b(dollar|dollars|usd|ڈالر|ڈالرز)\b/i.test(t)) {
      inferredCurrency = 'USD';
    } else if (/\b(dirham|dirhams|aed|درہم)\b/i.test(t)) {
      inferredCurrency = 'AED';
    } else if (/\b(rial|riyal|irr|toman|تومان|ریال)\b/i.test(t)) {
      inferredCurrency = 'IRR';
    }

    // 2. Detect explicit warehouse mentions
    if (/\b(karachi port|port warehouse|wh-khi-port)\b/i.test(t) || /(پورٹ|پورٹ گودام)/.test(t)) {
      inferredWarehouse = 'Karachi Port Terminal';
    } else if (/\b(karachi|karachi main|main warehouse|wh-khi-main)\b/i.test(t) || /(کراچی|مین گودام)/.test(t)) {
      inferredWarehouse = 'Main Warehouse';
    } else if (/\b(dubai|dubai warehouse|jafza|wh-dxb)\b/i.test(t) || /(دبئی|دبئی گودام)/.test(t)) {
      inferredWarehouse = 'Dubai Warehouse';
    } else if (/\b(lahore|lahore distribution|wh-lhr)\b/i.test(t) || /(لاہور|لاہور گودام)/.test(t)) {
      inferredWarehouse = 'Lahore Distribution Center';
    }

    // 3. Detect explicit period
    if (/\b(pichle mahine|pichley mahine|last month|previous month)\b/i.test(t) || /(پچھلے مہینے|گزشتہ ماہ)/.test(t)) {
      inferredPeriodKey = 'lastMonth';
    } else if (/\b(aaj|today)\b/i.test(t) || /(آج)/.test(t)) {
      inferredPeriodKey = 'today';
    } else if (/\b(this month|is mahine|is mahina|curr?ent month)\b/i.test(t) || /(اس مہینے|اس ماہ)/.test(t)) {
      inferredPeriodKey = 'month';
    } else if (/\b(this year|is saal|fy)\b/i.test(t) || /(اس سال)/.test(t)) {
      inferredPeriodKey = 'year';
    }

    // 4. Resolve "Aur [Currency]?" or "And [Currency]?" (Elliptical follow-up)
    // Examples: "Aur dirham?", "And what about dirham?", "aur rial ka batao"
    if (
      /^(aur|and|what about|how about)\s+(dirham|dirhams|aed|dollar|dollars|usd|rial|riyal|irr)/i.test(t) ||
      /^(اور|اور پھر)\s+(درہم|ڈالر|ریال)/i.test(t) ||
      /^(aur|and)\s+(uska|iska)\s+(dirham|dollar|rial)/i.test(t)
    ) {
      isFollowUp = true;
      referentSlot = 'currency';
      if (/\b(dirham|aed|درہم)\b/i.test(t)) inferredCurrency = 'AED';
      else if (/\b(dollar|usd|ڈالر)\b/i.test(t)) inferredCurrency = 'USD';
      else if (/\b(rial|irr|ریال)\b/i.test(t)) inferredCurrency = 'IRR';

      const resolved = `Mere paas kitna ${inferredCurrency} available hai?`;
      return {
        resolvedQuery: resolved,
        explicitOrInferredCurrency: inferredCurrency,
        explicitOrInferredWarehouse: inferredWarehouse,
        isFollowUp: true,
        referentSlot: 'currency',
      };
    }

    // 5. Resolve "Aur Lahore mein?" or "And in Lahore?" or "Lahore ka batao"
    // Follow-up warehouse inquiry
    if (
      /^(aur|and|what about)\s+(in\s+)?(lahore|karachi|dubai|port)/i.test(t) ||
      /^(اور|اور پھر)\s+(لاہور|کراچی|دبئی|پورٹ)/i.test(t) ||
      /^(lahore|karachi|dubai)\s+(mein|me|ka|ki)\s*(kitna|kya)?/i.test(t)
    ) {
      isFollowUp = true;
      referentSlot = 'warehouse';
      if (/\blahore\b/i.test(t) || /لاہور/.test(t)) inferredWarehouse = 'Lahore Distribution Center';
      else if (/\b(port)\b/i.test(t) || /پورٹ/.test(t)) inferredWarehouse = 'Karachi Port Terminal';
      else if (/\bdubai\b/i.test(t) || /دبئی/.test(t)) inferredWarehouse = 'Dubai Warehouse';
      else if (/\bkarachi\b/i.test(t) || /کراچی/.test(t)) inferredWarehouse = 'Main Warehouse';

      const resolved = `${inferredWarehouse} mein kitna stock hai?`;
      return {
        resolvedQuery: resolved,
        explicitOrInferredWarehouse: inferredWarehouse,
        isFollowUp: true,
        referentSlot: 'warehouse',
      };
    }

    // 6. Resolve "Pichle month kitni purchase hui thi?" with context
    // If previous context was currency, this refers to currency purchases!
    if (
      (/\b(purchase|purchases|kharidari|khareed)\b/i.test(t) || /(خریداری|خرید)/.test(t)) &&
      (this.slots.activeModule === 'forex' || this.slots.activeCurrency) &&
      !/\b(domestic|cogs|raw material|goods)\b/i.test(t)
    ) {
      isFollowUp = true;
      referentSlot = 'forex_purchases';
      const cur = inferredCurrency || 'USD';
      const periodLabel = inferredPeriodKey === 'lastMonth' ? 'pichle mahine' : 'is mahine';
      const resolved = `${periodLabel} kitne ${cur} purchase hue?`;
      return {
        resolvedQuery: resolved,
        explicitOrInferredCurrency: cur,
        explicitOrInferredPeriodKey: inferredPeriodKey,
        isFollowUp: true,
        referentSlot: 'forex_purchases',
      };
    }

    // 7. Resolve Pronouns: "Uska profit kitna hua?" / "What was the profit on those?" / "Iska nafa kitna hai?"
    if (
      /\b(uska|uski|iske|iska|unka|its|that|those)\s+(profit|nafa|munafa|margin|gain)\b/i.test(t) ||
      /(اس کا|اس کی|ان کا)\s+(منافع|نفع)/.test(t) ||
      /\bprofit\s+on\s+(those|that|it)\b/i.test(t)
    ) {
      isFollowUp = true;
      referentSlot = 'profit';

      // If currency was active:
      if (this.slots.activeCurrency || this.slots.activeModule === 'forex') {
        const cur = inferredCurrency || 'USD';
        const resolved = `${cur} currency exchange ka profit kitna hai?`;
        return {
          resolvedQuery: resolved,
          explicitOrInferredCurrency: cur,
          isFollowUp: true,
          referentSlot: 'currency_profit',
        };
      }

      // If a party was active:
      if (this.slots.activePartyId) {
        const party = ds.parties.find((p) => p.id === this.slots.activePartyId);
        if (party) {
          const resolved = `${party.name} ka ledger dikhao.`;
          return {
            resolvedQuery: resolved,
            explicitOrInferredParty: party,
            isFollowUp: true,
            referentSlot: 'party_ledger',
          };
        }
      }

      // Default: general net profit
      return {
        resolvedQuery: 'Is month ka profit calculate karo.',
        isFollowUp: true,
        referentSlot: 'net_profit',
      };
    }

    // 8. Standalone follow-up: "Aur outstanding payments?" / "And what about receivables?"
    if (
      /\b(outstanding|payments?|baqaya|deni)\b/i.test(t) &&
      !/\b(ali|ahmed|abc|xyz|shahid|usman)\b/i.test(t)
    ) {
      // General creditors/payables inquiry
      return {
        resolvedQuery: 'Ali Traders ko kitni payment deni hai?',
        explicitOrInferredParty: inferredParty,
        isFollowUp: false,
      };
    }

    return {
      resolvedQuery: text,
      explicitOrInferredCurrency: inferredCurrency,
      explicitOrInferredWarehouse: inferredWarehouse,
      explicitOrInferredParty: inferredParty,
      explicitOrInferredPeriodKey: inferredPeriodKey,
      isFollowUp,
      referentSlot,
    };
  }

  /**
   * Commits a completed conversation turn and updates active context slots.
   */
  public recordTurn(
    userInput: string,
    assistantResponseText: string,
    intent: string,
    module: string,
    intentLabel: string,
    extractedSlots: Partial<ConversationContextSlots>,
    turnMetadata?: {
      metrics?: any[];
      table?: any;
      links?: any[];
      draft?: any;
      approvalId?: string;
      isSpoken?: boolean;
    }
  ): ConversationTurn {
    const detectedLang = detectTextLanguage(userInput);

    // Update active context slots
    if (extractedSlots.activeModule) this.slots.activeModule = extractedSlots.activeModule;
    if (extractedSlots.activeCurrency) this.slots.activeCurrency = extractedSlots.activeCurrency;
    if (extractedSlots.activeWarehouseId) this.slots.activeWarehouseId = extractedSlots.activeWarehouseId;
    if (extractedSlots.activeWarehouseName) this.slots.activeWarehouseName = extractedSlots.activeWarehouseName;
    if (extractedSlots.activeProductId) this.slots.activeProductId = extractedSlots.activeProductId;
    if (extractedSlots.activeProductName) this.slots.activeProductName = extractedSlots.activeProductName;
    if (extractedSlots.activePartyId) this.slots.activePartyId = extractedSlots.activePartyId;
    if (extractedSlots.activePartyName) this.slots.activePartyName = extractedSlots.activePartyName;
    if (extractedSlots.activePeriod) this.slots.activePeriod = extractedSlots.activePeriod;
    if (extractedSlots.lastActionDraft) this.slots.lastActionDraft = extractedSlots.lastActionDraft;

    this.slots.lastIntent = intent;
    this.slots.lastTopic = intentLabel;

    const turn: ConversationTurn = {
      id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      role: 'assistant',
      text: assistantResponseText,
      language: detectedLang,
      intent,
      intentLabel,
      module,
      contextSlotsAfterTurn: { ...this.slots },
      metrics: turnMetadata?.metrics,
      table: turnMetadata?.table,
      links: turnMetadata?.links,
      draft: turnMetadata?.draft,
      approvalId: turnMetadata?.approvalId,
      isSpoken: turnMetadata?.isSpoken,
    };

    this.turns.push(turn);

    // Keep memory bounded to 50 turns
    if (this.turns.length > 50) {
      this.turns = this.turns.slice(-50);
    }

    return turn;
  }
}

