import logging
import time

from ..schemas.food_insight_schemas import FoodInsightRequest, FoodInsightResponse
from .gemini_client import call_gemini, GeminiError  # noqa: F401

logger = logging.getLogger("ic.food_insight")


async def run_food_insight(req: FoodInsightRequest) -> FoodInsightResponse:
    full_prompt = f"{req.systemPrompt}\n\n{req.userPrompt}"

    logger.info(f"[foodInsight] calling Gemini promptLen={len(full_prompt)}")
    t0 = time.time()
    text, finish_reason = await call_gemini(req.apiKey, full_prompt)
    logger.info(f"[foodInsight] responded in {int((time.time() - t0) * 1000)}ms finishReason={finish_reason}")

    return FoodInsightResponse(analysis=text)
