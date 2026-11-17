from uuid import UUID
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.config import Settings
from app.main import create_app


def test_health_and_openapi():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        UUID(response.headers["X-Request-ID"])
        assert "/ready" in client.get("/openapi.json").json()["paths"]


def test_readiness_success():
    with patch("app.main.check_database") as check:
        with TestClient(create_app(Settings(_env_file=None))) as client:
            response = client.get("/ready")
            assert response.status_code == 200
            assert response.json() == {"status": "ready"}
            check.assert_called_once_with(client.app.state.engine)


def test_database_failure_does_not_break_liveness_or_leak_details():
    error = OperationalError("SELECT 1", {}, Exception("private-password"))
    with patch("app.main.check_database", side_effect=error):
        with TestClient(create_app(Settings(_env_file=None))) as client:
            response = client.get("/ready")
            assert response.status_code == 503
            assert response.json() == {"status": "unavailable"}
            assert "private-password" not in response.text
            assert client.get("/health").status_code == 200


def test_cors_allows_local_frontend_only():
    with TestClient(create_app(Settings(_env_file=None))) as client:
        allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
        denied = client.get("/health", headers={"Origin": "https://untrusted.example"})
        assert "access-control-allow-origin" not in denied.headers
