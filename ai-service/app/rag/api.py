import asyncio
import json
from uuid import UUID
from fastapi import Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from app.rag.contracts import AdminEnvelope, ResolveInput, FeedbackInput, KnowledgeError


def mount_knowledge(app, config, guard):
    async def authenticated(request,scope,secret):
        body=bytearray()
        async for part in request.stream():
            body.extend(part)
            if len(body)>262144: return None,JSONResponse(status_code=413,content={"code":"too_large","message":"Tài liệu quá lớn."})
        raw=bytes(body)
        if not guard.verify(secret,request.url.path,request.headers,raw,scope):
            return None,JSONResponse(status_code=401,content={"code":"invalid_service_credential","message":"Service credential invalid."})
        return raw,None

    def failure(error):
        if isinstance(error,KnowledgeError):
            return JSONResponse(status_code=error.status,content={"code":error.code,"message":error.message})
        return JSONResponse(status_code=400,content={"code":"invalid_knowledge","message":"Thông tin tài liệu hoặc thao tác không hợp lệ."})

    @app.post("/internal/knowledge/admin",include_in_schema=False)
    async def admin(request: Request):
        raw,error=await authenticated(request,"knowledge:admin",config.knowledge_admin_secret.get_secret_value())
        if error: return error
        try:
            command=AdminEnvelope.model_validate_json(raw)
            store=app.state.knowledge
            if command.action=="list":
                if set(command.payload)-{"page"}: raise ValueError()
                result=await asyncio.to_thread(store.list,command.payload.get("page",1))
            elif command.action=="detail":
                if set(command.payload)!={"documentId"}: raise ValueError()
                result=await asyncio.to_thread(store.detail,UUID(command.payload["documentId"]))
            else:
                result=await asyncio.to_thread(store.command,command.action,command.payload,command.actor_id)
            return JSONResponse(content=result,headers={"Cache-Control":"no-store"})
        except (KnowledgeError,ValidationError,ValueError,TypeError,KeyError) as error: return failure(error)

    @app.post("/internal/knowledge/resolve",include_in_schema=False)
    async def resolve(request: Request):
        raw,error=await authenticated(request,"knowledge:read",config.gateway_secret.get_secret_value())
        if error: return error
        try:
            data=ResolveInput.model_validate_json(raw)
            result=await asyncio.to_thread(app.state.knowledge.resolve,data.chunk_ids,data.product_slug,data.safety_only)
            return JSONResponse(content=[r.model_dump(by_alias=True,mode="json") for r in result],headers={"Cache-Control":"no-store"})
        except (KnowledgeError,ValidationError,ValueError,TypeError) as error: return failure(error)

    @app.post("/internal/knowledge/feedback",include_in_schema=False)
    async def feedback(request: Request):
        raw,error=await authenticated(request,"knowledge:feedback",config.gateway_secret.get_secret_value())
        if error: return error
        try:
            data=FeedbackInput.model_validate_json(raw)
            await asyncio.to_thread(app.state.knowledge.feedback,data)
            return JSONResponse(content={"saved":True},headers={"Cache-Control":"no-store"})
        except (KnowledgeError,ValidationError,ValueError,TypeError) as error: return failure(error)
