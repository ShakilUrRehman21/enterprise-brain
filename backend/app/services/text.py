"""Shared text processing: tokenization, light stemming, sentence splitting."""
import re
from typing import List

STOP_WORDS = frozenset(
    """
    a about above after again against all am an and any are as at be because been before being below
    between both but by can could did do does doing down during each few for from further had has have
    having he her here hers herself him himself his how i if in into is it its itself just me more most
    my myself no nor not now of off on once only or other our ours ourselves out over own same she should
    so some such than that the their theirs them themselves then there these they this those through to
    too under until up very was we were what when where which while who whom why will with would you your
    yours yourself yourselves tell please give show explain describe know want need get got let us also
    may might must shall many much does doesn don isn aren wasn weren hasn haven hadn won wouldn shouldn
    company company's our employee employees policy policies document documents
    """.split()
)

# Words describing the *kind* of answer wanted rather than its subject.
META_WORDS = frozenset(
    """
    rule rules requirement requirements guideline guidelines procedure procedures process details detail
    info information summary summarize summarise overview outline compare comparison contrast difference
    differences between across apply applies applicable regarding according mentioned say says said
    key main points everything anything something thing things allowed
    """.split()
)

# Words that carry the question's intent but rarely appear verbatim in answers.
QUESTION_WORDS = frozenset({"how", "what", "which", "when", "where", "who", "why", "whose", "long", "often"})

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:[&'.][a-z0-9]+)*")


def stem(word: str) -> str:
    """A small, predictable suffix stripper (good enough for policy text).

    Applied identically to queries and documents, so it only needs to be
    consistent, not linguistically perfect.
    """
    if len(word) <= 3 or word.isdigit():
        return word
    # Two passes so stacked suffixes reduce consistently (annually -> annual -> annu).
    return _strip_suffix(_strip_suffix(word))


def _strip_suffix(w: str) -> str:
    for suffix, repl in (
        ("ational", "ate"),
        ("ization", "ize"),
        ("fulness", "ful"),
        ("ousness", "ous"),
        ("iveness", "ive"),
        ("ements", "e"),
        ("ement", "e"),
        ("ments", ""),
        ("ment", ""),
        ("ities", "ity"),
        ("ingly", ""),
        ("ings", ""),
        ("ing", ""),
        ("edly", ""),
        ("ied", "y"),
        ("ies", "y"),
        ("sses", "ss"),
        ("ed", ""),
        ("ly", ""),
        ("ial", ""),
        ("al", ""),
        ("es", ""),
        ("s", ""),
    ):
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            w = w[: len(w) - len(suffix)] + repl
            break
    if w.endswith("e") and len(w) > 4:
        w = w[:-1]
    if len(w) > 4 and w[-1] == w[-2] and w[-1] in "bdglmnprt":
        w = w[:-1]  # travell -> travel, submitt -> submit
    return w


def raw_tokens(text: str) -> List[str]:
    return [t.strip(".'") for t in _TOKEN_RE.findall(text.lower()) if t.strip(".'")]


def tokenize(text: str, drop_stop_words: bool = True) -> List[str]:
    out: List[str] = []
    for tok in raw_tokens(text):
        if drop_stop_words and (tok in STOP_WORDS or tok in QUESTION_WORDS or tok in META_WORDS):
            continue
        if len(tok) == 1 and not tok.isdigit():
            continue
        out.append(stem(tok))
    return out


_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[\"'(\[]?[A-Z0-9$])")


def split_sentences(text: str) -> List[str]:
    """Split text into sentences, also treating list items/lines as boundaries."""
    sentences: List[str] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^([-*•▪●◦‣∙]|\d+[.)])\s+", "", line)
        for part in _SENTENCE_RE.split(line):
            part = part.strip()
            if part:
                sentences.append(part)
    return sentences


def is_heading(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 80:
        return False
    if s.startswith("#"):
        # Markdown headings need a space after the hashes ("#52532" is not one).
        return bool(re.match(r"^#{1,6}\s+\w", s))
    if s.endswith((".", ",", ";")):
        return False
    letters = [c for c in s if c.isalpha()]
    return bool(letters) and len(s.split()) <= 10 and all(c.isupper() for c in letters)
