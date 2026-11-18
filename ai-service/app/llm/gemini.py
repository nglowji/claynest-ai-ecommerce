import json
from typing import TypeVar
import httpx
from pydantic import BaseModel, ValidationError
from app.core.config import Settings
from app.core.logging import application_logger

class ProviderUnavailable(Exception):
    pass

T = TypeVar("T", bound=BaseModel)

class GeminiProvider:
    def __init__(self, config: Settings, client: httpx.AsyncClient):
        self.config, self.client = config, client

    async def complete(self, schema: type[T], system: str, payload: dict) -> T:
        key = self.config.gemini_api_key.get_secret_value()
        if not key:
            raise ProviderUnavailable()
        try:
            response = await self.client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.config.gemini_model}:generateContent",
                headers={"x-goog-api-key":key},
                json={"systemInstruction":{"parts":[{"text":system}]},
                      "contents":[{"role":"user","parts":[{"text":json.dumps(payload,ensure_ascii=False)}]}],
                      "generationConfig":{"temperature":0.1,"maxOutputTokens":self.config.max_output_tokens,
                          "responseMimeType":"application/json","responseJsonSchema":schema.model_json_schema(by_alias=True)}},
                timeout=16,
            )
            if response.status_code != 200:
                application_logger().warning("gemini_http_error", extra={"status_code": response.status_code, "model": self.config.gemini_model})
                raise ProviderUnavailable()
            if len(response.content) > 65536:
                raise ProviderUnavailable()
            data = response.json()
            usage = data.get("usageMetadata",{})
            def count(name):
                value = usage.get(name,0)
                return value if type(value) is int and 0 <= value <= 10000000 else 0
            application_logger().info("gemini_usage",extra={"model":self.config.gemini_model,
                "input_tokens":count("promptTokenCount"),"output_tokens":count("candidatesTokenCount"),"total_tokens":count("totalTokenCount")})
            candidate = data.get("candidates",[])[0]
            if candidate.get("finishReason") != "STOP":
                raise ProviderUnavailable()
            text = "".join(p.get("text","") for p in candidate["content"]["parts"] if not p.get("thought",False))
            return schema.model_validate_json(text)
        except (httpx.HTTPError, ValueError, KeyError, IndexError, ValidationError):
            # Never propagate provider response bodies, prompts, headers or API keys.
            raise ProviderUnavailable() from None
