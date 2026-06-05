import os
import re

import httpx


def _strip_html(text: str) -> str:
    if not text:
        return text
    return re.sub(r"<[^>]+>", "", text).strip()


_CACHE: dict[tuple[str, str], str] = {}


def translate_text(text: str, target: str = "en") -> str:
    """Translate via Google Translate API (if configured).

    Falls back to the original text when the API key is missing or the call fails.
    Uses an in-memory cache to avoid repeated network calls for identical strings.
    """
    text = (text or "").strip()
    if not text:
        return text

    cache_key = (target, text)
    cached = _CACHE.get(cache_key)
    if cached is not None:
        return cached

    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        _CACHE[cache_key] = text
        return text

    url = "https://translation.googleapis.com/language/translate/v2"
    try:
        resp = httpx.post(
            url,
            params={"key": key},
            json={"q": text, "target": target, "format": "text"},
            timeout=10.0,
        )
        data = resp.json()
        translated = data.get("data", {}).get("translations", [])[0].get("translatedText", text)
        result = _strip_html(translated) or text
        _CACHE[cache_key] = result
        return result
    except Exception:
        _CACHE[cache_key] = text
        return text


def translate_texts(texts: list[str], target: str = "en") -> list[str]:
    """Batch translate texts (Google API supports passing multiple `q` values).

    Returns a list with the same length/order as `texts`.
    """
    cleaned = [(t or "").strip() for t in texts]
    if not cleaned:
        return []

    key = os.getenv("GOOGLE_API_KEY")
    if not key:
        return cleaned

    # Find unique, uncached strings to translate.
    missing: list[str] = []
    seen: set[str] = set()
    for t in cleaned:
        if not t:
            continue
        cache_key = (target, t)
        if cache_key in _CACHE:
            continue
        # If target is English and the text is already plain ASCII, bypass translation API
        if target == "en" and all(ord(c) < 128 for c in t):
            _CACHE[cache_key] = t
            continue
        if t in seen:
            continue
        seen.add(t)
        missing.append(t)

    if missing:
        url = "https://translation.googleapis.com/language/translate/v2"
        try:
            resp = httpx.post(
                url,
                params={"key": key},
                json={"q": missing, "target": target, "format": "text"},
                timeout=2.0,
            )
            data = resp.json()
            translations = data.get("data", {}).get("translations", []) or []
            for src, item in zip(missing, translations):
                translated = item.get("translatedText", src)
                _CACHE[(target, src)] = _strip_html(translated) or src
        except Exception:
            for src in missing:
                _CACHE[(target, src)] = src

    # Assemble results.
    out: list[str] = []
    for t in cleaned:
        if not t:
            out.append(t)
        else:
            out.append(_CACHE.get((target, t), t))
    return out


def simplify_english(text: str, max_words: int = 24) -> str:
    """Make English descriptions easier to scan.

    This is a lightweight simplifier (no LLM): removes extra whitespace and truncates
    to a short, readable snippet while keeping the core meaning.
    """
    text = _strip_html(text or "")
    if not text:
        return text

    text = re.sub(r"\s+", " ", text).strip()
    # Prefer the first sentence if it is short enough.
    first_sentence = re.split(r"(?<=[.!?])\s+", text, maxsplit=1)[0].strip()
    candidate = first_sentence if first_sentence else text

    words = candidate.split(" ")
    if len(words) <= max_words:
        return candidate
    return " ".join(words[:max_words]).rstrip(",;:.") + "…"
