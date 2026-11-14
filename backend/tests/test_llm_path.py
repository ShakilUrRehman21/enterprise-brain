"""The Gemini answer path, exercised with a fake model (no network)."""
import pytest

from app.services import answering
from app.services.llm import LLMError
from app.services.prompts import NO_ANSWER_TOKEN


class FakeLLM:
    model = "fake-model"

    def __init__(self, reply):
        self.reply = reply
        self.prompts = []

    def generate(self, prompt, system, temperature=0.1, max_tokens=1024):
        self.prompts.append(prompt)
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply(prompt) if callable(self.reply) else self.reply


@pytest.fixture()
def fake_llm(monkeypatch):
    def install(reply):
        fake = FakeLLM(reply)
        monkeypatch.setattr(answering, "llm", fake)
        return fake

    return install


def ask(client, headers, q):
    return client.post("/api/chat", json={"message": q}, headers=headers).json()["message"]


def test_citations_are_validated_and_renumbered(client, admin, samples, fake_llm):
    def reply(prompt):
        n = prompt.count("<source number=")
        assert n >= 2, "test needs at least two sources in the prompt"
        # Cites the last source first, an out-of-range source, and a grouped "[n, 1]".
        return f"Expense reports are due within 30 days [{n}]. Receipts are needed above $25 [99][{n}, 1].\n\nSources:\n[1] junk"

    fake_llm(reply)
    msg = ask(client, admin[0], "Summarize the travel and expense rules for receipts and reports")
    assert msg["engine"] == "gemini"
    assert "[99]" not in msg["content"] and "Sources" not in msg["content"]
    assert msg["content"].startswith("Expense reports are due within 30 days [1].")
    assert msg["content"].endswith("[2][1].") or msg["content"].endswith("[1][2].")
    assert [c["number"] for c in msg["citations"]] == [1, 2]
    assert all(c["quote"] in c["passage"] for c in msg["citations"] if c["quote"])


def test_model_abstention_is_respected(client, admin, samples, fake_llm):
    fake_llm(NO_ANSWER_TOKEN)
    msg = ask(client, admin[0], "How long do I have to submit expenses?")
    assert msg["abstained"] and msg["citations"] == []


def test_uncited_answers_are_rejected(client, admin, samples, fake_llm):
    fake_llm("You have 30 days.")
    assert ask(client, admin[0], "How long do I have to submit expenses?")["abstained"]


def test_falls_back_to_extractive_when_model_fails(client, admin, samples, fake_llm):
    fake_llm(LLMError("quota exceeded"))
    msg = ask(client, admin[0], "How long do I have to submit expenses?")
    assert msg["engine"] == "extractive-fallback" and "30 days" in msg["content"]


def test_restricted_text_never_reaches_the_prompt(client, admin, member, samples, fake_llm):
    fake = fake_llm("Nothing relevant [1].")
    ask(client, member[0], "What severance and sabbatical do executives get under change of control?")
    assert all("golden parachute" not in p and "$40M" not in p for p in fake.prompts)


def test_retired_model_falls_back_to_newest_flash(monkeypatch):
    from app.services import llm as llm_module

    class NotFound(Exception):
        code = 404

    class FakeModels:
        def __init__(self):
            self.calls = []

        def generate_content(self, model, contents, config):
            self.calls.append(model)
            if model == "gemini-2.5-flash":
                raise NotFound("404 NOT_FOUND. This model models/gemini-2.5-flash is no longer available to new users.")
            return type("R", (), {"text": "ok"})()

        def list(self):
            names = ["models/gemini-3.6-flash", "models/gemini-3.8-flash", "models/gemini-3.5-flash-lite",
                     "models/gemini-4-argon", "models/gemini-3-flash-preview", "models/gemini-embedding-001"]
            return [type("M", (), {"name": n, "supported_actions": ["generateContent"]})() for n in names]

    fake = type("C", (), {"models": FakeModels()})()
    client = type("Client", (), {"mode": "developer", "call": staticmethod(lambda fn: fn(fake))})()
    model = llm_module.GeminiLLM.__new__(llm_module.GeminiLLM)
    model._client, model.model, model.last_model, model._use_thinking_config, model._busy_until = client, "gemini-2.5-flash", "", True, 0.0

    assert model.generate("hi", "sys") == "ok"
    assert model.model == "gemini-3.8-flash"
    assert fake.models.calls == ["gemini-2.5-flash", "gemini-3.8-flash"]


def test_overloaded_model_retries_then_uses_another_flash(monkeypatch):
    from app.services import llm as llm_module

    monkeypatch.setattr(llm_module.time, "sleep", lambda s: None)

    class Busy(Exception):
        code = 503

    class FakeModels:
        def __init__(self):
            self.calls = []

        def generate_content(self, model, contents, config):
            self.calls.append(model)
            if model == "gemini-3.8-flash":
                raise Busy("503 UNAVAILABLE. This model is currently experiencing high demand.")
            return type("R", (), {"text": "answer"})()

        def list(self):
            names = ["models/gemini-3.8-flash", "models/gemini-3.6-flash", "models/gemini-3.5-flash-lite"]
            return [type("M", (), {"name": n, "supported_actions": ["generateContent"]})() for n in names]

    fake = type("C", (), {"models": FakeModels()})()
    client = type("Client", (), {"mode": "developer", "call": staticmethod(lambda fn: fn(fake))})()
    model = llm_module.GeminiLLM.__new__(llm_module.GeminiLLM)
    model._client, model.model, model.last_model, model._use_thinking_config, model._busy_until = client, "gemini-3.8-flash", "", True, 0.0

    assert model.generate("hi", "sys") == "answer"
    # two attempts on the busy model (one retry), then a Lite model (different capacity)
    assert fake.models.calls == ["gemini-3.8-flash"] * 2 + ["gemini-3.5-flash-lite"]
    assert model.model == "gemini-3.8-flash"  # overload is temporary: keep the configured model
    assert model.last_model == "gemini-3.5-flash-lite"
    # the next question goes straight to the model that worked
    fake.models.calls.clear()
    assert model.generate("again", "sys") == "answer"
    assert fake.models.calls == ["gemini-3.5-flash-lite"]


def test_thinking_config_matches_model_family():
    from app.services.llm import GeminiLLM

    m = GeminiLLM.__new__(GeminiLLM)
    m._use_thinking_config = True
    assert m._config("gemini-2.5-flash", "s", 0.1, 10).thinking_config.thinking_budget == 0
    assert m._config("gemini-3.8-flash", "s", 0.1, 10).thinking_config.thinking_level is not None


def test_generation_respects_the_time_budget(monkeypatch):
    """When every model is overloaded, give up within the budget so the request
    falls back to the offline answer instead of hanging the proxy."""
    from app.services import llm as llm_module

    clock = {"t": 0.0}
    monkeypatch.setattr(llm_module.time, "monotonic", lambda: clock["t"])
    monkeypatch.setattr(llm_module.time, "sleep", lambda s: clock.__setitem__("t", clock["t"] + s))

    class Busy(Exception):
        code = 503

    class FakeModels:
        def __init__(self):
            self.calls = 0

        def generate_content(self, model, contents, config):
            self.calls += 1
            clock["t"] += 20  # each call takes the full HTTP timeout
            raise Busy("503 UNAVAILABLE")

        def list(self):
            names = ["models/gemini-3.8-flash", "models/gemini-3.6-flash", "models/gemini-3.5-flash-lite"]
            return [type("M", (), {"name": n, "supported_actions": ["generateContent"]})() for n in names]

    fake = type("C", (), {"models": FakeModels()})()
    client = type("Client", (), {"mode": "developer", "call": staticmethod(lambda fn: fn(fake))})()
    model = llm_module.GeminiLLM.__new__(llm_module.GeminiLLM)
    model._client, model.model, model.last_model, model._use_thinking_config, model._busy_until = client, "gemini-3.8-flash", "", True, 0.0

    with pytest.raises(LLMError):
        model.generate("hi", "sys", budget=45)
    assert clock["t"] <= 45 + 20  # at most one call may start just before the deadline
