import asyncio
import json
import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from app.core.config import Settings
from app.core.service_auth import headers
from app.db.session import build_engine
from app.db.migrate import migrate
from app.rag.chunking import chunk_text
from app.rag.contracts import DocumentInput, KnowledgeError, FeedbackInput, Excerpt, PassageSelection
from app.rag.embedding import GeminiEmbedding, DIMENSIONS, normalized
from app.rag.store import KnowledgeStore
from app.llm.gemini import ProviderUnavailable
from app.main import create_app

class Embedding:
    async def embed(self,texts,query=False): return [[1.0]+[0.0]*(DIMENSIONS-1) for _ in texts]

@pytest.fixture(scope="module")
def engine():
    if os.environ.get("AI_INTEGRATION_TESTS")!="1": pytest.skip("Use isolated Compose DB")
    migrate()
    engine=build_engine(Settings().database_url)
    yield engine
    engine.dispose()

@pytest.fixture
def store(engine): return KnowledgeStore(engine,Embedding())

def payload(**overrides):
    return {"requestId":str(uuid4()),"title":"Hướng dẫn "+uuid4().hex[:8],"sourceLabel":"Quy trình nội bộ đã kiểm tra, mục 1","content":"# Vệ sinh\n\nDùng khăn mềm sạch để lau bề mặt gốm trang trí.","topic":"care",**overrides}

def command(doc,**overrides):
    return {"requestId":str(uuid4()),"documentId":doc["id"],"versionId":doc["versions"][0]["id"],"revision":doc["revision"],"confirmPublic":True,**overrides}

def ready(store,**overrides):
    doc=store.command("save",payload(**overrides),"admin-test")
    job=store.claim()
    # Other tests leave no queued jobs; this function always finishes its own version.
    assert str(job["id"])==doc["versions"][0]["id"]
    chunks=chunk_text(job["content"])
    store.finish(job,chunks,asyncio.run(Embedding().embed([c for _,c in chunks])))
    return store.detail(doc["id"])

def approved(store,**overrides):
    doc=ready(store,**overrides)
    return store.command("approve",command(doc),"admin-test")

def chunks(store,doc,slug=None,safety=False):
    return asyncio.run(store.retrieve("Vệ sinh gốm",slug,safety))

def test_version_approval_revoke_and_final_resolution(store):
    data=payload(); doc=store.command("save",data,"admin-test")
    assert store.command("save",data,"admin-test")==doc
    with pytest.raises(KnowledgeError): store.command("save",{**data,"title":"Different"},"admin-test")
    job=store.claim(); assert str(job["id"])==doc["versions"][0]["id"]
    parts=chunk_text(job["content"]); store.finish(job,parts,asyncio.run(Embedding().embed([p for _,p in parts])))
    doc=store.detail(doc["id"])
    with pytest.raises(KnowledgeError): store.command("approve",command(doc,confirmPublic=False),"admin-test")
    active=store.command("approve",command(doc),"admin-test")
    found=chunks(store,active); selected=[e.chunk_id for e in found if str(e.document_id)==doc["id"]]
    assert selected and store.resolve(selected)[0].source_label==data["sourceLabel"]
    revoke=command(active); revoked=store.command("revoke",revoke,"admin-test")
    assert revoked["activeVersion"] is None and store.command("revoke",revoke,"admin-test")==revoked
    assert store.resolve(selected)==[]
    assert all(str(e.document_id)!=doc["id"] for e in chunks(store,revoked))

def test_new_version_does_not_rewrite_published_title_or_content(store):
    doc=approved(store)
    ids=[e.chunk_id for e in chunks(store,doc) if str(e.document_id)==doc["id"]]
    original=store.resolve(ids)[0]
    update=payload(documentId=doc["id"],revision=doc["revision"],title="Unapproved new title",content="Nội dung phiên bản mới chưa được phê duyệt và không được công bố.")
    draft=store.command("save",update,"admin-test")
    assert store.resolve(ids)[0].title==original.title and store.resolve(ids)[0].content==original.content
    with pytest.raises(KnowledgeError): store.command("approve",command(doc),"admin-test")
    job=store.claim(); parts=chunk_text(job["content"]); store.finish(job,parts,asyncio.run(Embedding().embed([p for _,p in parts])))
    active=store.command("approve",command(store.detail(doc["id"])),"admin-test")
    assert active["versions"][0]["number"]==2 and store.resolve(ids)==[]
    store.command("revoke",command(active),"admin-test")

def test_scoped_safety_evidence_never_leaks_to_other_products(store):
    ordinary=approved(store,topic="safety",productSlug="coc-test")
    assert not [e for e in chunks(store,ordinary,"coc-test",True) if str(e.document_id)==ordinary["id"]]
    evidence=approved(store,topic="safety",productSlug="coc-test",evidenceType="safety_evidence")
    matches=[e for e in chunks(store,evidence,"coc-test",True) if str(e.document_id)==evidence["id"]]
    assert matches
    ids=[matches[0].chunk_id]
    assert store.resolve(ids)==[] and store.resolve(ids,"other",True)==[]
    assert store.resolve(ids,"coc-test",True)
    for d in [ordinary,evidence]: store.command("revoke",command(d),"admin-test")

def test_failed_job_explicit_retry_and_stable_chunk_ids(store):
    class Failing:
        async def embed(self,*args,**kwargs): raise ProviderUnavailable()
    doc=store.command("save",payload(),"admin-test")
    failed=KnowledgeStore(store.engine,Failing()); asyncio.run(failed.process_one())
    doc=store.detail(doc["id"]); assert doc["versions"][0]["indexStatus"]=="failed"
    doc=store.command("reindex",command(doc),"admin-test"); asyncio.run(store.process_one())
    doc=store.command("approve",command(store.detail(doc["id"])),"admin-test")
    ids=[e.chunk_id for e in chunks(store,doc) if str(e.document_id)==doc["id"]]
    doc=store.command("reindex",command(doc),"admin-test"); asyncio.run(store.process_one())
    assert store.resolve(ids)
    store.command("revoke",command(store.detail(doc["id"])),"admin-test")

def test_command_idempotency_is_transactional_under_concurrent_retry(store):
    data=payload()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:store.command("save",data,"admin-test"),range(2)))
    assert results[0]["id"]==results[1]["id"]
    asyncio.run(store.process_one())

def test_crashed_worker_cannot_finish_or_fail_a_reclaimed_lease(store):
    doc=store.command("save",payload(),"admin-test"); old=store.claim()
    with store.engine.begin() as c: c.execute(text("UPDATE ai.knowledge_jobs SET lease_until=now()-interval '1 second' WHERE id=:id"),{"id":old["job_id"]})
    current=store.claim(); assert current["claimed_attempt"]==old["claimed_attempt"]+1
    parts=chunk_text(old["content"]); vectors=asyncio.run(Embedding().embed([p for _,p in parts]))
    store.finish(old,parts,vectors); store.fail(old,"stale-worker")
    assert store.detail(doc["id"])["versions"][0]["indexStatus"]=="running"
    store.finish(current,parts,vectors)
    assert store.detail(doc["id"])["versions"][0]["indexStatus"]=="ready"

def test_history_and_version_content_are_immutable(store):
    doc=ready(store)
    for sql,params in [("UPDATE ai.knowledge_versions SET content='rewritten' WHERE id=:id",{"id":doc["versions"][0]["id"]}),("DELETE FROM ai.knowledge_audit WHERE document_id=:id",{"id":doc["id"]})]:
        with store.engine.connect() as c:
            with pytest.raises(DBAPIError): c.execute(text(sql),params)
            c.rollback()

def test_feedback_retries_once_and_revoked_sources_are_rejected(store):
    doc=approved(store); item=next(e for e in chunks(store,doc) if str(e.document_id)==doc["id"])
    data=FeedbackInput(request_id=uuid4(),chunk_id=item.chunk_id,useful=True)
    store.feedback(data); store.feedback(data)
    with pytest.raises(KnowledgeError): store.feedback(data.model_copy(update={"useful":False}))
    store.command("revoke",command(doc),"admin-test")
    with pytest.raises(KnowledgeError): store.feedback(FeedbackInput(request_id=uuid4(),chunk_id=item.chunk_id,useful=True))

def test_documents_reject_binary_credentials_unsupported_files_and_unscoped_safety():
    for changes in [{"fileName":"evil.pdf"},{"fileName":"../file.md"},{"content":"private\x00binary content more than twenty characters"},{"content":"GEMINI_API_KEY=do-not-upload-private-secret"},{"evidenceType":"safety_evidence"},{"content":"x"*20001}]:
        with pytest.raises(ValidationError): DocumentInput.model_validate(payload(**changes))
    parts=chunk_text("# Phần một\n\n"+"Nội dung. "*200+"\n\n# Phần hai\n\nĐây là phần thứ hai.")
    assert all(len(c)<=1200 for _,c in parts) and parts[-1][0].startswith("Phần hai")

def test_embedding_dimension_and_header_key_are_validated():
    with pytest.raises(ProviderUnavailable): normalized([1.0]*767)
    with pytest.raises(ProviderUnavailable): normalized([float('nan')]*768)
    def respond(request):
        assert request.headers["x-goog-api-key"]=="sentinel" and "sentinel" not in str(request.url)
        data=json.loads(request.content)
        assert data["requests"][0]["outputDimensionality"]==768 and data["requests"][0]["taskType"]=="RETRIEVAL_QUERY"
        return httpx.Response(200,json={"embeddings":[{"values":[2.0]+[0.0]*767}]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as network:
            config=Settings(_env_file=None,database_url="postgresql+psycopg://unused@localhost/unused",GEMINI_API_KEY="sentinel")
            assert (await GeminiEmbedding(config,network).embed(["Synthetic query"],True))[0][0]==1
    asyncio.run(run())

def test_internal_admin_scope_requires_separate_secret_and_read_rechecks_approval(store):
    secret="a"*64; gate="g"*64
    config=Settings(_env_file=None,database_url="postgresql+psycopg://unused@localhost/unused",knowledge_admin_secret=secret,gateway_secret=gate,knowledge_worker_enabled=False)
    app=create_app(config); app.state.knowledge=store
    body=json.dumps({"action":"list","payload":{},"actorId":"admin-test"}).encode(); path="/internal/knowledge/admin"
    with TestClient(app) as client:
        assert client.post(path,content=body,headers=headers(gate,path,"knowledge:admin",body)).status_code==401
        assert client.post(path,content=body,headers=headers(secret,path,"chat:public",body)).status_code==401
        signed=headers(secret,path,"knowledge:admin",body)
        assert client.post(path,content=body,headers=signed).status_code==200
        assert client.post(path,content=body,headers=signed).status_code==401
        assert client.get('/openapi.json').json()['paths'].get(path) is None
