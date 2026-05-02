import logging
from fastapi import APIRouter, Depends, HTTPException

from ..schemas.chat_schemas import ChatRequest, ChatResponse
from ..services.chat_service import run_chat
from ..services.gemini_client import GeminiError
from ..core.auth import verify_internal_secret

router = APIRouter()
logger = logging.getLogger("ic.routes.chat")


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_internal_secret)])
async def chat(req: ChatRequest):
    try:
        return await run_chat(req)
    except GeminiError as e:
        raise HTTPException(status_code=e.status, detail={"error": str(e), "code": e.code})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in chat")
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "INTERNAL_ERROR"})
