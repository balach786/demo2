/**
 * WEB SPEECH RECOGNITION (VOICE INPUT)
 * Supports browser-native SpeechRecognition / webkitSpeechRecognition
 * with full state management (start, stop, cancel, permissions, errors, simulated fallback).
 */

import type {
  VoiceRecognitionState,
  VoiceRecognitionError,
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
  private isCancelled = false;

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
        this.updateState('listening');
      };

      this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
        if (this.isCancelled) return;
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

        if (interimText) {
          const fullInterim = this.finalTranscriptBuffer
            ? `${this.finalTranscriptBuffer} ${interimText}`
            : interimText;
          this.callbacks.onInterimText(fullInterim);
        }
      };

      this.recognition.onerror = (event) => {
        if (this.isCancelled) return;
        const errType = event.error;
        let mappedError: VoiceRecognitionError;

        switch (errType) {
          case 'not-allowed':
          case 'service-not-allowed':
            mappedError = {
              type: 'permission-denied',
              message: 'Microphone permission was denied by browser or system settings.',
              remedy: 'Click the camera/mic icon in the browser address bar and select "Always allow".',
            };
            break;
          case 'no-speech':
            mappedError = {
              type: 'no-speech',
              message: 'No speech was detected. Please try speaking closer to your microphone.',
              remedy: 'Make sure your microphone is not muted.',
            };
            break;
          case 'network':
            mappedError = {
              type: 'network',
              message: 'Speech recognition network error occurred.',
              remedy: 'Check your internet connection (Web Speech API requires cloud connection in Chrome).',
            };
            break;
          case 'audio-capture':
            mappedError = {
              type: 'audio-capture',
              message: 'Could not capture audio from microphone.',
              remedy: 'Check if another application is using your microphone.',
            };
            break;
          case 'aborted':
            mappedError = {
              type: 'aborted',
              message: 'Voice listening was stopped.',
            };
            break;
          default:
            mappedError = {
              type: 'unknown',
              message: event.message || `Speech recognition error: ${errType}`,
            };
        }

        this.callbacks.onError(mappedError);
        this.updateState('error');
        this.stopAudioAnalysis();
      };

      this.recognition.onend = () => {
        this.stopAudioAnalysis();
        if (this.state === 'listening' || this.state === 'processing') {
          this.updateState('idle');
        }
      };
    } catch (e) {
      console.warn('SpeechRecognition initialization error:', e);
      this.updateState('unsupported');
    }
  }

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

  private updateState(newState: VoiceRecognitionState) {
    this.state = newState;
    this.callbacks.onStateChange(newState);
  }

  public async start(lang?: SpeechLanguage): Promise<boolean> {
    if (lang) {
      this.setLanguage(lang);
    }
    this.isCancelled = false;
    this.finalTranscriptBuffer = '';

    if (!this.recognition) {
      this.callbacks.onError({
        type: 'not-supported',
        message: 'Web Speech API is not supported in this browser.',
        remedy: 'Use Google Chrome, Microsoft Edge, or a browser that supports Web Speech Recognition.',
      });
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
      const errName = (micErr as { name?: string })?.name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        const error: VoiceRecognitionError = {
          type: 'permission-denied',
          message: 'Microphone permission denied. Allow microphone access to use voice commands.',
          remedy: 'Click the lock or tune icon in the address bar to permit microphone access.',
        };
        this.callbacks.onError(error);
        this.updateState('error');
        return false;
      }
      // If getUserMedia fails for other reasons, proceed to recognition.start() to let recognition handle it
    }

    try {
      this.recognition.lang = this.currentLanguage;
      this.recognition.start();
      return true;
    } catch (startErr: unknown) {
      console.warn('SpeechRecognition start error:', startErr);
      // If already started, stop then restart
      try {
        this.recognition.abort();
        this.recognition.start();
        return true;
      } catch (retryErr) {
        this.callbacks.onError({
          type: 'unknown',
          message: 'Could not start voice recognition.',
        });
        this.updateState('error');
        return false;
      }
    }
  }

  public stop(): string {
    this.updateState('processing');
    this.stopAudioAnalysis();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      this.updateState('idle');
    }, 200);
    return this.finalTranscriptBuffer.trim();
  }

  public cancel() {
    this.isCancelled = true;
    this.finalTranscriptBuffer = '';
    this.stopAudioAnalysis();
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

  /* ---------------- Audio Analysis for Waveform ---------------- */
  private startAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }
  }
}

