from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_member
from app.models.entities import Conversation, Message, User
from app.schemas.chat import ChatRequest, ChatResponse, ConversationResponse, MessageResponse
from app.services.generation.rag_service import RAGService

router = APIRouter()
conversations_router = APIRouter()

@router.post("", response_model=ChatResponse)
def chat_with_knowledge_base(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    Asks a question grounded in accessible enterprise knowledge.
    Returns generated answer with verified citations and source passages.
    """
    rag = RAGService(db)
    conv, message = rag.answer_query(
        query=payload.message,
        user=current_user,
        conversation_id=payload.conversation_id,
        collection_id=payload.collection_id
    )

    return ChatResponse(
        conversation_id=conv.id,
        message=MessageResponse.model_validate(message)
    )

@conversations_router.get("", response_model=List[ConversationResponse])
@router.get("/conversations", response_model=List[ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    """
    List conversations owned by the authenticated user.
    """
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(Conversation.updated_at.desc()).all()
    return conversations

@conversations_router.get("/{conversation_id}", response_model=ConversationResponse)
@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    return conv

@conversations_router.delete("/{conversation_id}")
@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_member)
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()

    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"success": True, "message": "Conversation deleted."}
