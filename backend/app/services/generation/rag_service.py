import os
import re
import logging
from typing import List, Optional, Tuple, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.entities import Conversation, Message, User
from app.schemas.chat import CitationItem, MessageResponse
from app.services.retrieval.searcher import HybridSearchEngine
from app.services.generation.prompts import SYSTEM_PROMPT, format_rag_prompt

logger = logging.getLogger(__name__)

ABSTAIN_PHRASE = "I couldn't find sufficient evidence in the accessible documents to answer this question confidently."

class RAGService:
    def __init__(self, db: Session):
        self.db = db
        self.search_engine = HybridSearchEngine(db)
        self.api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        self.model_name = settings.GEMINI_GENERATION_MODEL
        self.client = None

        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning(f"Could not initialize Google GenAI Client: {e}")

    def answer_query(
        self,
        query: str,
        user: User,
        conversation_id: Optional[str] = None,
        collection_id: Optional[str] = None
    ) -> Tuple[Conversation, Message]:
        # 1. Manage Conversation
        conv = None
        if conversation_id:
            conv = self.db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user.id
            ).first()

        if not conv:
            # Create new conversation
            title = query[:40] + ("..." if len(query) > 40 else "")
            conv = Conversation(user_id=user.id, title=title)
            self.db.add(conv)
            self.db.commit()
            self.db.refresh(conv)

        # 2. Save User Message
        user_msg = Message(
            conversation_id=conv.id,
            role="user",
            content=query
        )
        self.db.add(user_msg)
        self.db.commit()

        # 3. Retrieve Evidence
        evidence_chunks = self.search_engine.search(
            query=query,
            user=user,
            mode="hybrid",
            limit=5,
            collection_id=collection_id
        )

        # 4. Check for Empty Evidence -> Direct Abstention
        if not evidence_chunks:
            assistant_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=ABSTAIN_PHRASE,
                citations=[],
                confidence_score=0.0,
                abstained=True
            )
            self.db.add(assistant_msg)
            self.db.commit()
            self.db.refresh(assistant_msg)
            return conv, assistant_msg

        # 5. Generate Grounded Response with LLM
        answer_text, citations, abstained, confidence = self._generate_answer(query, evidence_chunks)

        # 6. Save Assistant Message
        assistant_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=answer_text,
            citations=[c.model_dump() for c in citations],
            confidence_score=confidence,
            abstained=abstained
        )
        self.db.add(assistant_msg)
        self.db.commit()
        self.db.refresh(assistant_msg)

        return conv, assistant_msg

    def _generate_answer(
        self,
        query: str,
        evidence_chunks: list
    ) -> Tuple[str, List[CitationItem], bool, float]:
        """
        Generates grounded response using Gemini API or deterministic synthesis.
        """
        # Chunk map for quick lookup and citation validation
        chunk_map = {idx: c for idx, c in enumerate(evidence_chunks, start=1)}
        chunk_id_map = {c.chunk_id: (idx, c) for idx, c in enumerate(evidence_chunks, start=1)}

        answer_text = ""
        abstained = False
        confidence = 0.95

        # Try Google Gemini API
        if self.client and self.api_key:
            try:
                from google.genai import types
                prompt_content = format_rag_prompt(query, evidence_chunks)
                config = types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                    top_p=0.8
                )
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt_content,
                    config=config
                )
                if response and response.text:
                    answer_text = response.text.strip()
            except Exception as e:
                logger.error(f"Gemini generation error: {e}. Falling back to deterministic synthesis.")

        # Fallback Grounded Synthesizer
        deterministic_chunk = None
        if not answer_text:
            answer_text, deterministic_chunk, abstained = self._deterministic_grounded_answer(query, evidence_chunks)

        # Check if the LLM abstained
        if ABSTAIN_PHRASE.lower() in answer_text.lower() or abstained:
            return ABSTAIN_PHRASE, [], True, 0.0

        # Validate and build citations
        valid_citations: List[CitationItem] = []
        if deterministic_chunk:
            c_idx = next((i for i, c in enumerate(evidence_chunks, start=1) if c.chunk_id == deterministic_chunk.chunk_id), 1)
            valid_citations.append(
                CitationItem(
                    citation_number=c_idx,
                    document_id=deterministic_chunk.document_id,
                    document_title=deterministic_chunk.document_title,
                    page_number=deterministic_chunk.page_number,
                    section_title=deterministic_chunk.section_title,
                    chunk_id=deterministic_chunk.chunk_id,
                    exact_passage=deterministic_chunk.content[:240].strip() + ("..." if len(deterministic_chunk.content) > 240 else "")
                )
            )
        else:
            # Find all cited indices [1], [2], etc. in the text
            cited_indices = sorted(list(set(int(m) for m in re.findall(r"\[(\d+)\]", answer_text))))

            for idx in cited_indices:
                if idx in chunk_map:
                    c = chunk_map[idx]
                    passage = c.content[:240].strip() + ("..." if len(c.content) > 240 else "")
                    valid_citations.append(
                        CitationItem(
                            citation_number=idx,
                            document_id=c.document_id,
                            document_title=c.document_title,
                            page_number=c.page_number,
                            section_title=c.section_title,
                            chunk_id=c.chunk_id,
                            exact_passage=passage
                        )
                    )

        # If model generated claims but attached no citations, cite top retrieved hit
        if not valid_citations and evidence_chunks and not abstained:
            top_c = evidence_chunks[0]
            answer_text += " [1]"
            valid_citations.append(
                CitationItem(
                    citation_number=1,
                    document_id=top_c.document_id,
                    document_title=top_c.document_title,
                    page_number=top_c.page_number,
                    section_title=top_c.section_title,
                    chunk_id=top_c.chunk_id,
                    exact_passage=top_c.content[:240]
                )
            )

        return answer_text, valid_citations, abstained, confidence

    def _deterministic_grounded_answer(self, query: str, evidence_chunks: list) -> Tuple[str, Any, bool]:
        """
        Deterministic synthesis when Gemini API key is absent or in test environments.
        Guarantees strict factual extraction, page references, and abstention rules.
        """
        from app.services.retrieval.searcher import STOP_WORDS

        def word_match(qw: str, cw: str) -> bool:
            if qw == cw:
                return True
            q_stem = qw.rstrip('es')
            c_stem = cw.rstrip('es')
            if len(q_stem) >= 4 and len(c_stem) >= 4 and q_stem == c_stem:
                return True
            if len(qw) >= 5 and qw in cw:
                return True
            if len(cw) >= 5 and cw in qw:
                return True
            return False

        raw_query_words = [w.lower() for w in re.findall(r"\b\w+\b", query) if len(w) >= 2 and w.lower() not in STOP_WORDS]
        if not raw_query_words:
            return ABSTAIN_PHRASE, None, True

        best_chunk = None
        best_matches = []
        best_ratio = 0.0

        for chunk in evidence_chunks:
            full_chunk_text = f"{chunk.document_title} {chunk.section_title or ''} {chunk.content}"
            chunk_words = [w.lower() for w in re.findall(r"\b\w+\b", full_chunk_text) if len(w) >= 2]
            matches = [qw for qw in raw_query_words if any(word_match(qw, cw) for cw in chunk_words)]
            ratio = len(matches) / len(raw_query_words)
            if ratio > best_ratio:
                best_ratio = ratio
                best_chunk = chunk
                best_matches = matches

        # Abstain if no meaningful matches or ratio < 0.6
        if not best_chunk or best_ratio < 0.6:
            return ABSTAIN_PHRASE, None, True

        # Synthesize from relevant sentences
        sentences = [s.strip() for s in re.split(r"[.\n]", best_chunk.content) if len(s.strip()) > 15]
        relevant_sentences = []
        for s in sentences:
            if any(w in s.lower() for w in best_matches):
                relevant_sentences.append(s)

        if not relevant_sentences:
            relevant_sentences = sentences[:2]

        answer = ". ".join(relevant_sentences)
        if not answer.endswith("."):
            answer += "."

        c_idx = next((i for i, c in enumerate(evidence_chunks, start=1) if c.chunk_id == best_chunk.chunk_id), 1)
        page_str = f"Page {best_chunk.page_number}" if best_chunk.page_number else "Page 1"
        answer += f" [{c_idx}]\n\n**Sources:**\n[{c_idx}] {best_chunk.document_title} — {page_str}"
        return answer, best_chunk, False
