from pydantic import BaseModel
from .common import LogType, ParsedLogItem  # noqa: F401 — re-exported for routes


class ParseRequest(BaseModel):
    apiKey: str
    date: str
    userInput: str
    logTypes: list[LogType]
    promptTemplate: str | None = None
