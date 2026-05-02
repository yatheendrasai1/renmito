import logging
import time

from ..schemas.chat_schemas import ChatRequest, ChatResponse
from .gemini_client import call_gemini
from .prompt_library import get_prompt
from .ai_utils import extract_json, resolve_log_type

logger = logging.getLogger("ic.chat")


async def run_chat(req: ChatRequest) -> ChatResponse:
    types_compact = "\n".join(f"{t.id}|{t.name}|{t.domain}" for t in req.logTypes)

    prompt = get_prompt(
        "chat_renni",
        {
            "date": req.date,
            "logsContext": req.logsContext,
            "logTypes": types_compact,
            "message": req.message,
        },
        template_override=req.promptTemplate,
    )

    logger.info(f"[chat] calling Gemini promptLen={len(prompt)}")
    t0 = time.time()
    text, finish_reason = await call_gemini(req.apiKey, prompt)
    logger.info(f"[chat] responded in {int((time.time() - t0) * 1000)}ms finishReason={finish_reason}")
    logger.debug(f"[chat] raw (first 300): {text[:300]}")

    raw = extract_json(text, finish_reason, expect_array=False)
    result = raw if isinstance(raw, dict) else raw[0]

    response_type = result.get("type")
    logger.info(f"[chat] responseType={response_type}")

    if response_type == "logs":
        raw_logs = result.get("logs", [])
        if not isinstance(raw_logs, list):
            raw_logs = [raw_logs]
        resolved = [resolve_log_type(item, req.logTypes) for item in raw_logs]
        logger.info(f"[chat] logs resolved count={len(resolved)}")
        return ChatResponse(type="logs", logs=resolved)

    return ChatResponse(type="answer", text=result.get("text", ""))
