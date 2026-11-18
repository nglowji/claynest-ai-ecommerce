from pathlib import Path
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", env_prefix="AI_", extra="ignore", hide_input_in_errors=True)

    app_name: str = "ClayNest AI Service"
    database_url: str
    gemini_api_key: SecretStr = Field(default=SecretStr(""), validation_alias="GEMINI_API_KEY")
    gemini_model: str = "gemini-3.5-flash-lite"
    gateway_secret: SecretStr = SecretStr("")
    tool_secret: SecretStr = SecretStr("")
    commerce_base_url: str = "http://api:8080"
    daily_turn_limit: int = Field(default=100, ge=1, le=10000)
    max_output_tokens: int = Field(default=1024, ge=256, le=4096)

    @field_validator("gemini_model")
    @classmethod
    def model_identifier(cls, value: str) -> str:
        import re
        if not re.fullmatch(r"gemini-[a-zA-Z0-9.-]{1,80}", value):
            raise ValueError("Invalid Gemini model identifier")
        return value


    @field_validator("database_url")
    @classmethod
    def postgres_url_required(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "postgresql+psycopg" or not parsed.hostname or not parsed.path.strip("/"):
            raise ValueError("A PostgreSQL psycopg URL is required for the AI-owned database")
        return value
