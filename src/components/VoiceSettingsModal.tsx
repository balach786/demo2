import React from 'react';
import { Settings, Volume2, Globe, Sparkles, Check, Info, ShieldCheck } from 'lucide-react';
import { Modal } from './ui';
import type { LanguagePreference, VoiceAssistantSettings } from '../ai/voice/voiceTypes';
import { voiceSynthesizer, isSpeechSynthesisSupported } from '../voice/speechSynthesis';
import { isSpeechRecognitionSupported } from '../voice/speechRecognition';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceAssistantSettings;
  onUpdateSettings: (updated: Partial<VoiceAssistantSettings>) => void;
  onClearHistory: () => void;
}

export function VoiceSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearHistory,
}: VoiceSettingsModalProps) {
  if (!isOpen) return null;

  const recognitionSupported = isSpeechRecognitionSupported();
  const synthSupported = isSpeechSynthesisSupported();
  const voiceInfo = voiceSynthesizer.getBestVoice(
    settings.languagePreference === 'en' ? 'en' : 'ur'
  );

  return (
    <Modal
      title="Voice Assistant Settings"
      subtitle="Configure multilingual speech recognition, voice synthesis, and conversation preferences."
      onClose={onClose}
    >
      <div className="voice-settings-modal" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 1. Language Preference */}
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Globe size={15} color="var(--primary)" /> Language Preference
          </label>
          <p className="muted xsmall" style={{ marginBottom: 8 }}>
            Select how the assistant detects language and responds to voice commands:
          </p>
          <div className="radio-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { id: 'auto', label: 'Auto-Detect', sub: 'Urdu & English' },
              { id: 'ur', label: 'Urdu (اردو)', sub: 'Urdu speech & voice' },
              { id: 'en', label: 'English', sub: 'English speech & voice' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`btn ${settings.languagePreference === opt.id ? 'primary' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '10px 8px',
                  borderRadius: 8,
                  textAlign: 'center',
                }}
                onClick={() => onUpdateSettings({ languagePreference: opt.id as LanguagePreference })}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{opt.label}</span>
                <span className="xsmall muted" style={{ fontSize: '0.72rem', opacity: 0.85 }}>{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Auto-Play Voice Answers */}
        <div
          className="form-group"
          style={{
            background: 'var(--surface-subtle, rgba(255,255,255,0.03))',
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Volume2 size={16} color="var(--teal)" />
              <div>
                <div>Auto-Read Answers Aloud</div>
                <div className="xsmall muted" style={{ fontWeight: 400 }}>
                  Automatically speak assistant responses when receiving voice commands.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.autoPlayVoice}
              onChange={(e) => onUpdateSettings({ autoPlayVoice: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
            />
          </label>
        </div>

        {/* 3. Speech Rate */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
              Speech Playback Speed
            </label>
            <span className="badge sm blue">{settings.speechRate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.3"
            step="0.1"
            value={settings.speechRate}
            onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)' }}>
            <span>0.8x (Slower)</span>
            <span>1.0x (Normal)</span>
            <span>1.3x (Faster)</span>
          </div>
        </div>

        {/* 4. Engine & Voice Diagnostic */}
        <div
          style={{
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: 8,
            padding: 12,
            fontSize: '0.8rem',
          }}
        >
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <ShieldCheck size={15} color="var(--primary)" /> Speech Engine Status
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span className="muted">Microphone STT:</span>{' '}
              <strong style={{ color: recognitionSupported ? 'var(--teal)' : 'var(--amber)' }}>
                {recognitionSupported ? 'Web Speech API Ready' : 'Simulated Fallback'}
              </strong>
            </div>
            <div>
              <span className="muted">TTS Output:</span>{' '}
              <strong style={{ color: synthSupported ? 'var(--teal)' : 'var(--amber)' }}>
                {synthSupported ? 'SpeechSynthesis Ready' : 'Unsupported'}
              </strong>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span className="muted">Active System Voice:</span>{' '}
              <strong>{voiceInfo.name}</strong> ({voiceInfo.lang}){' '}
              {voiceInfo.isFallback ? (
                <span className="badge amber sm" style={{ marginLeft: 4 }}>OS Fallback Voice</span>
              ) : (
                <span className="badge teal sm" style={{ marginLeft: 4 }}>Native Urdu Voice</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Clear Conversation Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            className="btn danger sm"
            onClick={() => {
              if (window.confirm('Clear all conversation history and reset context memory?')) {
                onClearHistory();
                onClose();
              }
            }}
          >
            Clear Conversation Memory
          </button>
          <button type="button" className="btn primary sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
