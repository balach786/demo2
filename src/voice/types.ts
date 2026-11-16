/**
 * VOICE SYSTEM TYPE DEFINITIONS
 * AI Business Secretary & Accountant
 */

export type VoiceRecognitionState =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'processing'
  | 'error'
  | 'unsupported';

export type VoiceRecognitionErrorType =
  | 'permission-denied'
  | 'no-speech'
  | 'network'
  | 'audio-capture'
  | 'not-supported'
  | 'aborted'
  | 'unknown';

export type SpeechLanguage = 'ur-PK' | 'en-US' | 'en-PK';

export interface VoiceRecognitionError {
  type: VoiceRecognitionErrorType;
  message: string;
  remedy?: string;
}

export type VoiceSynthesisState = 'idle' | 'speaking' | 'paused' | 'stopped';

export interface VoiceSynthesisVoiceInfo {
  name: string;
  lang: string;
  isUrdu: boolean;
  isFallback: boolean;
  rawVoice?: SpeechSynthesisVoice;
}

export interface VoiceSettings {
  autoPlayVoice: boolean;
  speechLanguage: SpeechLanguage;
  speechRate: number; // 0.8 - 1.2
  voiceURI?: string;
}

