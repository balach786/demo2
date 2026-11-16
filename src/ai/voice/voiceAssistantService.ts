/**
 * UNIFIED VOICE ASSISTANT SERVICE
 * AI Business Secretary & Accountant Management System
 *
 * Orchestrates:
 * 1. Speech Recognition (Web Speech API + Audio Analyser)
 * 2. Language Detection & Preference Resolution
 * 3. Multi-Turn Conversation & Slot Context Tracking
 * 4. Deterministic Business Tool Execution
 * 5. Text-To-Speech Output with Play/Pause/Replay Controls
 */

import type { DemoDataset } from '../../demo/types';
import type { AiResult } from '../engine';
import { VoiceRecognitionController, isSpeechRecognitionSupported } from '../../voice/speechRecognition';
import { voiceSynthesizer, isSpeechSynthesisSupported } from '../../voice/speechSynthesis';
import type { SpeechLanguage, VoiceRecognitionError } from '../../voice/types';
import { ConversationManager } from './conversationManager';
import { DeterministicLocalProviderAdapter, type AiProviderAdapter } from './providerAdapter';
import { detectTextLanguage, getRecognitionLanguageTag } from './languageDetection';
import type {
  ConversationTurn,
  DetectedLanguage,
  LanguagePreference,
  VoiceAssistantError,
  VoiceAssistantSettings,
  VoiceAssistantStatus,
} from './voiceTypes';

const SETTINGS_STORAGE_KEY = 'absa_voice_assistant_settings_v2';

export class VoiceAssistantService {
  private status: VoiceAssistantStatus = 'idle';
  private conversationManager: ConversationManager;
  private providerAdapter: AiProviderAdapter;
  private recognitionController: VoiceRecognitionController | null = null;
  private interimText = '';
  private audioVolume = 0;
  private error: VoiceAssistantError | null = null;
  private settings: VoiceAssistantSettings;

  private statusListeners: Set<(status: VoiceAssistantStatus) => void> = new Set();
  private volumeListeners: Set<(volume: number) => void> = new Set();
  private interimListeners: Set<(text: string) => void> = new Set();
  private errorListeners: Set<(error: VoiceAssistantError | null) => void> = new Set();

  constructor() {
    this.settings = this.loadSettings();
    this.conversationManager = new ConversationManager(this.settings.languagePreference);
    this.providerAdapter = new DeterministicLocalProviderAdapter();
  }

  private loadSettings(): VoiceAssistantSettings {
    const defaultSettings: VoiceAssistantSettings = {
      languagePreference: 'auto',
      speechRecognitionLang: 'ur-PK',
      autoPlayVoice: false,
      speechRate: 1.0,
    };

    if (typeof window === 'undefined') return defaultSettings;

    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch {}

    return defaultSettings;
  }

  public saveSettings(updated: Partial<VoiceAssistantSettings>) {
    this.settings = { ...this.settings, ...updated };
    this.conversationManager.setLanguagePreference(this.settings.languagePreference);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      } catch {}
    }
  }

  public getSettings(): VoiceAssistantSettings {
    return { ...this.settings };
  }

  public getStatus(): VoiceAssistantStatus {
    return this.status;
  }

  public getTurns(): ReadonlyArray<ConversationTurn> {
    return this.conversationManager.getTurns();
  }

  public clearConversation() {
    this.conversationManager.clear();
    this.stopSpeaking();
    this.setStatus('idle');
  }

  public subscribeStatus(listener: (status: VoiceAssistantStatus) => void) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public subscribeVolume(listener: (vol: number) => void) {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  public subscribeInterim(listener: (text: string) => void) {
    this.interimListeners.add(listener);
    return () => this.interimListeners.delete(listener);
  }

  public subscribeError(listener: (err: VoiceAssistantError | null) => void) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setStatus(newStatus: VoiceAssistantStatus) {
    this.status = newStatus;
    this.statusListeners.forEach((l) => l(newStatus));
  }

  private setVolume(vol: number) {
    this.audioVolume = vol;
    this.volumeListeners.forEach((l) => l(vol));
  }

  private setInterim(text: string) {
    this.interimText = text;
    this.interimListeners.forEach((l) => l(text));
  }

  private setError(err: VoiceAssistantError | null) {
    this.error = err;
    this.errorListeners.forEach((l) => l(err));
  }

  /* ------------------------------------------------------------------ */
  /* Voice Recognition (Mic Input)                                      */
  /* ------------------------------------------------------------------ */
  public async startListening(onFinalTranscript?: (text: string) => void): Promise<boolean> {
    this.setError(null);
    this.setInterim('');

    if (!isSpeechRecognitionSupported()) {
      this.setError({
        type: 'not-supported',
        message: 'Web Speech API is not available in this browser.',
        remedy: 'Use Google Chrome or Microsoft Edge for native speech input, or type your question below.',
      });
      this.setStatus('error');
      return false;
    }

    const recLang = getRecognitionLanguageTag(this.settings.languagePreference);

    this.setStatus('requesting_mic');

    this.recognitionController = new VoiceRecognitionController(
      {
        onStateChange: (recState) => {
          if (recState === 'listening') this.setStatus('listening');
          else if (recState === 'processing') this.setStatus('transcribing');
          else if (recState === 'idle') this.setStatus('idle');
        },
        onInterimText: (txt) => this.setInterim(txt),
        onFinalText: (txt) => {
          this.setInterim('');
          if (onFinalTranscript) onFinalTranscript(txt);
          this.setStatus('completed');
        },
        onError: (err: VoiceRecognitionError) => {
          this.setError({
            type: err.type,
            message: err.message,
            remedy: err.remedy,
          });
          this.setStatus('error');
        },
        onVolumeChange: (vol) => this.setVolume(vol),
      },
      recLang
    );

    const started = await this.recognitionController.start(recLang);
    if (!started) {
      this.setStatus('error');
      return false;
    }

    return true;
  }

  public stopListening(): string {
    const text = this.recognitionController?.stop() || '';
    this.setInterim('');
    this.setStatus('idle');
    return text;
  }

  public cancelListening() {
    this.recognitionController?.cancel();
    this.setInterim('');
    this.setError(null);
    this.setStatus('idle');
  }

  /* ------------------------------------------------------------------ */
  /* Message Processing (Voice & Text share exact same logic)           */
  /* ------------------------------------------------------------------ */
  public async processQuery(
    rawText: string,
    dataset: DemoDataset,
    onDraftCreated?: (draftPayload: any) => string | undefined
  ): Promise<{ result: AiResult; turn: ConversationTurn }> {
    const text = rawText.trim();
    if (!text) {
      throw new Error('Query text cannot be empty');
    }

    this.setStatus('understanding');

    // 1. Context & Pronoun Resolution
    const contextual = this.conversationManager.resolveContextualIntent(text, dataset);

    this.setStatus('retrieving_data');

    // 2. Language Detection
    const detectedLang = detectTextLanguage(text);

    // 3. Process via Provider (Deterministic Local or Backend Proxy)
    const result = await this.providerAdapter.processMessage(
      contextual.resolvedQuery,
      dataset,
      this.conversationManager.getSlots(),
      detectedLang
    );

    this.setStatus('generating_response');

    let approvalId: string | undefined;
    if (result.draft && onDraftCreated) {
      approvalId = onDraftCreated(result.draft);
    }

    // 4. Update Conversation Memory with context slots
    const extractedSlots = {
      activeCurrency: contextual.explicitOrInferredCurrency,
      activeWarehouseName: contextual.explicitOrInferredWarehouse,
      activePartyId: contextual.explicitOrInferredParty?.id,
      activePartyName: contextual.explicitOrInferredParty?.name,
      activePeriod: result.periodLabel
        ? {
            key: contextual.explicitOrInferredPeriodKey || 'month',
            label: result.periodLabel,
            start: '',
            end: '',
          }
        : undefined,
      lastActionDraft: result.draft,
    };

    const turn = this.conversationManager.recordTurn(
      text,
      result.text,
      result.intent,
      result.module,
      result.intentLabel,
      extractedSlots,
      {
        metrics: result.metrics,
        table: result.table,
        links: result.links,
        draft: result.draft,
        approvalId,
        isSpoken: false,
      }
    );

    this.setStatus('completed');

    // 5. Automatic Voice Response if enabled
    if (this.settings.autoPlayVoice && isSpeechSynthesisSupported()) {
      this.speakText(turn.id, result.text, result.language);
    }

    return { result, turn };
  }

  /* ------------------------------------------------------------------ */
  /* Speech Synthesis (TTS Output)                                      */
  /* ------------------------------------------------------------------ */
  public speakText(messageId: string, text: string, language: 'en' | 'roman-urdu' | 'urdu' = 'roman-urdu') {
    if (!isSpeechSynthesisSupported()) return;

    this.setStatus('speaking');

    const preferredLang = language === 'en' ? 'en' : 'ur';

    voiceSynthesizer.speak(messageId, text, {
      preferredLanguage: preferredLang,
      rate: this.settings.speechRate,
    });
  }

  public stopSpeaking() {
    if (isSpeechSynthesisSupported()) {
      voiceSynthesizer.stop();
    }
    if (this.status === 'speaking') {
      this.setStatus('completed');
    }
  }

  public isSpeaking(): boolean {
    return voiceSynthesizer.getState() === 'speaking';
  }
}

// Global Singleton Instance
export const voiceAssistantService = new VoiceAssistantService();
