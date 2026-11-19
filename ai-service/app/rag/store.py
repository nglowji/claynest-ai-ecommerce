import asyncio
import hashlib
import json
from uuid import UUID, uuid4, uuid5
from datetime import datetime, timezone
from sqlalchemy import text
from app.rag.contracts import DocumentInput, CommandInput, Excerpt, KnowledgeError
from app.rag.chunking import chunk_text
from app.rag.embedding import MODEL, vector_literal
from app.llm.gemini import ProviderUnavailable


def execute(connection, sql, **params):
    return connection.execute(text(sql), params)


def serializable(value):
    def encode(item):
        return item.astimezone(timezone.utc).isoformat().replace("+00:00","Z") if isinstance(item,datetime) else str(item)
    return json.loads(json.dumps(value,default=encode))


def conflict():
    raise KnowledgeError(409,"knowledge_conflict","Nội dung đã thay đổi. Vui lòng tải lại trước khi tiếp tục.")


class KnowledgeStore:
    def __init__(self, engine, embedding): self.engine,self.embedding=engine,embedding

    def list(self, page=1):
        if type(page) is not int or page<1 or page>10000: raise KnowledgeError(400,"invalid_page","Trang không hợp lệ.")
        with self.engine.connect() as c:
            total=execute(c,"SELECT count(*) FROM ai.knowledge_documents").scalar_one()
            rows=execute(c,"""SELECT d.id,d.title,d.revision,d.active_version AS "activeVersion",d.updated_at AS "updatedAt",
              v.id AS "versionId",v.number AS version,v.index_status AS "indexStatus",v.topic,v.product_slug AS "productSlug",
              (SELECT number FROM ai.knowledge_versions av WHERE av.id=d.active_version) AS "activeVersionNumber"
              FROM ai.knowledge_documents d JOIN ai.knowledge_versions v ON v.document_id=d.id
              AND v.number=(SELECT max(number) FROM ai.knowledge_versions WHERE document_id=d.id)
              ORDER BY d.updated_at DESC,d.id LIMIT 20 OFFSET :offset""",offset=(page-1)*20).mappings().all()
            return serializable({"items":[dict(r) for r in rows],"totalCount":total,"page":page,"pageSize":20})

    def detail(self, document_id):
        with self.engine.connect() as c: return self._detail(c,document_id)

    def _detail(self,c,document_id):
        row=execute(c,'SELECT id,title,revision,active_version AS "activeVersion",updated_at AS "updatedAt" FROM ai.knowledge_documents WHERE id=:id',id=document_id).mappings().first()
        if not row: raise KnowledgeError(404,"knowledge_not_found","Không tìm thấy tài liệu.")
        versions=execute(c,"""SELECT v.id,v.number,v.content,v.content_hash AS "contentHash",v.source_label AS "sourceLabel",v.topic,
          v.product_slug AS "productSlug",v.evidence_type AS "evidenceType",v.index_status AS "indexStatus",v.created_at AS "createdAt",
          (SELECT json_build_object('id',j.id,'status',j.status,'attempts',j.attempts,'errorCode',j.error_code)
           FROM ai.knowledge_jobs j WHERE j.version_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1) AS job,
          (SELECT count(*) FROM ai.knowledge_chunks ch WHERE ch.version_id=v.id) AS "chunkCount"
          FROM ai.knowledge_versions v WHERE document_id=:id ORDER BY number DESC LIMIT 50""",id=document_id).mappings().all()
        history=execute(c,'SELECT action,version_id AS "versionId",actor_id AS "actorId",created_at AS "createdAt" FROM ai.knowledge_audit WHERE document_id=:id ORDER BY created_at DESC,id DESC LIMIT 30',id=document_id).mappings().all()
        return serializable({**dict(row),"versions":[dict(v) for v in versions],"history":[dict(h) for h in history]})

    def command(self,action,payload,actor_id):
        data=DocumentInput.model_validate(payload) if action=="save" else CommandInput.model_validate(payload)
        raw=json.dumps({"action":action,"payload":data.model_dump(mode="json"),"actor":actor_id},sort_keys=True,separators=(",",":"))
        digest=hashlib.sha256(raw.encode()).hexdigest()
        with self.engine.begin() as c:
            execute(c,"SELECT pg_advisory_xact_lock(:key)",key=int.from_bytes(data.request_id.bytes[:8],signed=True))
            previous=execute(c,"SELECT payload_hash,response FROM ai.knowledge_commands WHERE request_id=:id",id=data.request_id).mappings().first()
            if previous:
                if previous["payload_hash"]!=digest: conflict()
                return self._detail(c,previous["response"].get("documentId",previous["response"].get("id")))
            if action=="save": document_id,version_id=self._save(c,data,actor_id)
            else: document_id,version_id=self._transition(c,action,data)
            execute(c,"INSERT INTO ai.knowledge_audit(id,document_id,version_id,action,actor_id) VALUES(:id,:doc,:ver,:action,:actor)",id=uuid4(),doc=document_id,ver=version_id,action=action,actor=actor_id)
            result=self._detail(c,document_id)
            execute(c,"INSERT INTO ai.knowledge_commands(request_id,payload_hash,response) VALUES(:id,:hash,CAST(:response AS jsonb))",id=data.request_id,hash=digest,response=json.dumps({"documentId":str(document_id)}))
            return result

    def _save(self,c,data,actor):
        # Deterministic parse is validated before a job is queued or any external provider call.
        chunk_text(data.content)
        doc_id=data.document_id or uuid4(); version_id=uuid4()
        if data.document_id:
            doc=execute(c,"SELECT revision FROM ai.knowledge_documents WHERE id=:id FOR UPDATE",id=doc_id).mappings().first()
            if not doc: raise KnowledgeError(404,"knowledge_not_found","Không tìm thấy tài liệu.")
            if doc["revision"]!=data.revision: conflict()
            number=execute(c,"SELECT coalesce(max(number),0)+1 FROM ai.knowledge_versions WHERE document_id=:id",id=doc_id).scalar_one()
            if number>50: raise KnowledgeError(400,"version_limit","Tài liệu đã đạt giới hạn 50 phiên bản.")
            execute(c,"UPDATE ai.knowledge_documents SET title=:title,revision=revision+1,updated_at=now() WHERE id=:id",title=data.title.strip(),id=doc_id)
        else:
            number=1
            execute(c,"INSERT INTO ai.knowledge_documents(id,title) VALUES(:id,:title)",id=doc_id,title=data.title.strip())
        execute(c,"""INSERT INTO ai.knowledge_versions(id,document_id,number,title,content,content_hash,source_label,topic,product_slug,evidence_type,created_by)
          VALUES(:id,:doc,:number,:title,:content,:hash,:source,:topic,:slug,:evidence,:actor)""",id=version_id,doc=doc_id,number=number,title=data.title.strip(),content=data.content.strip(),hash=hashlib.sha256(data.content.strip().encode()).hexdigest(),source=data.source_label.strip(),topic=data.topic,slug=data.product_slug,evidence=data.evidence_type,actor=actor)
        self._queue(c,version_id)
        return doc_id,version_id

    def _transition(self,c,action,data):
        doc=execute(c,"SELECT * FROM ai.knowledge_documents WHERE id=:id FOR UPDATE",id=data.document_id).mappings().first()
        if not doc: raise KnowledgeError(404,"knowledge_not_found","Không tìm thấy tài liệu.")
        if doc["revision"]!=data.revision: conflict()
        version=execute(c,"SELECT * FROM ai.knowledge_versions WHERE id=:id AND document_id=:doc",id=data.version_id,doc=data.document_id).mappings().first()
        if not version: raise KnowledgeError(404,"knowledge_not_found","Không tìm thấy phiên bản.")
        if action=="approve":
            if version["topic"]=="safety" and (version["evidence_type"]!="safety_evidence" or not version["product_slug"]):
                raise KnowledgeError(409,"unverified_safety","Chứng cứ an toàn cần được xác minh và gắn một sản phẩm cụ thể.")
            latest=execute(c,"SELECT max(number) FROM ai.knowledge_versions WHERE document_id=:id",id=data.document_id).scalar_one()
            if not data.confirm_public or version["index_status"]!="ready" or version["number"]!=latest or doc["active_version"]==data.version_id: conflict()
            if not execute(c,"SELECT EXISTS(SELECT 1 FROM ai.knowledge_chunks WHERE version_id=:id)",id=data.version_id).scalar_one(): conflict()
            execute(c,"UPDATE ai.knowledge_documents SET active_version=:ver WHERE id=:id",ver=data.version_id,id=data.document_id)
        elif action=="revoke":
            if doc["active_version"]!=data.version_id: conflict()
            execute(c,"UPDATE ai.knowledge_documents SET active_version=NULL WHERE id=:id",id=data.document_id)
        elif action=="reindex":
            # Up to three claims per job. An explicit retry creates a new durable job.
            if execute(c,"SELECT EXISTS(SELECT 1 FROM ai.knowledge_jobs WHERE version_id=:id AND status IN ('queued','running'))",id=data.version_id).scalar_one(): conflict()
            self._queue(c,data.version_id)
        else: raise KnowledgeError(400,"invalid_action","Thao tác không hợp lệ.")
        execute(c,"UPDATE ai.knowledge_documents SET revision=revision+1,updated_at=now() WHERE id=:id",id=data.document_id)
        return data.document_id,data.version_id

    @staticmethod
    def _queue(c,version_id):
        execute(c,"INSERT INTO ai.knowledge_jobs(id,version_id) VALUES(:id,:ver)",id=uuid4(),ver=version_id)
        execute(c,"UPDATE ai.knowledge_versions SET index_status='queued' WHERE id=:id",id=version_id)

    def claim(self):
        with self.engine.begin() as c:
            # Recover crashed workers; attempts are durable, never an unbounded retry loop.
            execute(c,"UPDATE ai.knowledge_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error_code='worker_interrupted',updated_at=now() WHERE status='running' AND lease_until<now()")
            execute(c,"UPDATE ai.knowledge_versions v SET index_status='failed' WHERE index_status='running' AND EXISTS(SELECT 1 FROM ai.knowledge_jobs j WHERE j.version_id=v.id AND j.status='failed') AND NOT EXISTS(SELECT 1 FROM ai.knowledge_jobs j WHERE j.version_id=v.id AND j.status IN ('queued','running'))")
            job=execute(c,"SELECT id,version_id FROM ai.knowledge_jobs WHERE status='queued' AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1").mappings().first()
            if not job: return None
            attempt=execute(c,"UPDATE ai.knowledge_jobs SET status='running',attempts=attempts+1,lease_until=now()+interval '120 seconds',updated_at=now() WHERE id=:id RETURNING attempts",id=job["id"]).scalar_one()
            execute(c,"UPDATE ai.knowledge_versions SET index_status='running' WHERE id=:id",id=job["version_id"])
            version=execute(c,"SELECT * FROM ai.knowledge_versions WHERE id=:id",id=job["version_id"]).mappings().one()
            return {**dict(version),"job_id":job["id"],"claimed_attempt":attempt}

    async def process_one(self):
        job=await asyncio.to_thread(self.claim)
        if not job: return False
        try:
            chunks=chunk_text(job["content"])
            vectors=await self.embedding.embed([section+"\n"+content for section,content in chunks])
            await asyncio.to_thread(self.finish,job,chunks,vectors)
        except (ProviderUnavailable,ValueError):
            await asyncio.to_thread(self.fail,job,"embedding_unavailable")
        return True

    def finish(self,job,chunks,vectors):
        if len(chunks)!=len(vectors): raise ValueError("Embedding count mismatch")
        with self.engine.begin() as c:
            current=execute(c,"SELECT status,attempts,lease_until>now() AS valid FROM ai.knowledge_jobs WHERE id=:id FOR UPDATE",id=job["job_id"]).mappings().one()
            if current["status"]!="running" or not current["valid"] or current["attempts"]!=job["claimed_attempt"]: return
            for ordinal,((section,content),embedding) in enumerate(zip(chunks,vectors)):
                execute(c,"""INSERT INTO ai.knowledge_chunks(id,version_id,ordinal,section,content,embedding,embedding_model)
                  VALUES(:id,:ver,:ordinal,:section,:content,CAST(:embedding AS ai.vector),:model)
                  ON CONFLICT(version_id,ordinal) DO UPDATE SET embedding=excluded.embedding,embedding_model=excluded.embedding_model""",
                  id=uuid5(job["id"],str(ordinal)),ver=job["id"],ordinal=ordinal,section=section,content=content,embedding=vector_literal(embedding),model=MODEL)
            execute(c,"UPDATE ai.knowledge_jobs SET status='succeeded',error_code=NULL,lease_until=NULL,updated_at=now() WHERE id=:id",id=job["job_id"])
            execute(c,"UPDATE ai.knowledge_versions SET index_status='ready' WHERE id=:id",id=job["id"])

    def fail(self,job,code):
        with self.engine.begin() as c:
            changed=execute(c,"UPDATE ai.knowledge_jobs SET status='failed',error_code=:code,lease_until=NULL,updated_at=now() WHERE id=:id AND status='running' AND lease_until>now() AND attempts=:attempt",id=job["job_id"],code=code,attempt=job["claimed_attempt"]).rowcount
            if changed: execute(c,"UPDATE ai.knowledge_versions SET index_status='failed' WHERE id=:id",id=job["id"])

    @staticmethod
    def _eligible():
        return """FROM ai.knowledge_chunks ch JOIN ai.knowledge_versions v ON ch.version_id=v.id
          JOIN ai.knowledge_documents d ON d.active_version=v.id
          WHERE (v.product_slug IS NULL OR v.product_slug=:slug)
          AND (NOT :safety OR (v.evidence_type='safety_evidence' AND v.topic='safety' AND v.product_slug=:slug))"""

    @staticmethod
    def _fields():
        return 'ch.id AS chunk_id,d.id AS document_id,v.id AS version_id,v.title,v.number AS version,ch.section,ch.content,v.source_label,v.product_slug,v.evidence_type,v.topic'

    def resolve(self,ids,slug=None,safety=False):
        if not ids: return []
        with self.engine.connect() as c:
            rows=execute(c,"SELECT "+self._fields()+" "+self._eligible()+" AND ch.id=ANY(CAST(:ids AS uuid[]))",ids=[str(i) for i in ids],slug=slug,safety=safety).mappings().all()
            by_id={str(r["chunk_id"]):Excerpt.model_validate(dict(r)) for r in rows}
            return [by_id[str(i)] for i in ids if str(i) in by_id]

    async def retrieve(self,query,slug=None,safety=False,topic=None):
        def exists():
            with self.engine.connect() as c:
                return execute(c,"SELECT EXISTS(SELECT 1 "+self._eligible()+" AND (CAST(:topic AS text) IS NULL OR v.topic=:topic))",slug=slug,safety=safety,topic=topic).scalar_one()
        if not await asyncio.to_thread(exists): return []
        embedding=(await self.embedding.embed([query],query=True))[0]
        def search():
            with self.engine.connect() as c:
                rows=execute(c,"SELECT "+self._fields()+",ch.embedding <=> CAST(:embedding AS ai.vector) AS distance "+self._eligible()+" AND (CAST(:topic AS text) IS NULL OR v.topic=:topic) ORDER BY distance,ch.id LIMIT 4",slug=slug,safety=safety,topic=topic,embedding=vector_literal(embedding)).mappings().all()
                return [Excerpt.model_validate({k:v for k,v in dict(r).items() if k!='distance'}) for r in rows if r["distance"]<=0.50]
        return await asyncio.to_thread(search)

    def feedback(self,data):
        with self.engine.begin() as c:
            execute(c,"SELECT pg_advisory_xact_lock(:key)",key=int.from_bytes(data.request_id.bytes[:8],signed=True))
            existing=execute(c,"SELECT chunk_id,useful FROM ai.knowledge_feedback WHERE request_id=:id",id=data.request_id).mappings().first()
            if existing:
                if existing["chunk_id"]!=data.chunk_id or existing["useful"]!=data.useful: conflict()
                return
            if not execute(c,"SELECT EXISTS(SELECT 1 FROM ai.knowledge_chunks ch JOIN ai.knowledge_documents d ON d.active_version=ch.version_id WHERE ch.id=:id)",id=data.chunk_id).scalar_one(): raise KnowledgeError(404,"source_unavailable","Nguồn không còn được công bố.")
            execute(c,"INSERT INTO ai.knowledge_feedback(id,chunk_id,useful,request_id) VALUES(:id,:chunk,:useful,:request) ON CONFLICT(request_id) DO NOTHING",id=uuid4(),chunk=data.chunk_id,useful=data.useful,request=data.request_id)
