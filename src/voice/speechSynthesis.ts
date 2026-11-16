/**
 * WEB SPEECH SYNTHESIS (VOICE OUTPUT)
 * Browser-native Text-To-Speech with Urdu voice detection, fallback handling,
 * play/pause/resume/stop controls, and clean speech text sanitization.
 */

import type { VoiceSynthesisState, VoiceSynthesisVoiceInfo } from './types';

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Sanitizes markdown, symbols, and currency notation for human-sounding speech.
 */
export function cleanTextForSpeech(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Remove bold markdown (**text** -> text)
  text = text.replace(/\*\*(.*?)\*\*/g, '$1');

  // Remove italics (*text* or _text_)
  text = text.replace(/[*_](.*?)[*_]/g, '$1');

  // Remove markdown links [Label](url) -> Label
  text = text.replace(/\[(.*?)\]\([^)]+\)/g, '$1');

  // Convert PKR / Rs. to "rupees"
  text = text.replace(/\b(?:PKR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/gi, '$1 rupees');

  // Remove markdown headers (#, ##, etc.)
  text = text.replace(/^#+\s+/gm, '');

  // Convert bullets • or - to pauses
  text = text.replace(/^[•\-\*]\s+/gm, ', ');

  // Clean arrow signs
  text = text.replace(/→/g, ' to ');

  // Clean multiple newlines and spaces
  text = text.replace(/\n+/g, '. ').replace(/\s+/g, ' ').trim();

  return text;
}

export class VoiceSynthesisController {
  private state: VoiceSynthesisState = 'idle';
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private activeMessageId: string | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private onStateChangeListeners: Set<(state: VoiceSynthesisState, msgId: string | null) => void> = new Set();

  constructor() {
    if (isSpeechSynthesisSupported()) {
      this.loadVoices();
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.loadVoices();
        };
      }
    }
  }

  private loadVoices(): SpeechSynthesisVoice[] {
    if (!isSpeechSynthesisSupported()) return [];
    this.cachedVoices = window.speechSynthesis.getVoices();
    return this.cachedVoices;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.cachedVoices.length === 0) {
      this.loadVoices();
    }
    return this.cachedVoices;
  }

  /**
   * Detects whether an Urdu voice is installed, or selects the best fallback.
   */
  public getBestVoice(preferredLanguage: 'ur' | 'en' = 'ur'): VoiceSynthesisVoiceInfo {
    const voices = this.getVoices();

    if (voices.length === 0) {
      return {
        name: 'System Default',
        lang: 'en-US',
        isUrdu: false,
        isFallback: true,
      };
    }

    if (preferredLanguage === 'ur') {
      // 1. Look for explicit Urdu voice (ur-PK, ur-IN, or 'urdu' in name)
      const urduVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith('ur') ||
          v.name.toLowerCase().includes('urdu')
      );

      if (urduVoice) {
        return {
          name: urduVoice.name,
          lang: urduVoice.lang,
          isUrdu: true,
          isFallback: false,
          rawVoice: urduVoice,
        };
      }
    }

    // Fallback: Urdu voice unavailable, pick English (Pakistan / India) or English / default
    const pakVoice = voices.find((v) => v.lang.toLowerCase().includes('pk'));
    const indVoice = voices.find((v) => v.lang.toLowerCase().includes('in'));
    const engVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en')) || voices[0];

    const fallback = pakVoice || indVoice || engVoice;
    return {
      name: fallback.name,
      lang: fallback.lang,
      isUrdu: false,
      isFallback: true,
      rawVoice: fallback,
    };
  }

  public subscribe(listener: (state: VoiceSynthesisState, msgId: string | null) => void): () => void {
    this.onStateChangeListeners.add(listener);
    return () => this.onStateChangeListeners.delete(listener);
  }

  private setState(newState: VoiceSynthesisState, msgId: string | null = this.activeMessageId) {
    this.state = newState;
    this.activeMessageId = msgId;
    this.onStateChangeListeners.forEach((cb) => cb(newState, msgId));
  }

  public getState(): VoiceSynthesisState {
    return this.state;
  }

  public getActiveMessageId(): string | null {
    return this.activeMessageId;
  }

  public speak(
    messageId: string,
    rawText: string,
    options?: {
      preferredLanguage?: 'ur' | 'en';
      rate?: number;
      pitch?: number;
      voice?: SpeechSynthesisVoice;
    }
  ): boolean {
    if (!isSpeechSynthesisSupported()) {
      return false;
    }

    // Stop previous utterance if running
    this.stop();

    const clean = cleanTextForSpeech(rawText);
    if (!clean) return false;

    try {
      const utterance = new SpeechSynthesisUtterance(clean);
      const voiceInfo = this.getBestVoice(options?.preferredLanguage || 'ur');
      const selectedVoice = options?.voice || voiceInfo.rawVoice;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = voiceInfo.lang;
      }

      utterance.rate = options?.rate ?? 1.0;
      utterance.pitch = options?.pitch ?? 1.0;

      utterance.onstart = () => {
        this.setState('speaking', messageId);
      };

      utterance.onpause = () => {
        this.setState('paused', messageId);
      };

      utterance.onresume = () => {
        this.setState('speaking', messageId);
      };

      utterance.onend = () => {
        this.setState('idle', null);
        this.currentUtterance = null;
      };

      utterance.onerror = (e) => {
        // Speech errors (e.g. cancelled/interrupted)
        this.setState('idle', null);
        this.currentUtterance = null;
      };

      this.currentUtterance = utterance;
      this.setState('speaking', messageId);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.warn('Speech synthesis speak error:', err);
      this.setState('idle', null);
      return false;
    }
  }

  public pause() {
    if (!isSpeechSynthesisSupported()) return;
    try {
      window.speechSynthesis.pause();
      this.setState('paused');
    } catch {
      // ignore
    }
  }

  public resume() {
    if (!isSpeechSynthesisSupported()) return;
    try {
      window.speechSynthesis.resume();
      this.setState('speaking');
    } catch {
      // ignore
    }
  }

  public stop() {
    if (!isSpeechSynthesisSupported()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    this.currentUtterance = null;
    this.setState('idle', null);
  }
}

// Global singleton instance for easy cross-component access
export const voiceSynthesizer = new VoiceSynthesisController();

