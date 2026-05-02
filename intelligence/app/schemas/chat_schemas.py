from pydantic import BaseModel
from .common import LogType, ParsedLogItem  # noqa: F401 — re-exported for routes


class ChatRequest(BaseModel):
    apiKey: str
    date: str
    message: str
    logTypes: list[LogType]
    logsContext: str
    promptTemplate: str | None = None


class ChatResponse(BaseModel):
    type: str  # "answer" | "logs"
    text: str | None = None
    logs: list[ParsedLogItem] | None = None
