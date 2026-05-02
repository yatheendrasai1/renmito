import logging
from fastapi import APIRouter, Depends, HTTPException

from ..schemas.parse_schemas import ParseRequest
from ..schemas.common import ParsedLogItem
from ..services.parse_service import run_parse
from ..services.gemini_client import GeminiError
from ..core.auth import verify_internal_secret

router = APIRouter()
logger = logging.getLogger("ic.routes.parse")


@router.post("/parse-log", response_model=list[ParsedLogItem], dependencies=[Depends(verify_internal_secret)])
async def parse_log(req: ParseRequest):
    try:
        return await run_parse(req)
    except GeminiError as e:
        raise HTTPException(status_code=e.status, detail={"error": str(e), "code": e.code})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in parse_log")
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "INTERNAL_ERROR"})
