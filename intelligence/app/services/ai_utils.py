import json
import re
import logging

from fastapi import HTTPException

from ..schemas.common import LogType, ParsedLogItem

logger = logging.getLogger("ic.utils")


def extract_json(text: str, finish_reason: str, expect_array: bool) -> list | dict:
    """Strip markdown fences, find JSON, parse it. Attempts repair on truncated output."""
    stripped = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()
    arr_match = re.search(r"\[[\s\S]*\]", stripped)
    obj_match = re.search(r"\{[\s\S]*\}", stripped)

    match = (arr_match if expect_array else obj_match) or arr_match or obj_match
    if not match:
        _raise_parse_error(finish_reason, is_array=expect_array)

    raw = match.group(0)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(f"JSON parse failed, attempting repair (finishReason={finish_reason})")
        repaired = _repair_truncated_json(raw)
        if repaired is not None:
            return repaired
        _raise_parse_error(finish_reason, is_array=expect_array)


def resolve_log_type(parsed: dict, log_types: list[LogType]) -> ParsedLogItem:
    """Fuzzy-match logTypeId/logTypeName against the provided list."""
    ltype_id = parsed.get("logTypeId", "")
    ltype_name = (parsed.get("logTypeName") or "").lower()

    matched = (
        next((t for t in log_types if t.id == ltype_id), None)
        or next((t for t in log_types if t.name.lower() == ltype_name), None)
        or next((t for t in log_types if ltype_name and ltype_name in t.name.lower()), None)
    )

    if not matched:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Unrecognised log type: \"{parsed.get('logTypeName')}\". Try rephrasing.",
                "code": "UNRECOGNISED_TYPE",
            },
        )

    return ParsedLogItem(
        logTypeId=matched.id,
        logTypeName=matched.name,
        domain=matched.domain,
        entryType="range" if parsed.get("entryType") == "range" else "point",
        pointTime=parsed.get("pointTime"),
        startTime=parsed.get("startTime"),
        endTime=parsed.get("endTime"),
        title=parsed.get("title") or matched.name,
    )


def _raise_parse_error(finish_reason: str, is_array: bool) -> None:
    if finish_reason == "MAX_TOKENS":
        msg = (
            "The AI response was too long and got cut off. Try logging fewer activities at once."
            if is_array
            else "The AI response was cut off. Try a shorter message."
        )
    else:
        msg = "AI returned an unrecognisable response. Please try again."
    raise HTTPException(status_code=502, detail={"error": msg, "code": "PARSE_ERROR"})


def _repair_truncated_json(raw: str):
    """Best-effort repair of JSON truncated mid-stream (MAX_TOKENS cut-off)."""
    in_str = esc = False
    depth = last_safe_end = 0
    last_safe_end = -1

    for i, c in enumerate(raw):
        if esc:
            esc = False
            continue
        if c == "\\" and in_str:
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c in ("{", "["):
            depth += 1
        elif c in ("}", "]"):
            depth -= 1
            if depth >= 1:
                last_safe_end = i
            if depth == 0:
                last_safe_end = i
                break

    if last_safe_end == -1:
        return None

    sliced = raw[: last_safe_end + 1]

    in_str = esc = False
    ob = cb = oa = ca = 0
    for c in sliced:
        if esc:
            esc = False
            continue
        if c == "\\" and in_str:
            esc = True
            continue
        if c == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if c == "{":
            ob += 1
        elif c == "}":
            cb += 1
        elif c == "[":
            oa += 1
        elif c == "]":
            ca += 1

    repaired = sliced + "]" * (oa - ca) + "}" * (ob - cb)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None
