from pydantic import BaseModel


class LogType(BaseModel):
    id: str
    name: str
    domain: str


class ParsedLogItem(BaseModel):
    logTypeId: str
    logTypeName: str
    domain: str
    entryType: str  # "point" | "range"
    pointTime: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    title: str
    priority: str | None = None           # "High" | "Medium" | "Low" — only if mentioned
    ticketId: str | None = None           # ticket identifier — only if mentioned
    satisfactoryScore: int | None = None  # 1–10 — only if mentioned
    collaborators: list[str] | None = None  # names — only if mentioned
    crucialPerson: str | None = None      # "Yes" | "No" | "Shared" — only if mentioned
