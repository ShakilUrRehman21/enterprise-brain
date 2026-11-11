"""Shared Gemini client that works with both kinds of Google API key.

A key can be bound to the Gemini Developer API (generativelanguage.googleapis.com)
or to Vertex AI express mode (aiplatform.googleapis.com). Newer "AQ." keys can
be either, and a key sent to the wrong endpoint is rejected with 401/403. In
`auto` mode we start with the Developer API and switch to Vertex once if the
key is rejected; the working mode is then kept for the life of the process.
"""
import logging
import threading
from typing import Callable, Optional, TypeVar

from app.core.config import settings

logger = logging.getLogger(__name__)
T = TypeVar("T")

_AUTH_HINTS = ("API_KEY_INVALID", "API key not valid", "PERMISSION_DENIED", "UNAUTHENTICATED", "not authorized")


def _is_auth_error(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (401, 403):
        return True
    return any(h in str(exc) for h in _AUTH_HINTS)


class GeminiClient:
    def __init__(self, api_key: str, backend: str = "auto"):
        self._key = api_key
        self._lock = threading.Lock()
        self.mode = "vertex" if backend == "vertex" else "developer"
        self._can_switch = backend == "auto"
        self._client = self._make(self.mode)

    def _make(self, mode: str):
        from google import genai
        from google.genai import types

        # Never let a slow or overloaded API hang a request indefinitely.
        http = types.HttpOptions(timeout=settings.GEMINI_TIMEOUT_SECONDS * 1000)
        if mode == "vertex":
            return genai.Client(vertexai=True, api_key=self._key, http_options=http)
        return genai.Client(api_key=self._key, http_options=http)

    def call(self, fn: Callable[[object], T]) -> T:
        try:
            return fn(self._client)
        except Exception as exc:
            if not (self._can_switch and _is_auth_error(exc)):
                raise
            with self._lock:
                if self._can_switch:
                    logger.info("Key rejected by the Gemini Developer API (%s); trying Vertex AI express mode.", exc)
                    self._client, self.mode, self._can_switch = self._make("vertex"), "vertex", False
            return fn(self._client)


_client: Optional[GeminiClient] = None


def get_client() -> Optional[GeminiClient]:
    global _client
    if _client is None and settings.gemini_enabled:
        _client = GeminiClient(settings.GEMINI_API_KEY.strip(), settings.GEMINI_BACKEND)
    return _client
