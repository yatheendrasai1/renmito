import logging
from fastapi import APIRouter, Depends, HTTPException

from ..schemas.food_insight_schemas import FoodInsightRequest, FoodInsightResponse
from ..services.food_insight_service import run_food_insight
from ..services.gemini_client import GeminiError
from ..core.auth import verify_internal_secret

router = APIRouter()
logger = logging.getLogger("ic.routes.food_insight")


@router.post("/food-insight", response_model=FoodInsightResponse, dependencies=[Depends(verify_internal_secret)])
async def food_insight(req: FoodInsightRequest):
    try:
        return await run_food_insight(req)
    except GeminiError as e:
        raise HTTPException(status_code=e.status, detail={"error": str(e), "code": e.code})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Unexpected error in food_insight")
        raise HTTPException(status_code=500, detail={"error": str(e), "code": "INTERNAL_ERROR"})
