"""Grounded question answering with verified citations.

Pipeline:
  1. Resolve follow-up questions into a standalone retrieval query.
  2. Retrieve permitted chunks (hybrid BM25 + vectors).
  3. Relevance gate: abstain unless some chunk covers enough of the question.
  4. Answer with Gemini (if configured) or the offline extractive engine.
  5. Validate citations against the retrieved chunks, renumber them, and
     attach the exact supporting quote for each source.
"""
import logging
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import DocumentChunk, User
from app.services.llm import LLMError, llm
from app.services.prompts import (
    ANSWER_SYSTEM_PROMPT,
    NO_ANSWER_TOKEN,
    REWRITE_SYSTEM_PROMPT,
    answer_prompt,
    rewrite_prompt,
)
from app.services.retrieval import Hit, QueryTerms, Retriever, chunk_cache
from app.services.text import is_heading, split_sentences, tokenize

logger = logging.getLogger(__name__)

ABSTAIN_MESSAGE = (
    "I couldn't find enough evidence in the documents you can access to answer this. "
    "Try rephrasing, or check that the relevant document has been uploaded and shared with you."
)
GEMINI_MIN_SIMILARITY = 0.62
_FOLLOW_UP_RE = re.compile(
    r"^(and|also|what about|how about|same for|why)\b|\b(it|its|that|this|they|them|those|these|he|she|his|her|there)\b",
    re.IGNORECASE,
)
_MULTI_SOURCE_RE = re.compile(r"\b(compare|comparison|versus|vs\.?|both|across|between|differ\w*)\b|\b\w+ and \w+", re.IGNORECASE)
_CITE_GROUP_RE = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")
_CITE_RE = re.compile(r"\[(\d+)\]")


@dataclass
class AnswerResult:
    text: str
    citations: List[Dict] = field(default_factory=list)
    abstained: bool = False
    confidence: float = 0.0
    engine: str = "extractive"
    retrieval_query: str = ""
    retrieved: List[Hit] = field(default_factory=list)


class AnswerService:
    def __init__(self, db: Session):
        self.retriever = Retriever(db)

    # ------------------------------------------------------------------ public
    def answer(self, question: str, user: User, history: Optional[List[Tuple[str, str]]] = None) -> AnswerResult:
        history = history or []
        query = self._standalone_query(question, history)
        hits, qt, _ = self.retriever.search(query, user, mode="hybrid", limit=settings.RETRIEVAL_TOP_K)
        scoring_terms = qt
        if query != question:
            # Follow-up: a chunk may be relevant to the new question alone, and the
            # new question's own words should drive which sentences get quoted.
            own = self.retriever.query_terms(question)
            for h in hits:
                h.coverage = max(h.coverage, own.coverage(h.chunk.terms))
            if own.weights and any(own.coverage(h.chunk.terms) > 0 for h in hits):
                scoring_terms = own
        relevant = [h for h in hits if self._is_relevant(h)]
        multi_source = bool(_MULTI_SOURCE_RE.search(question))
        if multi_source:
            # "Compare A and B": chunks from different documents may each cover part of it.
            for h in _complementary_hits(hits, scoring_terms):
                if h not in relevant:
                    relevant.append(h)
        if not relevant:
            return AnswerResult(ABSTAIN_MESSAGE, abstained=True, retrieval_query=query, retrieved=hits)

        result: Optional[AnswerResult] = None
        if llm is not None:
            try:
                # The gate decides *whether* to answer; the model gets all related context.
                context = relevant + [
                    h for h in hits if h not in relevant and (h.coverage >= 0.2 or h.vector_score >= 0.5)
                ]
                result = self._answer_with_llm(question, context[: settings.RETRIEVAL_TOP_K], history)
            except LLMError as exc:
                logger.warning("%s — falling back to extractive answer.", exc)
        if result is None:
            result = self._answer_offline(question, relevant, scoring_terms, multi_source)
        result.retrieval_query = query
        result.retrieved = hits
        return result

    # ----------------------------------------------------------------- helpers
    @staticmethod
    def _is_relevant(h: Hit) -> bool:
        if h.coverage >= settings.MIN_QUERY_COVERAGE:
            return True
        model = h.chunk.embedding_model or ""
        return model.startswith("gemini") and h.vector_score >= GEMINI_MIN_SIMILARITY

    def _standalone_query(self, question: str, history: List[Tuple[str, str]]) -> str:
        if not history:
            return question
        if llm is not None:
            try:
                rewritten = llm.generate(rewrite_prompt(question, history[-6:]), REWRITE_SYSTEM_PROMPT, 0.0, 256, budget=12)
                return rewritten.strip().strip('"') or question
            except LLMError as exc:
                logger.info("Query rewrite failed, using heuristic: %s", exc)
        last_user = next((text for role, text in reversed(history) if role == "user"), None)
        if last_user and (_FOLLOW_UP_RE.search(question) or len(tokenize(question)) <= 2):
            return f"{last_user} {question}"
        return question

    @staticmethod
    def _citation(number: int, h: Hit, quote: Optional[str]) -> Dict:
        return {
            "number": number,
            "chunk_id": h.chunk_id,
            "document_id": h.document_id,
            "document_title": h.document_title,
            "page_number": h.chunk.page_number,
            "section_title": h.chunk.section_title,
            "passage": h.chunk.content,
            "quote": quote,
        }

    # ------------------------------------------------------------ extractive
    def _answer_extractively(self, hits: Sequence[Hit], qt: QueryTerms, multi_source: bool = False) -> AnswerResult:
        scored: List[Tuple[float, int, int, str]] = []  # (score, hit rank, sentence pos, sentence)
        for rank, h in enumerate(hits[:4]):
            for pos, sent in enumerate(split_sentences(h.chunk.content)):
                if is_heading(sent) or len(sent.split()) < 4:
                    continue
                s = qt.coverage(tokenize(sent))
                if s > 0:
                    scored.append((s - 0.02 * rank, rank, pos, sent))

        picked: Dict[int, List[Tuple[int, str]]] = {}
        if scored:
            scored.sort(key=lambda x: (-x[0], x[1], x[2]))
            best = scored[0][0]
            multi_doc = multi_source and len({h.document_id for h in hits}) > 1
            # Multi-document answers compare each document against its own best sentence.
            doc_best: Dict[str, float] = {}
            for score, rank, _, _ in scored:
                doc_best.setdefault(hits[rank].document_id, score)
            for score, rank, pos, sent in scored:
                ref = doc_best[hits[rank].document_id] if multi_doc else best
                if score < max(0.6 * ref, 0.15 if multi_doc else 0.25):
                    continue
                if sum(len(v) for v in picked.values()) >= (5 if multi_doc else 4):
                    break
                if rank not in picked and len(picked) >= 3:
                    continue
                if len(picked.get(rank, [])) < 2:
                    picked.setdefault(rank, []).append((pos, sent))
        if multi_source:
            # Documents matched only by title still contribute their opening lines.
            for rank, h in enumerate(hits[:3]):
                if rank not in picked and all(hits[r].document_id != h.document_id for r in picked):
                    body = [s for s in split_sentences(h.chunk.content) if not is_heading(s)]
                    if body:
                        picked[rank] = list(enumerate(body[:2]))
        if not picked:
            # Matched only via title/section heading: summarise the top section.
            body = [s for s in split_sentences(hits[0].chunk.content) if not is_heading(s)]
            if body:
                picked[0] = list(enumerate(body[:2]))
        if not picked:
            return AnswerResult(ABSTAIN_MESSAGE, abstained=True)

        paragraphs, citations = [], []
        for number, rank in enumerate(picked, start=1):  # dict keeps best-first order
            sentences = [s for _, s in sorted(picked[rank])]
            quote = " ".join(sentences)
            paragraphs.append(f"{quote} [{number}]")
            citations.append(self._citation(number, hits[rank], quote))
        confidence = max(hits[r].coverage for r in picked)
        return AnswerResult("\n\n".join(paragraphs), citations, False, round(min(confidence, 1.0), 2), "extractive")

    def _answer_offline(self, question: str, hits: List[Hit], qt: QueryTerms, multi_source: bool) -> AnswerResult:
        top = hits[0]
        # Terms naming the document itself (e.g. a person's name on their resume,
        # "travel" for the Travel Policy) identify the subject, not what's asked.
        subject = set(tokenize(top.document_title))
        content = QueryTerms({t: w for t, w in qt.weights.items() if t not in subject})
        if qt.weights and not content.weights:
            return self._summarise(self._document_opening(top))
        section = _matching_section(hits, content)
        if section is not None:
            return self._section_answer(section)
        return self._answer_extractively(hits, qt, multi_source)

    def _document_opening(self, top: Hit, sections: int = 4) -> List[Hit]:
        """The first chunks of a document, in reading order."""
        rows = self.retriever.db.execute(
            select(DocumentChunk.id, DocumentChunk.embedding_model)
            .where(DocumentChunk.document_id == top.document_id)
            .order_by(DocumentChunk.chunk_index)
            .limit(sections)
        ).all()
        chunks = chunk_cache.get_many(self.retriever.db, [(cid, model) for cid, model in rows])
        return [
            Hit(chunk=chunks[cid], document_title=top.document_title, access_level=top.access_level, coverage=top.coverage)
            for cid, _ in rows
            if cid in chunks
        ] or [top]

    def _section_answer(self, h: Hit) -> AnswerResult:
        """Return a whole list-like section (skills, projects, steps...) as a list."""
        lines = [ln.strip() for ln in h.chunk.content.splitlines() if ln.strip()][:16]
        blocks: List[str] = []
        para: List[str] = []
        for ln in lines:
            if ln.startswith(("• ", "- ", "* ")):
                if para:
                    blocks.append("  \n".join(para))
                    para = []
                blocks.append("- " + ln[2:].strip())
            else:
                para.append(_escape_md(ln))
        if para:
            blocks.append("  \n".join(para))
        # Keep list items together, paragraphs apart.
        out = ""
        for i, b in enumerate(blocks):
            sep = "" if i == 0 else ("\n" if b.startswith("- ") and blocks[i - 1].startswith("- ") else "\n\n")
            out += sep + b
        title = _display_heading(h.chunk.section_title)
        text = f"**{title}**\n\n{out} [1]" if title else f"{out} [1]"
        return AnswerResult(text, [self._citation(1, h, h.chunk.content)], False, round(min(h.coverage, 1.0), 2), "extractive")

    def _summarise(self, hits: Sequence[Hit]) -> AnswerResult:
        """Overview of the best-matching document: the opening of each section."""
        top_doc = hits[0].document_id
        sections = sorted((h for h in hits if h.document_id == top_doc), key=lambda h: h.chunk.chunk_index)[:4]
        paragraphs, citations = [], []
        for h in sections:
            body = [_escape_md(s) for s in split_sentences(h.chunk.content) if not is_heading(s)][:2]
            if not body:
                continue
            quote = " ".join(body)
            title = _display_heading(h.chunk.section_title)
            label = f"**{title}:** " if title else ""
            paragraphs.append(f"{label}{quote} [{len(citations) + 1}]")
            citations.append(self._citation(len(citations) + 1, h, quote))
        if not citations:
            return AnswerResult(ABSTAIN_MESSAGE, abstained=True)
        return AnswerResult("\n\n".join(paragraphs), citations, False, round(min(hits[0].coverage, 1.0), 2), "extractive")

    # ------------------------------------------------------------------- LLM
    def _answer_with_llm(self, question: str, hits: Sequence[Hit], history: List[Tuple[str, str]]) -> AnswerResult:
        raw = llm.generate(answer_prompt(question, hits, history[-6:]), ANSWER_SYSTEM_PROMPT)
        text = re.sub(r"\n+\**sources?:?\**[\s\S]*$", "", raw, flags=re.IGNORECASE).strip()
        if NO_ANSWER_TOKEN in text:
            text = text.replace(NO_ANSWER_TOKEN, "").strip()
            if len(text) < 40:
                return AnswerResult(ABSTAIN_MESSAGE, abstained=True, engine="gemini")

        # Normalise "[1, 2]" -> "[1][2]", then drop citations to sources that don't exist.
        text = _CITE_GROUP_RE.sub(lambda m: "".join(f"[{n.strip()}]" for n in m.group(1).split(",")), text)
        valid = set(range(1, len(hits) + 1))
        text = _CITE_RE.sub(lambda m: m.group(0) if int(m.group(1)) in valid else "", text)

        order: List[int] = []
        for m in _CITE_RE.finditer(text):
            n = int(m.group(1))
            if n not in order:
                order.append(n)
        if not order:
            # A non-abstaining answer with no verifiable citation is treated as unsupported.
            return AnswerResult(ABSTAIN_MESSAGE, abstained=True, engine="gemini")

        renumber = {old: new for new, old in enumerate(order, start=1)}
        text = _CITE_RE.sub(lambda m: f"[{renumber[int(m.group(1))]}]", text)
        text = re.sub(r"(\[\d+\])(?:\1)+", r"\1", text)

        citations = []
        for old in order:
            h = hits[old - 1]
            claims = [s for s in split_sentences(text) if f"[{renumber[old]}]" in s]
            citations.append(self._citation(renumber[old], h, _best_supporting_sentence(h, claims)))
        confidence = max(max(hits[o - 1].coverage, hits[o - 1].vector_score) for o in order)
        return AnswerResult(text, citations, False, round(min(confidence, 1.0), 2), "gemini")


def _display_heading(title: Optional[str]) -> Optional[str]:
    if not title:
        return None
    return title.title() if title.isupper() else title


def _escape_md(line: str) -> str:
    """Stop source text like "#123", "1." or "> x" at line start being read as Markdown."""
    line = re.sub(r"^(\d+)\.(\s)", r"\1\\.\2", line)
    return re.sub(r"^([#>+])", r"\\\1", line)


def _matching_section(hits: Sequence[Hit], content: QueryTerms) -> Optional[Hit]:
    """A list-like section whose heading is what the question asks for
    ("what are his projects" -> PROJECTS)."""
    if not content.weights:
        return None
    best, best_cov = None, 0.0
    for h in hits:
        if not h.chunk.section_title:
            continue
        lines = [ln for ln in h.chunk.content.splitlines() if ln.strip()]
        if len(lines) < 3:  # prose paragraphs are answered sentence by sentence
            continue
        cov = content.coverage(tokenize(h.chunk.section_title))
        if cov > best_cov:
            best, best_cov = h, cov
    return best if best_cov >= 0.6 else None


def _complementary_hits(hits: Sequence[Hit], qt: QueryTerms) -> List[Hit]:
    """For questions spanning documents: accept the best pair of chunks from
    different documents whose *combined* terms cover the question, as long as
    each contributes meaningfully on its own."""
    best_pair, best_cov = None, 0.0
    for i, a in enumerate(hits):
        for b in hits[i + 1 :]:
            if a.document_id == b.document_id or min(a.coverage, b.coverage) < 0.25:
                continue
            cov = qt.coverage(set(a.chunk.terms) | set(b.chunk.terms))
            if cov > best_cov:
                best_pair, best_cov = (a, b), cov
    if best_pair and best_cov >= settings.MIN_QUERY_COVERAGE:
        return list(best_pair)
    return []


def _best_supporting_sentence(h: Hit, claims: List[str]) -> Optional[str]:
    claim_terms = set(tokenize(" ".join(claims)))
    best, best_overlap = None, 0
    for sent in split_sentences(h.chunk.content):
        overlap = len(claim_terms & set(tokenize(sent)))
        if overlap > best_overlap:
            best, best_overlap = sent, overlap
    return best
