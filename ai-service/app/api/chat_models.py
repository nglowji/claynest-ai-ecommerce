from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

class Contract(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid", hide_input_in_errors=True)

class Filters(Contract):
    q: str | None = Field(default=None, max_length=180)
    category: str | None = Field(default=None, max_length=100)
    min_price: int | None = Field(default=None, ge=0, le=1_000_000_000)
    max_price: int | None = Field(default=None, ge=0, le=1_000_000_000)
    glaze: str | None = Field(default=None, max_length=120)
    use: str | None = Field(default=None, max_length=160)
    in_stock: bool = True
    max_height_cm: float | None = Field(default=None, ge=0.01, le=1000)
    min_capacity_ml: int | None = Field(default=None, ge=1, le=100000)

    @model_validator(mode="after")
    def ordered_prices(self):
        if self.min_price is not None and self.max_price is not None and self.min_price > self.max_price:
            raise ValueError("Invalid price range")
        return self

class Turn(Contract):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)

class ChatInput(Contract):
    message: str = Field(min_length=1, max_length=1200)
    history: list[Turn] | None = Field(default=None, max_length=6)
    filters: Filters | None = None

KnowledgeKey = Literal["about", "catalog", "cart", "checkout", "payment", "shipping", "tracking", "order-status", "account", "location", "returns", "safety", "assistant"]

class KnowledgeArticle(Contract):
    key: KnowledgeKey
    title: str = Field(max_length=180)
    version: str = Field(max_length=40)
    content: str = Field(max_length=2000)
    url: str = Field(max_length=160, pattern=r"^/([a-zA-Z0-9#][a-zA-Z0-9/#?=&%_-]*)?$")

class CatalogIndexEntry(Contract):
    name: str = Field(max_length=180)
    slug: str = Field(max_length=140, pattern=r"^[a-z0-9-]+$")
    category: str = Field(max_length=100)
    material: str = Field(max_length=160)

class StoreContext(Contract):
    knowledge: list[KnowledgeArticle] = Field(max_length=30)
    catalog: list[CatalogIndexEntry] = Field(max_length=100)
    catalog_truncated: bool

class Intent(Contract):
    topic: Literal["recommend", "detail", "policy", "safety", "order", "other", "knowledge"]
    filters: Filters
    slug: str | None = Field(default=None, max_length=140, pattern=r"^[a-z0-9-]+$")
    knowledge_key: KnowledgeKey | None = None
    style: str = Field(default="", max_length=80)
    occasion: str = Field(default="", max_length=80)

class Choice(Contract):
    variant_id: UUID
    reason: Literal["match", "budget", "glaze", "size", "gift", "everyday", "decor"]

class Ranking(Contract):
    choices: list[Choice] = Field(max_length=3)

class Decision(Contract):
    knowledge_key: KnowledgeKey | None = None
    topic: Literal["recommend", "detail", "policy", "safety", "order", "other", "knowledge"]
    filters: Filters
    choices: list[Choice] = Field(default_factory=list, max_length=3)

class Fact(Contract):
    variant_id: UUID
    product_id: UUID
    name: str = Field(max_length=180)
    slug: str = Field(max_length=140, pattern=r"^[a-z0-9-]+$")
    sku: str = Field(max_length=64)
    variant_name: str = Field(max_length=120)
    description: str = Field(max_length=350)
    material: str = Field(max_length=160)
    glaze: str = Field(max_length=120)
    use: str = Field(max_length=160)
    price_vnd: int = Field(gt=0, le=1_000_000_000)
    stock_qty: int = Field(ge=0)
    height_cm: float | None
    capacity_ml: int | None
    image: str = Field(max_length=500)
