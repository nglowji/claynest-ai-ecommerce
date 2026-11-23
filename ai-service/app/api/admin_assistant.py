import asyncio
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from app.llm.admin_advisor import AdminContext
from app.llm.gemini import ProviderUnavailable


def mount_admin_assistant(app, config, guard):
    @app.post("/internal/admin-assistant", include_in_schema=False)
    async def admin_assistant(request: Request):
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
        if not guard.verify(config.gateway_secret.get_secret_value(), request.url.path,
                            request.headers, bytes(body), scope="chat:admin"):
            return JSONResponse(status_code=401, content={"detail": "Invalid service credential"})
        try:
            context = AdminContext.model_validate_json(body)
        except (ValueError, ValidationError):
            return JSONResponse(status_code=400, content={"detail": "Invalid admin context"})
        work = asyncio.create_task(app.state.admin_advisor.ask(context))
        try:
            async with asyncio.timeout(40):
                while not work.done():
                    await asyncio.wait({work}, timeout=0.2)
                    if await request.is_disconnected():
                        return JSONResponse(status_code=499, content={"detail": "Cancelled"})
                result = await work
                return JSONResponse(content=result.model_dump(by_alias=True, mode="json"),
                                    headers={"Cache-Control": "no-store"})
        except (ProviderUnavailable, TimeoutError):
            return JSONResponse(status_code=503, content={"detail": "Assistant unavailable"})
        finally:
            if not work.done():
                work.cancel()
            await asyncio.gather(work, return_exceptions=True)
