"""
TTS provider abstraction and caching for Kutumb Bhojan.
Supports Sarvam AI Bulbul and graceful browser SpeechSynthesis fallback.
"""
from typing import Protocol
import httpx
from backend.app.config import settings


class TTSProvider(Protocol):
    async def synthesize(self, text: str, language: str) -> dict:
        ...


class InMemoryTTSCache:
    def __init__(self, max_entries: int = 100):
        self._cache: dict[str, str] = {}
        self._keys: list[str] = []
        self.max_entries = max_entries

    def get(self, key: str) -> str | None:
        return self._cache.get(key)

    def set(self, key: str, value: str) -> None:
        if key in self._cache:
            return
        if len(self._keys) >= self.max_entries:
            oldest = self._keys.pop(0)
            self._cache.pop(oldest, None)
        self._keys.append(key)
        self._cache[key] = value


class SarvamBulbulTTSProvider:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.sarvam_api_key
        self.endpoint = "https://api.sarvam.ai/text-to-speech"

    async def synthesize(self, text: str, language: str) -> dict:
        clean_text = text.strip()
        if not self.api_key:
            return {
                "fallback": True,
                "reason": "Server-side TTS provider not configured; use browser SpeechSynthesis",
                "cleanText": clean_text,
                "language": language
            }

        lang_code = "mr-IN" if language.startswith("mr") else "en-IN"
        payload = {
            "inputs": [clean_text],
            "target_language_code": lang_code,
            "speaker": "meera",
            "model": "bulbul:v3"
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(
                    self.endpoint,
                    headers={
                        "Content-Type": "application/json",
                        "api-subscription-key": self.api_key
                    },
                    json=payload
                )
                if res.status_code == 200:
                    data = res.json()
                    audios = data.get("audios", [])
                    if audios:
                        return {
                            "fallback": False,
                            "audioBase64": audios[0],
                            "format": "audio/wav",
                            "provider": "sarvam-bulbul-v3",
                            "cleanText": clean_text,
                            "language": language
                        }
                return {
                    "fallback": True,
                    "reason": f"Provider returned status {res.status_code}; fallback to SpeechSynthesis",
                    "cleanText": clean_text,
                    "language": language
                }
            except Exception as e:
                return {
                    "fallback": True,
                    "reason": f"TTS provider network error: {str(e)}; fallback to SpeechSynthesis",
                    "cleanText": clean_text,
                    "language": language
                }


class TTSService:
    def __init__(self, provider: TTSProvider | None = None):
        self.provider = provider or SarvamBulbulTTSProvider()
        self.cache = InMemoryTTSCache()

    async def speak(self, text: str, language: str = "mr-IN") -> dict:
        clean_text = text.strip()
        cache_key = f"{language}:{clean_text}"
        cached = self.cache.get(cache_key)
        if cached:
            return {
                "cached": True,
                "audioBase64": cached,
                "format": "audio/wav",
                "provider": "sarvam-bulbul-v3",
                "cleanText": clean_text,
                "language": language
            }

        res = await self.provider.synthesize(clean_text, language)
        if not res.get("fallback") and res.get("audioBase64"):
            self.cache.set(cache_key, res["audioBase64"])
        return res


tts_service = TTSService()
