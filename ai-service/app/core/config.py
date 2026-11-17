from pathlib import Path
from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", env_prefix="AI_", extra="ignore", hide_input_in_errors=True)

    app_name: str = "ClayNest AI Service"
    database_url: str

    @field_validator("database_url")
    @classmethod
    def postgres_url_required(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "postgresql+psycopg" or not parsed.hostname or not parsed.path.strip("/"):
            raise ValueError("A PostgreSQL psycopg URL is required for the AI-owned database")
        return value
