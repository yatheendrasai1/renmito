from fastapi import Header, HTTPException
from .config import settings


async def verify_internal_secret(x_ic_secret: str = Header(default="")) -> None:
    """Reject requests that don't carry the shared Node↔Python secret.
    Skipped when IC_INTERNAL_SECRET is not configured (local dev)."""
    if settings.ic_internal_secret and x_ic_secret != settings.ic_internal_secret:
        raise HTTPException(status_code=401, detail="Unauthorized")
