/**
 * ADVANCED VOICE ASSISTANT TYPE DEFINITIONS
 * AI Business Secretary & Accountant Management System
 */

import type { DemoDataset, DraftTransaction, Party } from '../../demo/types';
import type { AiMetric, AiTable, AiLink, AiDraftPayload } from '../engine';

export type LanguagePreference = 'auto' | 'ur' | 'en';
export type DetectedLanguage = 'en' | 'roman-urdu' | 'urdu';

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
    key: 'today' | 'month' | 'lastMonth' | 'year' | 'week';
    label: string;
    start: string;
    end: string;
  };
  lastIntent?: string;
  lastTopic?: string;
  lastActionDraft?: AiDraftPayload;
  lastQuestionSubject?: string;
}

export interface ConversationTurn {
  id: string;
  timestamp: string;
  role: 'user' | 'assistant';
  text: string;
  language: DetectedLanguage;
  intent?: string;
  intentLabel?: string;
  module?: string;
  contextSlotsAfterTurn: ConversationContextSlots;
  metrics?: AiMetric[];
  table?: AiTable;
  links?: AiLink[];
  draft?: AiDraftPayload;
  approvalId?: string;
  isSpoken?: boolean;
}

export interface VoiceAssistantSettings {
  languagePreference: LanguagePreference; // 'auto' | 'ur' | 'en'
  speechRecognitionLang: 'ur-PK' | 'en-US' | 'en-PK';
  autoPlayVoice: boolean;
  speechRate: number; // 0.8 - 1.2
  voiceURI?: string;
}

export type VoiceAssistantStatus =
  | 'idle'
  | 'requesting_mic'
  | 'listening'
  | 'transcribing'
  | 'understanding'
  | 'retrieving_data'
  | 'generating_response'
  | 'speaking'
  | 'completed'
  | 'error';

export interface VoiceAssistantError {
  type:
    | 'permission-denied'
    | 'no-speech'
    | 'network'
    | 'audio-capture'
    | 'not-supported'
    | 'aborted'
    | 'provider-unconfigured'
    | 'unknown';
  message: string;
  remedy?: string;
}

export interface ToolExecutionContext {
  dataset: DemoDataset;
  slots: ConversationContextSlots;
  language: DetectedLanguage;
  query: string;
}

export interface BusinessToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  module: 'accounting' | 'trade' | 'forex' | 'inventory' | 'general';
  execute: (params: TParams, context: ToolExecutionContext) => Promise<TResult> | TResult;
}
