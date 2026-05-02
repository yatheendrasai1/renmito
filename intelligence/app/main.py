import logging
from fastapi import FastAPI
from .routes import parse, chat

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

app = FastAPI(title="Renmito Intelligence Service")

app.include_router(parse.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
