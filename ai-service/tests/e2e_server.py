"""Isolated browser fixture server. Never selected by the production entry point."""
import os
from sqlalchemy.engine import make_url
from app.main import create_app
from app.core.config import Settings
from app.api.chat_models import Intent, Filters
from app.rag.contracts import PassageSelection
from app.rag.embedding import DIMENSIONS
from app.llm.admin_advisor import AdminSelection

config=Settings(knowledge_worker_enabled=True)
url=make_url(config.database_url)
if os.environ.get("AI_INTEGRATION_TESTS")!="1" or url.host!="db-test" or url.database!="claynest_test":
    raise RuntimeError("Fixture provider is restricted to the isolated test database")
app=create_app(config)
class Embedding:
    async def embed(self,texts,query=False): return [[1.0]+[0.0]*(DIMENSIONS-1) for _ in texts]
class Provider:
    async def complete(self,schema,system,payload):
        if schema is AdminSelection:
            if "RAG" in payload["message"]:
                return AdminSelection(chunk_ids=[p["chunkId"] for p in payload["retrievedPassages"][:1]])
            return AdminSelection(fact_ids=["sales", "pending", "low-stock"], guide_keys=["reports"])
        if schema is Intent: return Intent(topic="rag",filters=Filters())
        if schema is PassageSelection: return PassageSelection(chunk_ids=[p["chunkId"] for p in payload["passages"][:2]])
        raise RuntimeError("Unexpected fixture schema")
app.state.knowledge.embedding=Embedding()
app.state.advisor.provider=Provider()

app.state.admin_advisor.provider=Provider()
