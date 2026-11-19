import os

# Unit tests do not require a running PostgreSQL instance. Compose supplies the
# real ai_app URL for the separately enabled integration tests.
os.environ.setdefault("AI_KNOWLEDGE_WORKER_ENABLED", "false")
os.environ.setdefault("AI_DATABASE_URL", "postgresql+psycopg://unused@localhost/unused")


def pytest_configure(config):
    if os.environ.get("AI_INTEGRATION_TESTS") == "1":
        from sqlalchemy.engine import make_url
        import pytest
        url = make_url(os.environ["AI_DATABASE_URL"])
        if url.host != "db-test" or url.database != "claynest_test":
            raise pytest.UsageError("Integration tests require the isolated db-test/claynest_test database.")
