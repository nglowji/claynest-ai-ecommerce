from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    app_name: str = "ClayNest AI"
    database_url: str = "postgresql+psycopg://claynest:claynest_local@localhost:5432/claynest"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
