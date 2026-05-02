from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    ic_internal_secret: str = ""  # shared secret Node passes; empty = no auth check (local dev)

    class Config:
        env_file = ".env"


settings = Settings()
