/**
 * LANGUAGE DETECTION & RESOLUTION ENGINE
 * Supports:
 * 1. Urdu (Arabic script \u0600-\u06FF)
 * 2. Roman Urdu (natural Latin script Urdu transliteration)
 * 3. English (Standard business English)
 * 4. Mixed Urdu-English business phrasing
 */

import type { DetectedLanguage, LanguagePreference } from './voiceTypes';

const URDU_SCRIPT_REGEX = /[\u0600-\u06FF]/;

const ROMAN_URDU_VOCABULARY = new Set([
  'aaj', 'kal', 'parson', 'kitna', 'kitni', 'kitne', 'dikhao', 'dikha', 'batao', 'bata',
  'bataiye', 'karo', 'karein', 'kar', 'karna', 'hai', 'hain', 'tha', 'thi', 'the',
  'ka', 'ki', 'ke', 'ko', 'se', 'mein', 'me', 'pe', 'par', 'tak',
  'mera', 'meri', 'mere', 'apka', 'apki', 'apke', 'humara', 'humari', 'humare',
  'iska', 'iski', 'iske', 'uska', 'uski', 'uske', 'inka', 'unka', 'unke',
  'aur', 'bhi', 'phir', 'ab', 'kya', 'kyun', 'kese', 'kaise', 'kab', 'kahan', 'kis', 'kaun',
  'munafa', 'nafa', 'nuqsan', 'faida', 'kharcha', 'kharchay', 'mahina', 'mahine', 'saal',
  'hafte', 'hafta', 'rooz', 'kul', 'jama', 'baqaya', 'wusooli', 'wasooli', 'deni', 'dena',
  'leni', 'lena', 'chahiye', 'mujhe', 'humein', 'ledger', 'khata', 'hisab', 'hisaab',
  'pichle', 'pichley', 'is', 'iss', 'ye', 'yeh', 'wo', 'woh', 'wahan', 'yahan',
  'dolar', 'dollar', 'dollaron', 'dirham', 'rial', 'riyal', 'godown', 'mal', 'maal',
  'bhejo', 'mangwao', 'rasid', 'tasdeeq', 'adayeegi', 'adayege', 'rakho',
]);

/**
 * Detects whether the input is Urdu script, Roman Urdu, or English.
 */
export function detectTextLanguage(text: string): DetectedLanguage {
  if (!text || !text.trim()) {
    return 'en';
  }

  // 1. Check for Arabic/Urdu unicode script
  if (URDU_SCRIPT_REGEX.test(text)) {
    return 'urdu';
  }

  // 2. Tokenize words (ignoring punctuation and digits)
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (tokens.length === 0) {
    return 'en';
  }

  let romanUrduHits = 0;
  for (const token of tokens) {
    if (ROMAN_URDU_VOCABULARY.has(token)) {
      romanUrduHits++;
    }
  }

  // If at least 2 Roman Urdu words or >25% of tokens match Roman Urdu markers
  if (romanUrduHits >= 2 || (tokens.length <= 3 && romanUrduHits >= 1) || (romanUrduHits / tokens.length >= 0.25)) {
    return 'roman-urdu';
  }

  return 'en';
}

/**
 * Resolves the effective response language based on user preference and detected language.
 */
export function resolveEffectiveLanguage(
  detected: DetectedLanguage,
  preference: LanguagePreference
): 'en' | 'roman-urdu' | 'urdu' {
  if (preference === 'ur') {
    return detected === 'urdu' ? 'urdu' : 'roman-urdu';
  }
  if (preference === 'en') {
    return 'en';
  }
  // 'auto' mode respects the user's input language
  return detected;
}

/**
 * Maps a language preference to the optimal Web Speech API recognition language tag.
 */
export function getRecognitionLanguageTag(
  preference: LanguagePreference,
  lastDetected?: DetectedLanguage
): 'ur-PK' | 'en-US' {
  if (preference === 'ur') {
    return 'ur-PK';
  }
  if (preference === 'en') {
    return 'en-US';
  }
  // Auto mode
  if (lastDetected === 'urdu' || lastDetected === 'roman-urdu') {
    return 'ur-PK';
  }
  return 'en-US';
}

/**
 * Provides user-facing label for a language.
 */
export function getLanguageDisplayLabel(lang: DetectedLanguage | LanguagePreference): string {
  switch (lang) {
    case 'ur':
    case 'urdu':
      return 'Urdu (اردو)';
    case 'roman-urdu':
      return 'Roman Urdu';
    case 'en':
      return 'English';
    case 'auto':
      return 'Auto-Detect';
    default:
      return 'Auto';
  }
}

