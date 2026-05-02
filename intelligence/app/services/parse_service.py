import logging
import time

from ..schemas.parse_schemas import ParseRequest
from ..schemas.common import ParsedLogItem
from .gemini_client import call_gemini
from .prompt_library import get_prompt
from .ai_utils import extract_json, resolve_log_type

logger = logging.getLogger("ic.parse")


async def run_parse(req: ParseRequest) -> list[ParsedLogItem]:
    types_compact = "\n".join(f"{t.id}|{t.name}|{t.domain}" for t in req.logTypes)

    prompt = get_prompt(
        "parse_log",
        {"logTypes": types_compact, "date": req.date, "input": req.userInput},
        template_override=req.promptTemplate,
    )

    logger.info(f"[parseLog] calling Gemini promptLen={len(prompt)}")
    t0 = time.time()
    text, finish_reason = await call_gemini(req.apiKey, prompt)
    logger.info(f"[parseLog] responded in {int((time.time() - t0) * 1000)}ms finishReason={finish_reason}")
    logger.debug(f"[parseLog] raw (first 300): {text[:300]}")

    result = extract_json(text, finish_reason, expect_array=True)
    items = result if isinstance(result, list) else [result]

    resolved = [resolve_log_type(item, req.logTypes) for item in items]
    logger.info(f"[parseLog] done itemCount={len(resolved)}")
    return resolved
