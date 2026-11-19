import math
import httpx
from app.llm.gemini import ProviderUnavailable
from app.core.logging import application_logger

MODEL = "gemini-embedding-001"
DIMENSIONS = 768

def normalized(values):
    if not isinstance(values,list) or len(values)!=DIMENSIONS or any(type(v) not in (int,float) or not math.isfinite(v) for v in values):
        raise ProviderUnavailable()
    norm=math.sqrt(sum(v*v for v in values))
    if norm < 1e-12: raise ProviderUnavailable()
    return [v/norm for v in values]

def vector_literal(values):
    return "[" + ",".join(format(v,".9g") for v in normalized(values)) + "]"

class GeminiEmbedding:
    def __init__(self, config, network): self.config,self.network=config,network
    async def embed(self, texts, query=False):
        if not texts or len(texts)>32 or any(len(t)>2500 for t in texts): raise ProviderUnavailable()
        key=self.config.gemini_api_key.get_secret_value()
        if not key: raise ProviderUnavailable()
        requests=[{"model":"models/"+MODEL,"content":{"parts":[{"text":t}]},"taskType":"RETRIEVAL_QUERY" if query else "RETRIEVAL_DOCUMENT","outputDimensionality":DIMENSIONS} for t in texts]
        try:
            response=await self.network.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:batchEmbedContents",json={"requests":requests},headers={"x-goog-api-key":key},timeout=20)
            if response.status_code!=200:
                application_logger().warning("embedding_http_error",extra={"status_code":response.status_code,"model":MODEL})
                raise ProviderUnavailable()
            if len(response.content)>1000000: raise ProviderUnavailable()
            values=response.json()["embeddings"]
            if len(values)!=len(texts): raise ProviderUnavailable()
            return [normalized(item["values"]) for item in values]
        except (httpx.HTTPError,ValueError,KeyError,TypeError): raise ProviderUnavailable() from None
