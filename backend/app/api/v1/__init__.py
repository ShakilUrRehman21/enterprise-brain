from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.documents import router as documents_router
from app.api.v1.search import router as search_router
from app.api.v1.chat import router as chat_router, conversations_router
from app.api.v1.evaluation import router as evaluation_router
from app.api.v1.demo import router as demo_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
router.include_router(documents_router, prefix="/documents", tags=["Documents"])
router.include_router(search_router, prefix="/search", tags=["Search"])
router.include_router(chat_router, prefix="/chat", tags=["Chat"])
router.include_router(conversations_router, prefix="/conversations", tags=["Conversations"])
router.include_router(evaluation_router, prefix="/evaluation", tags=["Evaluation"])
router.include_router(demo_router, prefix="/demo", tags=["Demonstration"])
