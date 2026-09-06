/**
 * Kutumb Bhojan — Lightweight Browser-Native TTS Helper
 * Uses window.speechSynthesis and window.SpeechSynthesisUtterance.
 * No server, no external API, zero network dependencies.
 */

function isTtsSupported(win = (typeof window !== 'undefined' ? window : null)) {
  return !!(
    win &&
    typeof win === 'object' &&
    'speechSynthesis' in win &&
    win.speechSynthesis &&
    typeof win.speechSynthesis.speak === 'function' &&
    'SpeechSynthesisUtterance' in win &&
    typeof win.SpeechSynthesisUtterance === 'function'
  );
}

function cleanSpeechText(text) {
  if (!text) return '';
  let cleaned = String(text)
    // Strip HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove implementation/internal metadata tags like (r0, cr1, key: xxx)
    .replace(/\b(?:r\d+|cr\d+|key:\s*[\w_]+)\b/gi, ' ')
    // Replace non-breaking spaces and entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Remove isolated or dangling separators at boundaries
    .replace(/^[·•|\s,-]+|[·•|\s,-]+$/g, '')
    .trim();
  return cleaned;
}

function resolveVoice(voices, targetLang) {
  if (!Array.isArray(voices) || !voices.length || !targetLang) return null;
  const normalizedTarget = targetLang.toLowerCase().replace('_', '-');
  const targetPrefix = normalizedTarget.split('-')[0];

  // 1. Exact match (e.g., 'mr-in' === 'mr-in')
  const exact = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-') === normalizedTarget);
  if (exact) return exact;

  // 2. Prefix match (e.g., 'mr' === 'mr')
  const prefix = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(targetPrefix));
  if (prefix) return prefix;

  // 3. Fallback: null lets browser assign system default voice
  return null;
}

function prepareUtterancePlans({ mrText, enText, language = 'both' }) {
  const cleanedMr = cleanSpeechText(mrText);
  const cleanedEn = cleanSpeechText(enText);
  const plans = [];

  if (language === 'mr') {
    if (cleanedMr) plans.push({ text: cleanedMr, lang: 'mr-IN' });
    else if (cleanedEn) plans.push({ text: cleanedEn, lang: 'en-IN' });
  } else if (language === 'en') {
    if (cleanedEn) plans.push({ text: cleanedEn, lang: 'en-IN' });
    else if (cleanedMr) plans.push({ text: cleanedMr, lang: 'mr-IN' });
  } else {
    // 'both': speak Marathi first, followed by English
    if (cleanedMr) plans.push({ text: cleanedMr, lang: 'mr-IN' });
    if (cleanedEn) plans.push({ text: cleanedEn, lang: 'en-IN' });
  }

  return plans;
}

function createTtsController(win = (typeof window !== 'undefined' ? window : null)) {
  let activeKey = null;
  let listeners = new Set();
  let currentUtterances = [];

  function notify(speaking, key) {
    for (const cb of listeners) {
      try {
        cb({ speaking, activeKey: key, isSpeaking: speaking, key });
      } catch (err) {
        console.warn('TTS listener error', err);
      }
    }
  }

  function isSupported() {
    return isTtsSupported(win);
  }

  function getActiveKey() {
    return activeKey;
  }

  function isSpeaking() {
    return !!activeKey;
  }

  function onStateChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  function stop() {
    if (!isSupported()) return;
    try {
      win.speechSynthesis.cancel();
    } catch (err) {
      console.warn('speechSynthesis.cancel error', err);
    }
    currentUtterances = [];
    activeKey = null;
    notify(false, null);
  }

  function speak({ key, mrText, enText, language = 'both', rate = 1.0, pitch = 1.0 }) {
    if (!isSupported()) return false;

    // Toggle behavior: if currently speaking this exact key, stop it
    if (activeKey && activeKey === key) {
      stop();
      return false;
    }

    // Always stop any existing speech before starting new speech
    stop();

    const plans = prepareUtterancePlans({ mrText, enText, language });
    if (!plans.length) return false;

    activeKey = key;
    notify(true, key);

    const synth = win.speechSynthesis;
    let voices = [];
    try {
      voices = synth.getVoices() || [];
    } catch (e) {
      voices = [];
    }

    let completedCount = 0;
    const totalUtterances = plans.length;

    plans.forEach((plan, idx) => {
      const utterance = new win.SpeechSynthesisUtterance(plan.text);
      utterance.lang = plan.lang;
      utterance.rate = rate;
      utterance.pitch = pitch;

      const matchedVoice = resolveVoice(voices, plan.lang);
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => {
        completedCount++;
        if (completedCount >= totalUtterances) {
          activeKey = null;
          currentUtterances = [];
          notify(false, null);
        }
      };

      utterance.onerror = (err) => {
        console.warn('TTS utterance error', err);
        activeKey = null;
        currentUtterances = [];
        notify(false, null);
      };

      currentUtterances.push(utterance);

      try {
        synth.speak(utterance);
      } catch (err) {
        console.warn('speechSynthesis.speak error', err);
        activeKey = null;
        notify(false, null);
      }
    });

    return true;
  }

  return {
    isSupported,
    getActiveKey,
    getCurrentKey: getActiveKey,
    isSpeaking,
    onStateChange,
    speak,
    stop
  };
}

const defaultController = createTtsController();

if (typeof module !== 'undefined') {
  module.exports = {
    isTtsSupported,
    cleanSpeechText,
    resolveVoice,
    prepareUtterancePlans,
    createTtsController,
    tts: defaultController
  };
}

export {
  isTtsSupported,
  cleanSpeechText,
  resolveVoice,
  prepareUtterancePlans,
  createTtsController,
  defaultController as tts
};
