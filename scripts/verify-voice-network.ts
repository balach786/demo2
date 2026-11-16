/**
 * VERIFICATION SUITE — VOICE RECOGNITION NETWORK ERROR & RESILIENCE
 * AI Business Secretary & Accountant Management System
 *
 * Verifies:
 * 1. Error mapping for all 9 speech recognition error types including 'network'.
 * 2. Exact message formatting for network failure without false internet blame.
 * 3. Prevention of indefinite 'listening' state and cleanup of microphone resources.
 * 4. Concurrency mutex preventing overlapping recognition sessions.
 * 5. Partial transcript preservation and seamless text fallback.
 * 6. Non-looping manual retry mechanism.
 *
 * Run: npx tsx scripts/verify-voice-network.ts
 */

import {
  mapSpeechRecognitionError,
  VoiceRecognitionController,
  type VoiceRecognitionCallbacks,
} from '../src/voice/speechRecognition';
import type { VoiceRecognitionError, VoiceRecognitionState } from '../src/voice/types';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

console.log('\n=== 1. SPEECH RECOGNITION ERROR CLASSIFICATION & MESSAGING ===');

// Test 1: Network Error
const networkErr = mapSpeechRecognitionError('network', 'ur-PK');
check('Network error maps to type "network"', networkErr.type === 'network');
check(
  'Network error message matches required specification',
  networkErr.message === 'Voice recognition service is unavailable. Please check your connection or use text input.',
  networkErr.message
);
check('Network error provides remedy mentioning Retry Voice', (networkErr.remedy || '').includes('Retry Voice'));
check('Network error marked as retryable', networkErr.isRetryable === true);
check('Network error does NOT blame local internet disconnection', !networkErr.message.includes('internet is disconnected'));

// Test 2: Permission Denied
const permErr = mapSpeechRecognitionError('not-allowed', 'ur-PK');
check('not-allowed maps to "permission-denied"', permErr.type === 'permission-denied');
check('Permission denied marked as retryable', permErr.isRetryable === true);
check('Permission denied includes remedy for browser settings', (permErr.remedy || '').includes('browser settings'));

// Test 3: Service Not Allowed (Enterprise / Browser Policy)
const svcErr = mapSpeechRecognitionError('service-not-allowed', 'ur-PK');
check('service-not-allowed maps to "service-not-allowed"', svcErr.type === 'service-not-allowed');
check('service-not-allowed marked as non-retryable', svcErr.isRetryable === false);
check('service-not-allowed directs user to text input', (svcErr.remedy || '').includes('text input'));

// Test 4: Audio Capture / No Microphone
const micErr = mapSpeechRecognitionError('audio-capture', 'ur-PK');
check('audio-capture maps to "audio-capture"', micErr.type === 'audio-capture');
check('audio-capture marked as retryable', micErr.isRetryable === true);
check('audio-capture mentions microphone hardware', micErr.message.includes('microphone'));

// Test 5: No Speech Detected
const noSpeechErr = mapSpeechRecognitionError('no-speech', 'ur-PK');
check('no-speech maps to "no-speech"', noSpeechErr.type === 'no-speech');
check('no-speech marked as retryable', noSpeechErr.isRetryable === true);

// Test 6: Aborted
const abortedErr = mapSpeechRecognitionError('aborted', 'ur-PK');
check('aborted maps to "aborted"', abortedErr.type === 'aborted');
check('aborted marked as retryable', abortedErr.isRetryable === true);

// Test 7: Language Not Supported
const langErr = mapSpeechRecognitionError('language-not-supported', 'ur-PK');
check('language-not-supported maps correctly', langErr.type === 'language-not-supported');
check('language-not-supported contains requested language', langErr.message.includes('ur-PK'));
check('language-not-supported is retryable', langErr.isRetryable === true);

// Test 8: Recognition Timeout
const timeoutErr = mapSpeechRecognitionError('timeout', 'ur-PK');
check('timeout maps to "timeout"', timeoutErr.type === 'timeout');
check('timeout message explains silence expiration', timeoutErr.message.includes('timed out'));
check('timeout is retryable', timeoutErr.isRetryable === true);

// Test 9: Web Speech API Not Supported
const notSuppErr = mapSpeechRecognitionError('not-supported', 'ur-PK');
check('not-supported maps to "not-supported"', notSuppErr.type === 'not-supported');
check('not-supported is non-retryable', notSuppErr.isRetryable === false);
check('not-supported suggests supported browsers', (notSuppErr.remedy || '').includes('Chrome'));

// Test 10: Unknown Error Fallback
const unkErr = mapSpeechRecognitionError('audio-subsystem-crashed', 'ur-PK', 'Device driver reset');
check('unknown error maps to "unknown"', unkErr.type === 'unknown');
check('unknown error preserves raw message', unkErr.message === 'Device driver reset');

console.log('\n=== 2. CONTROLLER LIFECYCLE, STATE TRANSITIONS & RESOURCE CLEANUP ===');

// Setup mock browser globals for controller testing
let mockRecognitionInstance: any = null;
const resourceState: {
  tracksStopped: number;
  audioContextClosed: boolean;
} = {
  tracksStopped: 0,
  audioContextClosed: false,
};

const mockAudioTrack = {
  stop: () => {
    resourceState.tracksStopped++;
  },
};
const mockMediaStream = {
  getTracks: () => [mockAudioTrack, mockAudioTrack],
};

class MockAudioContext {
  state = 'running';
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createAnalyser() {
    return {
      fftSize: 64,
      frequencyBinCount: 32,
      getByteFrequencyData: () => {},
    };
  }
  close() {
    resourceState.audioContextClosed = true;
    this.state = 'closed';
    return Promise.resolve();
  }
}

class MockSpeechRecognition {
  continuous = true;
  interimResults = true;
  lang = 'ur-PK';
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  isStarted = false;

  constructor() {
    mockRecognitionInstance = this;
  }

  start() {
    this.isStarted = true;
    setTimeout(() => {
      if (this.onstart) this.onstart();
    }, 10);
  }

  stop() {
    this.isStarted = false;
    setTimeout(() => {
      if (this.onend) this.onend();
    }, 10);
  }

  abort() {
    this.isStarted = false;
    setTimeout(() => {
      if (this.onend) this.onend();
    }, 10);
  }
}

// Inject mocks onto global window
(global as any).window = {
  SpeechRecognition: MockSpeechRecognition,
  AudioContext: MockAudioContext,
};
try {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: async () => mockMediaStream },
    configurable: true,
  });
} catch {
  (global as any).navigator = {
    mediaDevices: { getUserMedia: async () => mockMediaStream },
  };
}
(global as any).requestAnimationFrame = (cb: () => void) => setTimeout(cb, 16);
(global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

async function runControllerTests() {
  const testState: {
    currentState: VoiceRecognitionState;
    receivedError: VoiceRecognitionError | null;
    interimText: string;
    finalText: string;
  } = {
    currentState: 'idle',
    receivedError: null,
    interimText: '',
    finalText: '',
  };

  const callbacks: VoiceRecognitionCallbacks = {
    onStateChange: (st) => {
      testState.currentState = st;
    },
    onInterimText: (txt) => {
      testState.interimText = txt;
    },
    onFinalText: (txt) => {
      testState.finalText = txt;
    },
    onError: (err) => {
      testState.receivedError = err;
    },
  };

  const controller = new VoiceRecognitionController(callbacks, 'ur-PK');

  // Test 2.1: Clean Startup
  const started = await controller.start('ur-PK');
  check('Controller starts cleanly', started === true);
  await new Promise((r) => setTimeout(r, 25));
  check('State transitions to "listening"', testState.currentState === 'listening');

  // Test 2.2: Error Transition & Immediate State Departure from "listening"
  resourceState.tracksStopped = 0;
  resourceState.audioContextClosed = false;

  // Simulate network error from browser speech recognition
  mockRecognitionInstance.onerror({ error: 'network' });

  check('State immediately departs from "listening" on error', testState.currentState !== 'listening');
  check('State transitions to "error"', testState.currentState === 'error');
  check('Received error is of type "network"', testState.receivedError?.type === 'network');
  check(
    'Error message matches specification',
    testState.receivedError?.message === 'Voice recognition service is unavailable. Please check your connection or use text input.'
  );
  check('MediaStream tracks were safely stopped', resourceState.tracksStopped === 2, `stopped: ${resourceState.tracksStopped}`);
  check('AudioContext was closed', (resourceState.audioContextClosed as boolean) === true);

  // Test 2.3: Inactivity / Timeout Guard
  console.log('\n=== 3. INACTIVITY TIMEOUT & CONCURRENCY MUTEX ===');
  testState.receivedError = null;
  await controller.start('ur-PK');
  await new Promise((r) => setTimeout(r, 25));
  check('Controller restarted into "listening"', testState.currentState === 'listening');

  // Trigger timeout internally via private handleTimeout or by fast-forwarding
  (controller as any).handleTimeout();
  check('Timeout departs "listening" state', testState.currentState !== 'listening');
  check('Timeout transitions state to "error"', testState.currentState === 'error');
  check('Timeout error type is "timeout"', (testState.receivedError as any)?.type === 'timeout');
  check('Timeout error is retryable', (testState.receivedError as any)?.isRetryable === true);

  // Test 2.4: Mutual Exclusion & Concurrency
  (controller as any).isStarting = true;
  const blockedConcurrent = await controller.start('ur-PK');
  check('Concurrent start is rejected by mutex guard', blockedConcurrent === false);
  (controller as any).isStarting = false;

  // Test 2.5: Partial Speech Preservation on Error
  console.log('\n=== 4. PARTIAL TRANSCRIPT PRESERVATION & RETRY ===');
  await controller.start('ur-PK');
  await new Promise((r) => setTimeout(r, 25));

  // Simulate partial speech arriving before network drop
  mockRecognitionInstance.onresult({
    resultIndex: 0,
    results: [
      {
        isFinal: false,
        0: { transcript: 'aaj ki total sales', confidence: 0.85 },
      },
    ],
  });

  check('Interim text captured before failure', testState.interimText === 'aaj ki total sales');
  check('Buffer retains interim transcript', (controller as any).interimTranscriptBuffer === 'aaj ki total sales');

  // Error occurs
  mockRecognitionInstance.onerror({ error: 'network' });
  check('Error received after partial speech', (testState.receivedError as any)?.type === 'network');
  check('Interim transcript buffer is preserved for text fallback', (controller as any).interimTranscriptBuffer === 'aaj ki total sales');

  // Test 2.6: Clean Manual Retry
  testState.receivedError = null;
  const retried = await controller.retry('ur-PK');
  await new Promise((r) => setTimeout(r, 25));
  check('Manual retry initiates clean new session', retried === true && testState.currentState === 'listening');
  check('Previous error is cleared', testState.receivedError === null);

  controller.cancel();
  check('Cancel returns controller to "idle"', testState.currentState === 'idle');

  console.log('\n=== 5. SUMMARY ===');
  if (failures === 0) {
    console.log('ALL VOICE RECOGNITION NETWORK & RESILIENCE TESTS PASSED (0 failures)\n');
  } else {
    console.error(`FAILED with ${failures} error(s)\n`);
    process.exit(1);
  }
}

runControllerTests().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
