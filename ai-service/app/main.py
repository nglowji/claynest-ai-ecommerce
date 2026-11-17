from contextlib import asynccontextmanager
import logging
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.db.session import build_engine, check_database

logger = logging.getLogger("claynest.ai")


class HealthResponse(BaseModel):
    status: str


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    engine = build_engine(config.database_url)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        engine.dispose()

    app = FastAPI(title=config.app_name, version="0.2.0", lifespan=lifespan)
    app.state.engine = engine

    @app.middleware("http")
    async def correlation(request: Request, call_next):
        try:
            correlation_id = UUID(request.headers.get("X-Correlation-ID", "")).hex
        except ValueError:
            correlation_id = uuid4().hex
        try:
            response = await call_next(request)
        except Exception as error:
            # Log the exception type, never raw messages/connection strings or request payloads.
            logger.error("AI request failed: type=%s correlation_id=%s", type(error).__name__, correlation_id)
            response = JSONResponse(status_code=500, content={"detail": "Service unavailable", "correlation_id": correlation_id})
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Request-ID"] = correlation_id
        return response

    @app.get("/health", response_model=HealthResponse, tags=["operations"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.get("/ready", response_model=HealthResponse, tags=["operations"],
             responses={503: {"model": HealthResponse}})
    def ready():
        try:
            check_database(app.state.engine)
        except SQLAlchemyError:
            return JSONResponse(status_code=503, content={"status": "unavailable"})
        return HealthResponse(status="ready")

    return app


app = create_app()
