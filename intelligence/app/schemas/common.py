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
