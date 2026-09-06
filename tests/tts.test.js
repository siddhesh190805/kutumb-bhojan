const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isTtsSupported,
  cleanSpeechText,
  resolveVoice,
  prepareUtterancePlans,
  createTtsController
} = require('../tts.js');

// Mock SpeechSynthesis and SpeechSynthesisUtterance for testing
class MockUtterance {
  constructor(text) {
    this.text = text;
    this.lang = 'en-US';
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }
}

class MockSpeechSynthesis {
  constructor(voices = []) {
    this.voices = voices;
    this.queue = [];
    this.speaking = false;
    this.paused = false;
  }

  getVoices() {
    return this.voices;
  }

  speak(utterance) {
    this.queue.push(utterance);
    this.speaking = true;
    if (utterance.onstart) utterance.onstart();
  }

  cancel() {
    this.queue = [];
    this.speaking = false;
  }

  // Helper to simulate completion of current utterance
  finishCurrent() {
    if (this.queue.length > 0) {
      const u = this.queue.shift();
      if (this.queue.length === 0) this.speaking = false;
      if (u.onend) u.onend();
    }
  }

  // Helper to simulate error
  errorCurrent(err = new Error('TTS Failure')) {
    if (this.queue.length > 0) {
      const u = this.queue.shift();
      if (this.queue.length === 0) this.speaking = false;
      if (u.onerror) u.onerror({ error: err });
    }
  }
}

test('1. TTS support detection correctly identifies environment availability', () => {
  assert.equal(isTtsSupported(null), false);
  assert.equal(isTtsSupported({}), false);
  assert.equal(isTtsSupported({ speechSynthesis: {} }), false);
  assert.equal(isTtsSupported({ speechSynthesis: new MockSpeechSynthesis(), SpeechSynthesisUtterance: MockUtterance }), true);
});

test('2. Marathi language selection sets mr-IN language preference', () => {
  const plans = prepareUtterancePlans({
    mrText: 'प्रथिने शरीरासाठी आवश्यक आहेत.',
    enText: 'Protein is essential for the body.',
    language: 'mr'
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].lang, 'mr-IN');
  assert.equal(plans[0].text, 'प्रथिने शरीरासाठी आवश्यक आहेत.');
});

test('3. English language selection sets en-IN language preference', () => {
  const plans = prepareUtterancePlans({
    mrText: 'प्रथिने शरीरासाठी आवश्यक आहेत.',
    enText: 'Protein is essential for the body.',
    language: 'en'
  });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].lang, 'en-IN');
  assert.equal(plans[0].text, 'Protein is essential for the body.');
});

test('4. Both-language composition generates Marathi followed by English in sequence', () => {
  const plans = prepareUtterancePlans({
    mrText: 'प्रथिने शरीरासाठी आवश्यक आहेत.',
    enText: 'Protein is essential for the body.',
    language: 'both'
  });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].lang, 'mr-IN');
  assert.equal(plans[0].text, 'प्रथिने शरीरासाठी आवश्यक आहेत.');
  assert.equal(plans[1].lang, 'en-IN');
  assert.equal(plans[1].text, 'Protein is essential for the body.');
});

test('5. Current speech stops before new speech begins', () => {
  const mockSynth = new MockSpeechSynthesis();
  const mockWindow = { speechSynthesis: mockSynth, SpeechSynthesisUtterance: MockUtterance };
  const controller = createTtsController(mockWindow);

  controller.speak({
    key: 'item-1',
    mrText: 'पहिला मजकूर',
    enText: 'First text',
    language: 'mr'
  });

  assert.equal(controller.getActiveKey(), 'item-1');
  assert.equal(mockSynth.queue.length, 1);
  assert.equal(mockSynth.queue[0].text, 'पहिला मजकूर');

  // Speak a second item: should cancel first and start second
  controller.speak({
    key: 'item-2',
    mrText: 'दुसरा मजकूर',
    enText: 'Second text',
    language: 'mr'
  });

  assert.equal(controller.getActiveKey(), 'item-2');
  assert.equal(mockSynth.queue.length, 1);
  assert.equal(mockSynth.queue[0].text, 'दुसरा मजकूर');
});

test('6. Voice preference selects exact match, then prefix, then falls back gracefully', () => {
  const voices = [
    { name: 'Google US English', lang: 'en-US' },
    { name: 'Google Indian English', lang: 'en-IN' },
    { name: 'Marathi India Voice', lang: 'mr-IN' },
    { name: 'Hindi India Voice', lang: 'hi-IN' }
  ];

  // Exact match
  const mrVoice = resolveVoice(voices, 'mr-IN');
  assert.equal(mrVoice.name, 'Marathi India Voice');

  const enVoice = resolveVoice(voices, 'en-IN');
  assert.equal(enVoice.name, 'Google Indian English');

  // Prefix match when exact is missing
  const missingRegionalEn = resolveVoice([
    { name: 'Google US English', lang: 'en-US' }
  ], 'en-IN');
  assert.equal(missingRegionalEn.name, 'Google US English');

  // Fallback to null (allowing browser default) when no language match exists
  const noMatch = resolveVoice([
    { name: 'Google US English', lang: 'en-US' }
  ], 'mr-IN');
  assert.equal(noMatch, null);
});

test('7. Graceful behavior when SpeechSynthesis is unavailable', () => {
  const controller = createTtsController(null);
  assert.equal(controller.isSupported(), false);
  assert.doesNotThrow(() => {
    controller.speak({ key: 'test', mrText: 'मजकूर', enText: 'Text', language: 'both' });
    controller.stop();
  });
  assert.equal(controller.getActiveKey(), null);
  assert.equal(controller.isSpeaking(), false);
});

test('8. Speech text cleanup removes HTML tags, excessive whitespace, and internal metadata', () => {
  const raw = `
    <h3>पोषण माहिती · <b>Nutrition</b></h3>
    <p>   डाळ आणि   कडधान्ये  </p>
    <small>r0 · key: moong_dal</small>
  `;
  const cleaned = cleanSpeechText(raw);
  assert.equal(cleaned, 'पोषण माहिती · Nutrition डाळ आणि कडधान्ये');
  assert.doesNotMatch(cleaned, /<h3>|<p>|<small>/);
  assert.doesNotMatch(cleaned, /r0|moong_dal/);
});

test('9. Empty/invalid speech text is rejected safely without queuing utterances', () => {
  const mockSynth = new MockSpeechSynthesis();
  const mockWindow = { speechSynthesis: mockSynth, SpeechSynthesisUtterance: MockUtterance };
  const controller = createTtsController(mockWindow);

  controller.speak({ key: 'empty-test', mrText: '', enText: '   ', language: 'both' });
  assert.equal(mockSynth.queue.length, 0);
  assert.equal(controller.getActiveKey(), null);
  assert.equal(controller.isSpeaking(), false);
});

test('10. Speaking state resets cleanly on completion, error, and explicit stop', () => {
  const mockSynth = new MockSpeechSynthesis();
  const mockWindow = { speechSynthesis: mockSynth, SpeechSynthesisUtterance: MockUtterance };
  const controller = createTtsController(mockWindow);

  let stateChanges = [];
  controller.onStateChange((state) => stateChanges.push(state));

  // Start speech
  controller.speak({ key: 'card-1', mrText: 'नमस्कार', enText: 'Hello', language: 'mr' });
  assert.equal(controller.isSpeaking(), true);
  assert.equal(controller.getActiveKey(), 'card-1');

  // Finish speech
  mockSynth.finishCurrent();
  assert.equal(controller.isSpeaking(), false);
  assert.equal(controller.getActiveKey(), null);

  // Start again and test explicit stop
  controller.speak({ key: 'card-1', mrText: 'नमस्कार', enText: 'Hello', language: 'mr' });
  assert.equal(controller.isSpeaking(), true);
  controller.stop();
  assert.equal(controller.isSpeaking(), false);
  assert.equal(controller.getActiveKey(), null);

  // Start again and test error
  controller.speak({ key: 'card-2', mrText: 'मजकूर', enText: 'Text', language: 'en' });
  assert.equal(controller.isSpeaking(), true);
  mockSynth.errorCurrent();
  assert.equal(controller.isSpeaking(), false);
  assert.equal(controller.getActiveKey(), null);

  // Tapping active key toggles to stop
  controller.speak({ key: 'toggle-test', mrText: 'मजकूर', enText: 'Text', language: 'mr' });
  assert.equal(controller.isSpeaking(), true);
  controller.speak({ key: 'toggle-test', mrText: 'मजकूर', enText: 'Text', language: 'mr' });
  assert.equal(controller.isSpeaking(), false);
  assert.equal(controller.getActiveKey(), null);
});

test('11. app.js wires TTS into Today, Nutrition Classroom, and Recipe Detail', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.match(appSource, /import\s*\{\s*tts\s*\}\s*from\s*['"]\.\/tts\.js['"]/);
  assert.match(appSource, /ttsButtonHtml\('today-learning'/);
  assert.match(appSource, /ttsButtonHtml\(`nutrition-\$\{/);
  assert.match(appSource, /ttsButtonHtml\(`recipe-\$\{/);
  assert.match(appSource, /data-tts-key/);
  assert.match(appSource, /data-tts-mr/);
  assert.match(appSource, /data-tts-en/);
});

test('12. app.js enforces single global playback, reactive state updates, and accessible labels', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

  assert.match(appSource, /tts\.onStateChange/);
  assert.match(appSource, /aria-label/);
  assert.match(appSource, /aria-pressed/);
  assert.match(appSource, /ऐका \/ Listen/);
  assert.match(appSource, /थांबवा \/ Stop/);
  assert.match(appSource, /tts\.stop\(\)/);
});

test('13. styles.css provides accessible styling, active state, and responsive rules for TTS buttons', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const cssSource = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

  assert.match(cssSource, /\.tts-btn\s*\{/);
  assert.match(cssSource, /\.tts-btn\.active\s*\{/);
  assert.match(cssSource, /\.tts-btn:focus-visible/);
  assert.match(cssSource, /min-height:\s*44px/);
  assert.match(cssSource, /\.nutrition-tts-btn/);
  assert.match(cssSource, /\.recipe-tts-btn/);
});

