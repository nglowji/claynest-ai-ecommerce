"""Create missing local configuration without printing or replacing existing secrets."""
from pathlib import Path
import secrets

ROOT = Path(__file__).resolve().parents[1]


def configure() -> None:
    target = ROOT / ".env"
    lines = target.read_text(encoding="utf-8").splitlines() if target.exists() else []
    values = {}
    for line in lines:
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
    defaults = {
        "GEMINI_API_KEY": "", "AI_GEMINI_MODEL": "gemini-3.5-flash-lite",
        "AI_KNOWLEDGE_ADMIN_SECRET": secrets.token_hex(32),
        "TEST_AI_KNOWLEDGE_ADMIN_SECRET": secrets.token_hex(32),
        "AI_GATEWAY_SECRET": secrets.token_hex(32), "AI_TOOL_SECRET": secrets.token_hex(32),
        "TEST_AI_GATEWAY_SECRET": secrets.token_hex(32), "TEST_AI_TOOL_SECRET": secrets.token_hex(32),
        "POSTGRES_USER": "claynest", "POSTGRES_DB": "claynest", "POSTGRES_PORT": "5432",
        "ADMIN_EMAIL": "admin@nanggom.local", "ADMIN_PASSWORD": secrets.token_urlsafe(20) + "aA1!",
        "ADMIN_DISPLAY_NAME": "Quản trị Nàng Gốm",
        "COMMERCE_API_PORT": "8000", "VITE_API_BASE_URL": "http://localhost:8000",
        "TEST_POSTGRES_PASSWORD": secrets.token_hex(24),
        "TEST_COMMERCE_DB_PASSWORD": secrets.token_hex(24), "TEST_AI_DB_PASSWORD": secrets.token_hex(24),
        "E2E_ADMIN_EMAIL": "admin@example.test", "E2E_ADMIN_PASSWORD": secrets.token_urlsafe(20) + "aA1!",
        "POSTGRES_PASSWORD": secrets.token_hex(24),
        "COMMERCE_DB_PASSWORD": secrets.token_hex(24), "AI_DB_PASSWORD": secrets.token_hex(24),
    }
    missing = {key: value for key, value in defaults.items() if not values.get(key)}
    lines = [line for line in lines if line.split("=", 1)[0].strip() not in missing]
    lines += [f"{key}={value}" for key, value in missing.items()]
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("Local .env ready. Existing values preserved; no credentials printed.")


if __name__ == "__main__":
    configure()
