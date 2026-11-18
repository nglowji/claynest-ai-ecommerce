import json
import httpx
from pydantic import TypeAdapter, ValidationError
from app.api.chat_models import Fact, StoreContext
from app.core.config import Settings
from app.core.logging import correlation_context
from app.core.service_auth import headers
from app.llm.gemini import ProviderUnavailable

class CatalogTools:
    def __init__(self, config: Settings, client: httpx.AsyncClient):
        self.config, self.client = config, client

    async def read(self, name: str, payload: dict):
        if name not in {"search","detail","policy","context"}:
            raise ProviderUnavailable()
        path = "/internal/ai/tools/" + name
        body = json.dumps(payload,separators=(",",":"),ensure_ascii=False).encode()
        secret = self.config.tool_secret.get_secret_value()
        if len(secret) < 32:
            raise ProviderUnavailable()
        for attempt in range(2):
            try:
                response = await self.client.post(self.config.commerce_base_url.rstrip("/")+path,content=body,
                    headers={**headers(secret,path,"catalog:read",body),"X-Correlation-ID":correlation_context.get()},timeout=3)
                if response.status_code >= 500 and attempt == 0:
                    continue
                if response.status_code != 200 or len(response.content) > 65536:
                    raise ProviderUnavailable()
                data = response.json()
                if name == "context":
                    return StoreContext.model_validate(data)
                if name == "policy":
                    if not isinstance(data,dict) or not isinstance(data.get("shipping"),str):
                        raise ProviderUnavailable()
                    return data
                result = TypeAdapter(list[Fact]).validate_python(data)
                if len(result) > 8:
                    raise ProviderUnavailable()
                return result
            except httpx.HTTPError:
                if attempt == 0:
                    continue
                raise ProviderUnavailable() from None
            except (ValueError,ValidationError):
                raise ProviderUnavailable() from None
        raise ProviderUnavailable()
