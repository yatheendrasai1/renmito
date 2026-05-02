import logging
import httpx

logger = logging.getLogger("ic.gemini")

_GEMINI_URL = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models/gemini-2.5-flash-lite:generateContent"
)


async def call_gemini(api_key: str, prompt: str) -> tuple[str, str]:
    """Call Gemini and return (text, finish_reason). Raises GeminiError on failure."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 8192, "temperature": 0.1},
    }
    headers = {"Content-Type": "application/json", "X-goog-api-key": api_key}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(_GEMINI_URL, json=payload, headers=headers)
    except httpx.RequestError as e:
        logger.error(f"Network error reaching Gemini: {e}")
        raise GeminiError("Could not reach Gemini API. Check your network.", status=503)

    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", "Gemini API error")
        except Exception:
            msg = "Gemini API error"
        logger.error(f"Gemini HTTP {resp.status_code}: {msg}")
        raise GeminiError(msg, status=429 if resp.status_code == 429 else 502)

    data = resp.json()
    candidate = data.get("candidates", [{}])[0]
    text = candidate.get("content", {}).get("parts", [{}])[0].get("text")
    finish_reason = candidate.get("finishReason", "UNKNOWN")

    if not text:
        logger.warning(f"Gemini returned empty candidate, finishReason={finish_reason}")
        raise GeminiError("Gemini returned an empty response.", status=502)

    logger.info(f"Gemini ok — finishReason={finish_reason} responseLen={len(text)}")
    return text, finish_reason


class GeminiError(Exception):
    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status
        self.code = "GEMINI_API_ERROR"
