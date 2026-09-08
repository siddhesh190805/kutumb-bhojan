// In-memory cache for audio to minimize repeated provider calls
const audioCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { text, language = 'mr-IN' } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Valid text is required' });
    }

    const cleanText = text.trim();
    const cacheKey = `${language}:${cleanText}`;
    if (audioCache.has(cacheKey)) {
      return res.status(200).json({
        cached: true,
        audioBase64: audioCache.get(cacheKey),
        format: 'audio/wav',
        provider: 'sarvam-bulbul-v3'
      });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      // Fallback response instructs client to use client-side SpeechSynthesis
      return res.status(200).json({
        fallback: true,
        reason: 'Server-side TTS provider not configured; use browser SpeechSynthesis',
        cleanText,
        language
      });
    }

    // Sarvam AI Bulbul v3 TTS call
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey
      },
      body: JSON.stringify({
        inputs: [cleanText],
        target_language_code: language === 'mr-IN' || language.startsWith('mr') ? 'mr-IN' : 'en-IN',
        speaker: 'meera',
        model: 'bulbul:v3'
      })
    });

    if (!response.ok) {
      return res.status(200).json({
        fallback: true,
        reason: `Provider returned status ${response.status}; fallback to SpeechSynthesis`,
        cleanText,
        language
      });
    }

    const data = await response.json();
    const audioBase64 = data?.audios?.[0] || null;

    if (audioBase64) {
      // Cache the audio
      audioCache.set(cacheKey, audioBase64);
      return res.status(200).json({
        cached: false,
        audioBase64,
        format: 'audio/wav',
        provider: 'sarvam-bulbul-v3'
      });
    }

    return res.status(200).json({
      fallback: true,
      reason: 'No audio returned from provider',
      cleanText,
      language
    });
  } catch (err) {
    return res.status(200).json({
      fallback: true,
      reason: err.message || 'TTS request failed; falling back to SpeechSynthesis',
      cleanText: (req.body?.text || '').trim()
    });
  }
}
