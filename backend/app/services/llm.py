"""Gemini text generation with resilience to model retirements and
model-family differences in "thinking" configuration."""
import logging
import re
import time
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def _is_model_missing(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return code == 404 or "NOT_FOUND" in str(exc)


def _is_transient(exc: Exception) -> bool:
    """Overload / rate-limit / server errors that are worth retrying."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    text = str(exc)
    return code in (429, 500, 502, 503, 504) or any(
        s in text for s in ("UNAVAILABLE", "RESOURCE_EXHAUSTED", "INTERNAL", "DEADLINE_EXCEEDED")
    )


def _is_thinking_rejected(exc: Exception) -> bool:
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    return code == 400 and "think" in str(exc).lower()


def _version(name: str) -> tuple:
    m = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
    return (float(m.group(1)) if m else 0.0, "lite" not in name)


def flash_models(names: List[str], include_lite: bool = False) -> List[str]:
    """Stable Flash text models from a model listing, newest first."""
    skip = ("preview", "exp", "image", "tts", "audio", "live", "embedding", "thinking")
    if not include_lite:
        skip += ("lite",)
    candidates = {n.split("/")[-1] for n in names}
    return sorted((n for n in candidates if "flash" in n and not any(s in n for s in skip)), key=_version, reverse=True)


def pick_flash_model(names: List[str]) -> Optional[str]:
    """Newest stable Flash text model from a model listing."""
    found = flash_models(names)
    return found[0] if found else None


class GeminiLLM:
    def __init__(self, model: str):
        from app.services.gemini import get_client

        self._client = get_client()
        self.model = model
        self.last_model = model
        self.last_error: Optional[str] = None
        self._use_thinking_config = True

    def _config(self, model: str, system: str, temperature: float, max_tokens: int):
        from google.genai import types

        thinking = None
        if self._use_thinking_config and "flash" in model:
            # Grounded answers don't benefit from long reasoning; keep it minimal.
            # Gemini 2.5 uses a token budget, Gemini 3+ uses a level.
            if model.startswith("gemini-2."):
                thinking = types.ThinkingConfig(thinking_budget=0)
            else:
                thinking = types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)
        return types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=max_tokens,
            thinking_config=thinking,
        )

    def _available_models(self) -> List[str]:
        def run(c):
            out = []
            for m in c.models.list():
                actions = getattr(m, "supported_actions", None)
                if not actions or "generateContent" in actions:
                    out.append(m.name)
            return out

        return self._client.call(run)

    def _generate_once(
        self, model: str, prompt: str, system: str, temperature: float, max_tokens: int, deadline: float
    ) -> str:
        """One model, with a retry for transient overload errors while time allows."""
        delays = [1.5]
        while True:
            cfg = self._config(model, system, temperature, max_tokens)
            try:
                resp = self._client.call(lambda c: c.models.generate_content(model=model, contents=prompt, config=cfg))
            except Exception as exc:
                if _is_thinking_rejected(exc) and self._use_thinking_config:
                    self._use_thinking_config = False
                    continue
                # Only retry if another full attempt still fits in the time budget.
                if _is_transient(exc) and delays and time.monotonic() + delays[0] + settings.GEMINI_TIMEOUT_SECONDS < deadline:
                    time.sleep(delays.pop(0))
                    continue
                raise
            text = (getattr(resp, "text", None) or "").strip()
            if not text:
                raise LLMError("Gemini returned an empty response.")
            return text

    def generate(self, *args, **kwargs) -> str:
        """Generate text, remembering the last failure for the status page."""
        try:
            text = self._generate(*args, **kwargs)
        except LLMError as exc:
            self.last_error = str(exc)[:500]
            raise
        self.last_error = None
        return text

    def _generate(
        self, prompt: str, system: str, temperature: float = 0.1, max_tokens: int = 2048, budget: Optional[float] = None
    ) -> str:
        deadline = time.monotonic() + (budget if budget is not None else settings.ANSWER_TIME_BUDGET_SECONDS)
        try:
            text = self._generate_once(self.model, prompt, system, temperature, max_tokens, deadline)
            self.last_model = self.model
            return text
        except LLMError:
            raise
        except Exception as exc:
            first_exc = exc
            if not (_is_model_missing(exc) or _is_transient(exc)):
                raise LLMError(f"Gemini generation failed: {exc}") from exc

        # The configured model is retired or overloaded: try other Flash models.
        try:
            names = self._available_models()
        except Exception as list_exc:  # noqa: BLE001
            logger.warning("Couldn't list Gemini models: %s", list_exc)
            raise LLMError(f"Gemini generation failed: {first_exc}") from first_exc
        alternatives = [m for m in flash_models(names, include_lite=True) if m != self.model][:2]
        for alt in alternatives:
            if time.monotonic() + 5 > deadline:
                break  # out of time: let the caller use the offline answer
            try:
                text = self._generate_once(alt, prompt, system, temperature, max_tokens, deadline)
            except LLMError:
                raise
            except Exception as exc:  # noqa: BLE001
                logger.warning("Fallback model %s failed: %s", alt, exc)
                continue
            if _is_model_missing(first_exc):
                logger.warning(
                    "Model %s is unavailable; switching to %s. Set GEMINI_GENERATION_MODEL to choose explicitly.",
                    self.model,
                    alt,
                )
                self.model = alt  # permanent: the configured model is gone
            else:
                logger.info("%s is busy; answered with %s.", self.model, alt)
            self.last_model = alt
            return text
        raise LLMError(f"Gemini generation failed: {first_exc}") from first_exc


def _build() -> Optional[GeminiLLM]:
    if not settings.gemini_enabled:
        return None
    try:
        return GeminiLLM(settings.GEMINI_GENERATION_MODEL)
    except Exception as exc:  # pragma: no cover
        logger.error("Gemini generation unavailable: %s", exc)
        return None


llm: Optional[GeminiLLM] = _build()
