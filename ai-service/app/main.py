import asyncio
import httpx
from contextlib import asynccontextmanager
from app.api.chat_models import ChatInput
from app.rag.embedding import GeminiEmbedding
from app.rag.store import KnowledgeStore
from app.rag.api import mount_knowledge
from app.core.service_auth import ReplayGuard
from app.llm.advisor import Advisor
from app.llm.gemini import GeminiProvider, ProviderUnavailable
from app.tools.catalog import CatalogTools
from pydantic import ValidationError
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import Settings
from app.core.logging import application_logger, correlation_context
from app.db.session import build_engine, check_database

logger = application_logger()


class HealthResponse(BaseModel):
    status: str


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or Settings()
    engine = build_engine(config.database_url)
    network = httpx.AsyncClient(limits=httpx.Limits(max_connections=8,max_keepalive_connections=4),follow_redirects=False)
    knowledge = KnowledgeStore(engine, GeminiEmbedding(config,network))
    advisor = Advisor(GeminiProvider(config,network),CatalogTools(config,network),config.daily_turn_limit,knowledge)
    async def worker():
        while True:
            try:
                if not await knowledge.process_one(): await asyncio.sleep(2)
            except asyncio.CancelledError: raise
            except Exception as error:
                logger.error("knowledge_worker_failed",extra={"exception_type":type(error).__name__})
                await asyncio.sleep(5)
    guard = ReplayGuard()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task=asyncio.create_task(worker()) if config.knowledge_worker_enabled else None
        try: yield
        finally:
            if task:
                task.cancel()
                await asyncio.gather(task,return_exceptions=True)
        await network.aclose()
        engine.dispose()

    app = FastAPI(title=config.app_name, version="0.2.0", lifespan=lifespan)
    app.state.engine = engine
    app.state.advisor = advisor
    app.state.knowledge = knowledge
    mount_knowledge(app,config,guard)

    @app.middleware("http")
    async def correlation(request: Request, call_next):
        try:
            correlation_id = UUID(request.headers.get("X-Correlation-ID", "")).hex
        except ValueError:
            correlation_id = uuid4().hex
        token = correlation_context.set(correlation_id)
        try:
            response = await call_next(request)
        except Exception as error:
            # Log the exception type, never raw messages/connection strings or request payloads.
            logger.error("request_failed", extra={"exception_type": type(error).__name__, "correlation_id": correlation_id})
            response = JSONResponse(status_code=500, content={"detail": "Service unavailable", "correlation_id": correlation_id})
        logger.info("http_request", extra={"correlation_id": correlation_id, "method": request.method, "path": request.url.path, "status_code": response.status_code})
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Request-ID"] = correlation_id
        correlation_context.reset(token)
        return response

    @app.post("/internal/chat", include_in_schema=False)
    async def internal_chat(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return JSONResponse(status_code=413,content={"detail":"Request too large"})
        raw = bytes(body)
        if not guard.verify(config.gateway_secret.get_secret_value(),request.url.path,request.headers,raw):
            return JSONResponse(status_code=401,content={"detail":"Invalid service credential"})
        try:
            incoming = ChatInput.model_validate_json(raw)
        except (ValueError,ValidationError):
            return JSONResponse(status_code=400,content={"detail":"Invalid chat input"})
        work = asyncio.create_task(app.state.advisor.ask(incoming))
        try:
            async with asyncio.timeout(40):
                while not work.done():
                    await asyncio.wait({work},timeout=0.2)
                    if await request.is_disconnected():
                        work.cancel()
                        return JSONResponse(status_code=499,content={"detail":"Cancelled"})
                result = await work
                return JSONResponse(content=result.model_dump(by_alias=True,mode="json"),headers={"Cache-Control":"no-store"})
        except (ProviderUnavailable,TimeoutError):
            work.cancel()
            return JSONResponse(status_code=503,content={"detail":"Advice unavailable"})
        finally:
            if not work.done():
                work.cancel()
            await asyncio.gather(work,return_exceptions=True)

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
