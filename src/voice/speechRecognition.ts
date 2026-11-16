/**
 * WEB SPEECH RECOGNITION (VOICE INPUT)
 * Supports browser-native SpeechRecognition / webkitSpeechRecognition
 * with full state management (start, stop, cancel, permissions, errors, simulated fallback).
 *
 * Resilience Features:
 * - Robust error classification for network, permissions, hardware, timeouts, and policy.
 * - Automatic resource cleanup (MediaStream tracks and AudioContext).
 * - Recognition timeout guard to prevent indefinite listening state.
 * - Concurrency mutex to prevent overlapping sessions.
 * - Non-destructive buffering preserving partial recognition for text fallback.
 */

import type {
  VoiceRecognitionState,
  VoiceRecognitionError,
  VoiceRecognitionErrorType,
  SpeechLanguage,
} from './types';

// Declare types for Web Speech API if not in default TS dom lib
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultList {
  [index: number]: {
    isFinal: boolean;
    [index: number]: SpeechRecognitionResultItem;
  };
  length: number;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundend: (() => void) | null;
  onaudioend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export interface VoiceRecognitionCallbacks {
  onStateChange: (state: VoiceRecognitionState) => void;
  onInterimText: (text: string) => void;
  onFinalText: (text: string) => void;
  onError: (error: VoiceRecognitionError) => void;
  onVolumeChange?: (volume: number) => void; // 0.0 to 1.0 for waveform animation
}

/**
 * Pure helper for deterministic mapping of all speech recognition error types.
 */
export function mapSpeechRecognitionError(
  errType: string,
  currentLang: SpeechLanguage = 'ur-PK',
  rawMessage?: string
): VoiceRecognitionError {
  switch (errType) {
    case 'network':
      return {
        type: 'network',
        message: 'Voice recognition service is unavailable. Please check your connection or use text input.',
        remedy: 'Type your question in the chat input or click Retry Voice.',
        isRetryable: true,
      };
    case 'not-allowed':
    case 'permission-denied':
      return {
        type: 'permission-denied',
        message: 'Microphone permission was denied by browser or system settings.',
        remedy: 'Allow microphone access in your browser settings to speak commands.',
        isRetryable: true,
      };
    case 'service-not-allowed':
      return {
        type: 'service-not-allowed',
        message: 'Speech recognition service is blocked by your browser or OS policy.',
        remedy: 'Your organization or browser settings restrict cloud speech recognition. Please use text input.',
        isRetryable: false,
      };
    case 'audio-capture':
      return {
        type: 'audio-capture',
        message: 'No microphone was detected on this device or audio capture failed.',
        remedy: 'Connect a working microphone or type your question in the chat.',
        isRetryable: true,
      };
    case 'no-speech':
      return {
        type: 'no-speech',
        message: 'No speech was detected. Please try speaking closer to your microphone.',
        remedy: 'Make sure your microphone is not muted, or click Retry Voice.',
        isRetryable: true,
      };
    case 'aborted':
      return {
        type: 'aborted',
        message: 'Voice listening was stopped or interrupted.',
        remedy: 'Click Retry Voice to speak again.',
        isRetryable: true,
      };
    case 'language-not-supported':
      return {
        type: 'language-not-supported',
        message: `Speech recognition model for language "${currentLang}" is not supported.`,
        remedy: 'Switch speech language to English (en-US) or use text input.',
        isRetryable: true,
      };
    case 'timeout':
      return {
        type: 'timeout',
        message: 'Voice recognition timed out with no speech detected.',
        remedy: 'Click Retry Voice to speak again, or type your question below.',
        isRetryable: true,
      };
    case 'not-supported':
      return {
        type: 'not-supported',
        message: 'Web Speech API is not supported in this browser.',
        remedy: 'Use Google Chrome, Microsoft Edge, or type your question in the chat box.',
        isRetryable: false,
      };
    default:
      return {
        type: 'unknown',
        message: rawMessage || `Speech recognition error: ${errType}`,
        remedy: 'Type your question or click Retry Voice.',
        isRetryable: true,
      };
  }
}

export class VoiceRecognitionController {
  private recognition: SpeechRecognitionInstance | null = null;
  private state: VoiceRecognitionState = 'idle';
  private callbacks: VoiceRecognitionCallbacks;
  private currentLanguage: SpeechLanguage = 'ur-PK';
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private finalTranscriptBuffer = '';
  private interimTranscriptBuffer = '';
  private isCancelledByUser = false;
  private isStarting = false;
  private timeoutTimerId: any = null;
  private readonly inactivityTimeoutMs = 15000; // 15s timeout if no speech detected

  constructor(callbacks: VoiceRecognitionCallbacks, initialLang: SpeechLanguage = 'ur-PK') {
    this.callbacks = callbacks;
    this.currentLanguage = initialLang;
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;
    const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!RecognitionClass) {
      this.updateState('unsupported');
      return;
    }

    try {
      this.recognition = new RecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.currentLanguage;

      this.recognition.onstart = () => {
        this.isStarting = false;
        this.updateState('listening');
        this.startInactivityTimer();
      };

      this.recognition.onspeechstart = () => {
        // Speech detected — reset / extend inactivity timer
        this.resetInactivityTimer();
      };

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (this.isCancelledByUser) return;
        this.resetInactivityTimer();

        let interimText = '';
        let finalSegment = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || '';
          if (item.isFinal) {
            finalSegment += transcript + ' ';
          } else {
            interimText += transcript;
          }
        }

        if (finalSegment) {
          this.finalTranscriptBuffer = (this.finalTranscriptBuffer + ' ' + finalSegment).trim();
          this.callbacks.onFinalText(this.finalTranscriptBuffer);
        }

        this.interimTranscriptBuffer = interimText;
        if (interimText) {
          const fullInterim = this.finalTranscriptBuffer
            ? `${this.finalTranscriptBuffer} ${interimText}`
            : interimText;
          this.callbacks.onInterimText(fullInterim);
        }
      };

      this.recognition.onerror = (event) => {
        this.clearInactivityTimer();
        this.stopAudioAnalysis();
        this.isStarting = false;

        // If explicitly cancelled by user, ignore standard aborted error
        if (this.isCancelledByUser && event.error === 'aborted') {
          this.updateState('idle');
          return;
        }

        const mappedError = mapSpeechRecognitionError(
          event.error,
          this.currentLanguage,
          event.message
        );

        // Transition out of listening state immediately
        this.updateState('error');
        this.callbacks.onError(mappedError);
      };

      this.recognition.onend = () => {
        this.clearInactivityTimer();
        this.stopAudioAnalysis();
        this.isStarting = false;

        if (this.state === 'listening' || this.state === 'processing') {
          this.updateState('idle');
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      this.updateState('unsupported');
    }
  }

  /* ---------------- Inactivity Timeout Guard ---------------- */
  private startInactivityTimer() {
    this.clearInactivityTimer();
    this.timeoutTimerId = setTimeout(() => {
      if (this.state === 'listening') {
        this.handleTimeout();
      }
    }, this.inactivityTimeoutMs);
  }

  private resetInactivityTimer() {
    if (this.state === 'listening') {
      this.startInactivityTimer();
    }
  }

  private clearInactivityTimer() {
    if (this.timeoutTimerId) {
      clearTimeout(this.timeoutTimerId);
      this.timeoutTimerId = null;
    }
  }

  private handleTimeout() {
    this.stopAudioAnalysis();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    const timeoutErr = mapSpeechRecognitionError('timeout', this.currentLanguage);
    this.updateState('error');
    this.callbacks.onError(timeoutErr);
  }

  /* ---------------- State and Configuration ---------------- */
  public setLanguage(lang: SpeechLanguage) {
    this.currentLanguage = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  public getLanguage(): SpeechLanguage {
    return this.currentLanguage;
  }

  public getState(): VoiceRecognitionState {
    return this.state;
  }

  public getFinalTranscript(): string {
    return this.finalTranscriptBuffer;
  }

  public getInterimTranscript(): string {
    return this.interimTranscriptBuffer;
  }

  private updateState(newState: VoiceRecognitionState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  /* ---------------- Session Controls ---------------- */
  public async start(lang?: SpeechLanguage): Promise<boolean> {
    if (this.isStarting) {
      return false; // Prevent concurrent re-entry
    }

    if (lang) {
      this.setLanguage(lang);
    }

    // Clean up any lingering session
    if (this.state === 'listening' || this.state === 'requesting') {
      this.cancel();
    }

    this.isCancelledByUser = false;
    this.finalTranscriptBuffer = '';
    this.interimTranscriptBuffer = '';
    this.isStarting = true;

    if (!this.recognition) {
      this.isStarting = false;
      const unsuppErr = mapSpeechRecognitionError('not-supported', this.currentLanguage);
      this.callbacks.onError(unsuppErr);
      this.updateState('unsupported');
      return false;
    }

    this.updateState('requesting');

    // Request audio stream for waveform visualization & early permission check
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.startAudioAnalysis(this.mediaStream);
      }
    } catch (micErr: unknown) {
      this.isStarting = false;
      const errName = (micErr as { name?: string })?.name;

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        const error = mapSpeechRecognitionError('not-allowed', this.currentLanguage);
        this.callbacks.onError(error);
        this.updateState('error');
        return false;
      }

      if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        const error = mapSpeechRecognitionError('audio-capture', this.currentLanguage);
        this.callbacks.onError(error);
        this.updateState('error');
        return false;
      }
      // For any other mic capture errors, proceed to recognition.start() to let engine handle or report
    }

    try {
      this.recognition.lang = this.currentLanguage;
      this.recognition.start();
      return true;
    } catch (startErr: unknown) {
      this.isStarting = false;
      console.warn('SpeechRecognition start error:', startErr);
      // If already started, attempt abort and clean restart
      try {
        this.recognition.abort();
        this.recognition.start();
        return true;
      } catch (retryErr) {
        const unknownErr = mapSpeechRecognitionError('unknown', this.currentLanguage, 'Could not start voice recognition.');
        this.callbacks.onError(unknownErr);
        this.updateState('error');
        this.stopAudioAnalysis();
        return false;
      }
    }
  }

  public stop(): string {
    this.clearInactivityTimer();
    this.updateState('processing');
    this.stopAudioAnalysis();
    this.isStarting = false;

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      if (this.state === 'processing') {
        this.updateState('idle');
      }
    }, 200);

    return this.finalTranscriptBuffer.trim();
  }

  public cancel() {
    this.isCancelledByUser = true;
    this.clearInactivityTimer();
    this.stopAudioAnalysis();
    this.isStarting = false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }
    this.callbacks.onInterimText('');
    this.updateState('idle');
  }

  public async retry(lang?: SpeechLanguage): Promise<boolean> {
    this.cancel();
    return this.start(lang || this.currentLanguage);
  }

  /* ---------------- Audio Analysis for Waveform ---------------- */
  private startAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.analyser || this.state !== 'listening') return;
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, Math.max(0.05, avg / 128));
        if (this.callbacks.onVolumeChange) {
          this.callbacks.onVolumeChange(normalized);
        }
        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch {
      // AudioContext may be restricted by autoplay policy
    }
  }

  private stopAudioAnalysis() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => {
          t.stop();
        });
      } catch {}
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
