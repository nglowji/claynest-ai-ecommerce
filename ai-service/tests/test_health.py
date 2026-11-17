from uuid import UUID, uuid4
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.main import create_app


def settings():
    return Settings(_env_file=None, database_url="postgresql+psycopg://unused@localhost/unused")


def test_health_and_openapi():
    with TestClient(create_app(settings())) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        UUID(response.headers["X-Correlation-ID"])
        assert "/ready" in client.get("/openapi.json").json()["paths"]


def test_readiness_success():
    with patch("app.main.check_database") as check:
        with TestClient(create_app(settings())) as client:
            assert client.get("/ready").json() == {"status": "ready"}
            check.assert_called_once_with(client.app.state.engine)


def test_database_failure_does_not_break_liveness_or_leak_details():
    error = OperationalError("SELECT 1", {}, Exception("private-password"))
    with patch("app.main.check_database", side_effect=error):
        with TestClient(create_app(settings())) as client:
            response = client.get("/ready")
            assert response.status_code == 503
            assert response.json() == {"status": "unavailable"}
            assert "private-password" not in response.text
            assert client.get("/health").status_code == 200


def test_ai_has_no_browser_cors_or_commerce_endpoints():
    with TestClient(create_app(settings())) as client:
        response = client.get("/health", headers={"Origin": "http://localhost:5173"})
        assert "access-control-allow-origin" not in response.headers
        assert client.post("/api/v1/orders", json={}).status_code == 404
        assert client.post("/api/v1/auth/login", json={}).status_code == 404


def test_correlation_is_propagated_or_regenerated():
    with TestClient(create_app(settings())) as client:
        value = uuid4()
        response = client.get("/health", headers={"X-Correlation-ID": str(value)})
        assert response.headers["X-Correlation-ID"] == value.hex
        invalid = client.get("/health", headers={"X-Correlation-ID": "bad"})
        UUID(invalid.headers["X-Correlation-ID"])


def test_unexpected_error_is_sanitized():
    with patch("app.main.check_database", side_effect=RuntimeError("private-password")):
        with TestClient(create_app(settings())) as client:
            response = client.get("/ready")
            assert response.status_code == 500
            assert "private-password" not in response.text
            assert "correlation_id" in response.json()
