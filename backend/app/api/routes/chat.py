from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Conversation, Message, User, utcnow
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationOut,
    ConversationSummary,
    MessageOut,
    SearchHit,
    SearchRequest,
    SearchResponse,
)
from app.services.answering import AnswerService
from app.services.retrieval import Retriever

router = APIRouter(tags=["chat"])

HISTORY_MESSAGES = 6


def _title_from(question: str) -> str:
    q = " ".join(question.split())
    return q if len(q) <= 60 else q[:57].rstrip() + "…"


def _own_conversation(db: Session, user: User, conversation_id: str) -> Conversation:
    conv = db.get(Conversation, conversation_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    return conv


@router.post("/chat", response_model=ChatResponse)
def ask(body: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    question = body.message.strip()
    if not question:
        raise HTTPException(422, "Type a question first.")

    if body.conversation_id:
        conv = _own_conversation(db, user, body.conversation_id)
        history = [(m.role, m.content) for m in conv.messages[-HISTORY_MESSAGES:]]
    else:
        conv = Conversation(user_id=user.id, title=_title_from(question))
        db.add(conv)
        db.flush()
        history = []

    result = AnswerService(db).answer(question, user, history)

    user_msg = Message(conversation_id=conv.id, role="user", content=question)
    db.add(user_msg)
    db.flush()
    reply = Message(
        conversation_id=conv.id,
        role="assistant",
        content=result.text,
        citations=result.citations,
        abstained=result.abstained,
        confidence=result.confidence,
        engine=result.engine,
    )
    db.add(reply)
    conv.updated_at = utcnow()
    db.commit()
    return ChatResponse(
        conversation=ConversationSummary.model_validate(conv),
        user_message=MessageOut.model_validate(user_msg),
        message=MessageOut.model_validate(reply),
    )


@router.get("/conversations", response_model=List[ConversationSummary])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).limit(100)
    ).all()


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _own_conversation(db, user, conversation_id)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(conversation_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_conversation(db, user, conversation_id))
    db.commit()


@router.post("/search", response_model=SearchResponse)
def search(body: SearchRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    hits, _, vector_available = Retriever(db).search(body.query, user, mode=body.mode, limit=body.limit)
    return SearchResponse(
        query=body.query,
        mode=body.mode,
        vector_available=vector_available,
        results=[
            SearchHit(
                chunk_id=h.chunk_id,
                document_id=h.document_id,
                document_title=h.document_title,
                page_number=h.chunk.page_number,
                section_title=h.chunk.section_title,
                content=h.chunk.content,
                score=round(h.score, 5),
                vector_score=round(h.vector_score, 4),
                keyword_score=round(h.keyword_score, 4),
                access_level=h.access_level,
            )
            for h in hits
        ],
    )
