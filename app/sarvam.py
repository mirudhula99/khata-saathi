"""Thin HTTP client for Sarvam AI plus an OpenAI-compatible LLM call.

No automatic retries: a retry loop is the easiest way to burn credits.
"""
import base64
import hashlib
import logging
import re

import httpx

from .config import TTS_DIR, settings

log = logging.getLogger("khata.sarvam")

THINK_RE = re.compile(r"<think>.*?</think>", re.S | re.I)
_translit_cache: dict[str, str] = {}


class SarvamError(Exception):
    pass


def _key_headers() -> dict:
    return {"api-subscription-key": settings.sarvam_api_key}


def _raise_for(response: httpx.Response, what: str) -> None:
    if response.status_code == 403:
        raise SarvamError(f"{what}: the API key was rejected (403). Check SARVAM_API_KEY in .env.")
    if response.status_code == 429:
        raise SarvamError(f"{what}: rate limit reached or credits used up (429). Check the Sarvam dashboard.")
    raise SarvamError(f"{what} failed ({response.status_code}): {response.text[:300]}")


# ---------------------------------------------------------------- speech-to-text
def transcribe(wav: bytes, language_code: str | None = None) -> dict:
    if not settings.sarvam_api_key:
        raise SarvamError("Voice needs SARVAM_API_KEY in .env. Use the Type button for now.")
    data = {"model": settings.stt_model, "mode": settings.stt_mode}
    if language_code:
        data["language_code"] = language_code
    try:
        response = httpx.post(
            f"{settings.sarvam_base_url}/speech-to-text",
            headers=_key_headers(),
            data=data,
            files={"file": ("speech.wav", wav, "audio/wav")},
            timeout=settings.http_timeout,
        )
    except httpx.HTTPError as exc:
        raise SarvamError(f"Speech-to-text request failed: {exc}") from exc
    if response.status_code >= 400:
        _raise_for(response, "Speech-to-text")
    body = response.json()
    return {"transcript": (body.get("transcript") or "").strip(), "language_code": body.get("language_code")}


# ---------------------------------------------------------------- text-to-speech
def synthesize(text: str, lang: str) -> str | None:
    """Return a URL like /audio/<hash>.wav, or None (the browser then speaks it).

    Results are cached on disk, so fixed phrases cost credits only once.
    """
    text = (text or "").strip()
    if not text:
        return None
    digest = hashlib.sha1(f"{settings.tts_model}|{settings.tts_speaker}|{lang}|{text}".encode()).hexdigest()[:24]
    path = TTS_DIR / f"{digest}.wav"
    if path.exists():
        return f"/audio/{path.name}"
    if not (settings.sarvam_api_key and settings.tts_enabled):
        return None
    body = {"text": text[:1500], "language_code": lang, "model": settings.tts_model}
    if settings.tts_speaker:
        body["speaker"] = settings.tts_speaker
    try:
        response = httpx.post(
            f"{settings.sarvam_base_url}/text-to-speech",
            headers={**_key_headers(), "Content-Type": "application/json"},
            json=body,
            timeout=settings.http_timeout,
        )
        if response.status_code >= 400:
            log.warning("Text-to-speech failed (%s): %s", response.status_code, response.text[:200])
            return None
        audios = response.json().get("audios") or []
        if not audios:
            return None
        audio = base64.b64decode(audios[0] if len(audios) == 1 else "".join(audios))
        path.write_bytes(audio)
        return f"/audio/{path.name}"
    except Exception:  # never break a flow because of speech output
        log.exception("Text-to-speech error")
        return None


# ---------------------------------------------------------------- transliteration
def transliterate_to_latin(text: str) -> str:
    """லட்சுமி -> Lakshmi. Falls back to the input if unavailable."""
    text = (text or "").strip()
    if not text or text.isascii() or not settings.sarvam_api_key:
        return text
    if text in _translit_cache:
        return _translit_cache[text]
    try:
        response = httpx.post(
            f"{settings.sarvam_base_url}/transliterate",
            headers={**_key_headers(), "Content-Type": "application/json"},
            json={"input": text[:1000], "source_language_code": "auto", "target_language_code": "en-IN"},
            timeout=settings.http_timeout,
        )
        if response.status_code >= 400:
            log.warning("Transliteration failed (%s): %s", response.status_code, response.text[:200])
            return text
        result = (response.json().get("transliterated_text") or text).strip()
        _translit_cache[text] = result
        return result
    except Exception:
        log.exception("Transliteration error")
        return text


# ---------------------------------------------------------------- LLM
def llm_chat(messages: list, *, model: str, response_format: dict | None = None,
             tools: list | None = None, max_tokens: int = 500) -> dict:
    """OpenAI-compatible chat call. Returns choices[0].message as a dict."""
    if not settings.llm_api_key:
        raise SarvamError("No LLM key configured.")
    headers = {"Authorization": f"Bearer {settings.llm_api_key}", "Content-Type": "application/json"}
    if "sarvam.ai" in settings.llm_base_url:
        headers["api-subscription-key"] = settings.llm_api_key
    body: dict = {"model": model, "messages": messages, "temperature": 0, "max_tokens": max_tokens}
    if response_format:
        body["response_format"] = response_format
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    if settings.llm_reasoning_effort:
        body["reasoning_effort"] = settings.llm_reasoning_effort
    elif "sarvam.ai" in settings.llm_base_url:
        # Sarvam models think by default, which is slow and can use up max_tokens before the answer.
        body["reasoning_effort"] = None
    try:
        response = httpx.post(f"{settings.llm_base_url}/chat/completions", headers=headers, json=body,
                              timeout=settings.http_timeout)
    except httpx.HTTPError as exc:
        raise SarvamError(f"LLM request failed: {exc}") from exc
    if response.status_code >= 400:
        _raise_for(response, "LLM")
    choices = response.json().get("choices") or []
    if not choices:
        raise SarvamError("LLM returned no answer.")
    return choices[0].get("message") or {}


def strip_think(text: str) -> str:
    return THINK_RE.sub("", text or "").strip()
