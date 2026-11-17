import os

# Unit tests do not require a running PostgreSQL instance. Compose supplies the
# real ai_app URL for the separately enabled integration tests.
os.environ.setdefault("AI_DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")
