from typing import Literal
from uuid import UUID
from pydantic import Field, model_validator
from app.api.chat_models import Contract

Topic = Literal["care", "materials", "returns", "shipping", "safety", "about", "general"]

class DocumentInput(Contract):
    request_id: UUID
    document_id: UUID | None = None
    revision: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=3,max_length=180)
    content: str = Field(min_length=20,max_length=20000)
    source_label: str = Field(min_length=3,max_length=300)
    topic: Topic = "general"
    product_slug: str | None = Field(default=None,max_length=140,pattern=r"^[a-z0-9-]+$")
    evidence_type: Literal["general","safety_evidence"] = "general"
    file_name: str | None = Field(default=None,max_length=100)

    @model_validator(mode="after")
    def validate_source(self):
        import re
        if any(ord(c)<32 and c not in "\r\n\t" for c in self.content) or not self.content.strip():
            raise ValueError("Only plain UTF-8 text is supported")
        if self.file_name and (not self.file_name.lower().endswith((".txt",".md")) or any(c in self.file_name for c in "/\\")):
            raise ValueError("Only .txt/.md files are supported")
        if self.evidence_type == "safety_evidence" and (self.topic != "safety" or not self.product_slug):
            raise ValueError("Safety evidence must be scoped to one product")
        if self.document_id and self.revision is None:
            raise ValueError("Revision required")
        if re.search(r"AIza[A-Za-z0-9_-]{20,}|(?:GEMINI_API_KEY|ADMIN_PASSWORD|DATABASE_URL)\s*[:=]", self.content):
            raise ValueError("Credentials must not be uploaded")
        return self

class CommandInput(Contract):
    request_id: UUID
    document_id: UUID
    version_id: UUID
    revision: int = Field(ge=1)
    confirm_public: bool = False

class AdminEnvelope(Contract):
    action: Literal["list","detail","save","approve","revoke","reindex"]
    payload: dict
    actor_id: str = Field(min_length=1,max_length=100)

class ResolveInput(Contract):
    chunk_ids: list[UUID] = Field(max_length=3)
    product_slug: str | None = Field(default=None,max_length=140,pattern=r"^[a-z0-9-]+$")
    safety_only: bool = False

class FeedbackInput(Contract):
    request_id: UUID
    chunk_id: UUID
    useful: bool

class Excerpt(Contract):
    chunk_id: UUID
    document_id: UUID
    version_id: UUID
    title: str
    version: int
    section: str
    content: str
    source_label: str
    product_slug: str | None
    evidence_type: str
    topic: str

class PassageSelection(Contract):
    chunk_ids: list[UUID] = Field(max_length=2)

class KnowledgeError(Exception):
    def __init__(self, status, code, message):
        self.status, self.code, self.message = status, code, message
