import React, { useEffect, useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Check,
  X,
  AlertCircle,
  Settings2,
  Sparkles,
  Info,
} from 'lucide-react';
import type { SpeechLanguage, VoiceRecognitionError, VoiceRecognitionState } from '../voice/types';
import { VoiceRecognitionController, isSpeechRecognitionSupported } from '../voice/speechRecognition';
import { voiceSynthesizer, isSpeechSynthesisSupported } from '../voice/speechSynthesis';

/* ------------------------------------------------------------------ */
/* Voice Waveform Component                                            */
/* ------------------------------------------------------------------ */
export function VoiceWaveform({ active = true, volume = 0.5 }: { active?: boolean; volume?: number }) {
  const bars = [0.4, 0.8, 1.0, 0.6, 0.9, 0.5, 0.7];

  return (
    <div className={`voice-waveform ${active ? 'active' : ''}`} aria-label="Audio waveform indicator">
      {bars.map((factor, i) => {
        const height = active ? Math.max(4, Math.min(24, Math.round(volume * factor * 26 + 6))) : 4;
        return (
          <span
            key={i}
            className="voice-wave-bar"
            style={{
              height: `${height}px`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Voice Listening Bar (Appears above input during recording)          */
/* ------------------------------------------------------------------ */
interface VoiceListeningBarProps {
  state: VoiceRecognitionState;
  interimText: string;
  language: SpeechLanguage;
  volume: number;
  onDone: () => void;
  onCancel: () => void;
  onLanguageChange: (lang: SpeechLanguage) => void;
  error?: VoiceRecognitionError | null;
}

export function VoiceListeningBar({
  state,
  interimText,
  language,
  volume,
  onDone,
  onCancel,
  onLanguageChange,
  error,
}: VoiceListeningBarProps) {
  if (state === 'idle' && !error) return null;

  return (
    <div className={`voice-listening-bar ${error ? 'error' : ''}`}>
      <div className="vlb-left">
        {error ? (
          <div className="vlb-error-icon">
            <AlertCircle size={16} color="var(--red)" />
          </div>
        ) : (
          <div className="vlb-wave-box">
            <span className="vlb-rec-dot" />
            <VoiceWaveform active={state === 'listening'} volume={volume} />
          </div>
        )}

        <div className="vlb-content">
          {error ? (
            <div className="vlb-error-text">
              <span className="bold">{error.message}</span>
              {error.remedy ? <span className="vlb-sub">{error.remedy}</span> : null}
            </div>
          ) : (
            <div className="vlb-speech-text">
              <span className="vlb-status">
                {state === 'requesting' ? 'Requesting microphone permission…' : 'Listening… speak your command'}
              </span>
              <div className="vlb-transcript">
                {interimText ? (
                  <span className="vlb-preview-quote">"{interimText}"</span>
                ) : (
                  <span className="muted xsmall">Try: "Aaj ki total sales kitni hain?" or "Ahmed ka ledger dikhao"</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="vlb-actions">
        {!error && (
          <div className="vlb-lang-picker">
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SpeechLanguage)}
              className="vlb-select"
              title="Speech Recognition Language"
            >
              <option value="ur-PK">Urdu (Pakistan)</option>
              <option value="en-US">English / Roman Urdu</option>
              <option value="en-PK">English (Pakistan)</option>
            </select>
          </div>
        )}

        {!error && state === 'listening' && (
          <button className="btn success sm vlb-btn-done" onClick={onDone} title="Stop and insert text">
            <Check size={14} /> Done
          </button>
        )}

        <button className="btn xs vlb-btn-cancel" onClick={onCancel} title="Cancel voice input">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Voice Response Controls for AI message bubble                      */
/* ------------------------------------------------------------------ */
interface VoiceResponseButtonProps {
  messageId: string;
  text: string;
  language?: 'en' | 'roman-urdu';
}

export function VoiceResponseButton({ messageId, text, language = 'roman-urdu' }: VoiceResponseButtonProps) {
  const [synthState, setSynthState] = useState(voiceSynthesizer.getState());
  const [activeId, setActiveId] = useState(voiceSynthesizer.getActiveMessageId());
  const isPlayingThis = activeId === messageId && synthState === 'speaking';
  const isPausedThis = activeId === messageId && synthState === 'paused';

  useEffect(() => {
    return voiceSynthesizer.subscribe((state, msgId) => {
      setSynthState(state);
      setActiveId(msgId);
    });
  }, []);

  const voiceInfo = voiceSynthesizer.getBestVoice(language === 'roman-urdu' ? 'ur' : 'en');
  const supported = isSpeechSynthesisSupported();

  if (!supported) {
    return null;
  }

  const handleToggle = () => {
    if (isPlayingThis) {
      voiceSynthesizer.pause();
    } else if (isPausedThis) {
      voiceSynthesizer.resume();
    } else {
      voiceSynthesizer.speak(messageId, text, {
        preferredLanguage: language === 'roman-urdu' ? 'ur' : 'en',
      });
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    voiceSynthesizer.stop();
  };

  return (
    <div className="voice-response-controls" title={`Voice: ${voiceInfo.name} (${voiceInfo.lang})${voiceInfo.isFallback ? ' · Fallback voice' : ' · Native Urdu voice'}`}>
      <button
        className={`voice-bubble-btn ${isPlayingThis ? 'playing' : isPausedThis ? 'paused' : ''}`}
        onClick={handleToggle}
        aria-label={isPlayingThis ? 'Pause voice response' : 'Read response aloud'}
      >
        {isPlayingThis ? (
          <>
            <Pause size={12} />
            <span>Pause</span>
            <VoiceWaveform active={true} volume={0.6} />
          </>
        ) : isPausedThis ? (
          <>
            <Play size={12} />
            <span>Resume</span>
          </>
        ) : (
          <>
            <Volume2 size={12} />
            <span>Read aloud</span>
          </>
        )}
      </button>

      {(isPlayingThis || isPausedThis) && (
        <button
          className="voice-bubble-btn stop"
          onClick={handleStop}
          title="Stop reading aloud"
          aria-label="Stop reading aloud"
        >
          <Square size={11} />
        </button>
      )}

      {voiceInfo.isFallback && !isPlayingThis && (
        <span className="voice-fallback-hint" title={`OS Urdu speech pack not found. Reading with system voice: ${voiceInfo.name}`}>
          {voiceInfo.name.split(' ')[0]}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Voice Header Settings (Auto-play switch + Lang badge)              */
/* ------------------------------------------------------------------ */
interface VoiceHeaderControlsProps {
  autoPlay: boolean;
  onAutoPlayToggle: (val: boolean) => void;
  language: SpeechLanguage;
  onLanguageChange: (lang: SpeechLanguage) => void;
  onOpenSettings?: () => void;
  isSpeaking?: boolean;
  onStopSpeaking?: () => void;
  activeContextText?: string;
}

export function VoiceHeaderControls({
  autoPlay,
  onAutoPlayToggle,
  language,
  onLanguageChange,
  onOpenSettings,
  isSpeaking = false,
  onStopSpeaking,
  activeContextText,
}: VoiceHeaderControlsProps) {
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthSupported = isSpeechSynthesisSupported();
  const voiceInfo = voiceSynthesizer.getBestVoice('ur');

  return (
    <div className="voice-header-bar">
      <div className="row wrap" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
          {/* Auto Read Toggle */}
          <label className="voice-auto-toggle" title="Automatically read aloud answers to voice commands">
            <input
              type="checkbox"
              checked={autoPlay}
              onChange={(e) => onAutoPlayToggle(e.target.checked)}
            />
            <Volume2 size={13} />
            <span>Auto-read</span>
          </label>

          {/* Speech Language Selector */}
          <div className="voice-lang-chip">
            <span className="xsmall muted">Mic Lang:</span>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as SpeechLanguage)}
              className="voice-lang-select"
              title="Speech recognition recognition model"
            >
              <option value="ur-PK">Urdu (اردو / ur-PK)</option>
              <option value="en-US">English / Roman Urdu</option>
              <option value="en-PK">English (Pakistan)</option>
            </select>
          </div>

          {/* Active Speaking Indicator */}
          {isSpeaking && (
            <button
              className="badge teal sm"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, border: 'none' }}
              onClick={onStopSpeaking}
              title="Click to stop speaking response"
            >
              <Square size={10} />
              <span>Speaking aloud · Stop</span>
              <VoiceWaveform active={true} volume={0.6} />
            </button>
          )}

          {/* Active Multi-Turn Context Chip */}
          {activeContextText && (
            <span className="badge blue sm" title="Active conversation context carried over to follow-up questions">
              <Sparkles size={11} /> Context: {activeContextText}
            </span>
          )}
        </div>

        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {onOpenSettings && (
            <button
              className="btn xs"
              onClick={onOpenSettings}
              title="Open Voice & Language Settings"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Settings2 size={13} /> Settings
            </button>
          )}

          {/* Engine status indicator */}
          <span
            className={`badge ${recognitionSupported ? 'teal' : 'amber'}`}
            title={
              recognitionSupported
                ? `Web Speech API ready · Voice: ${voiceInfo.name}${voiceInfo.isFallback ? ' (system fallback)' : ' (native Urdu)'}`
                : 'Web Speech API not natively available in this browser. Simulated voice input mode enabled.'
            }
          >
            <span className="dot" />
            {recognitionSupported ? 'Voice Ready' : 'Voice Sim Mode'}
          </span>
        </div>
      </div>
    </div>
  );
}

