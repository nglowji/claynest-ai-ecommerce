"""Knowledge documents, immutable versions, scoped chunks, durable indexing jobs and feedback.
Embedding model gemini-embedding-001, explicitly verified 768 dimensions before migration.
"""
from alembic import op
revision = "0001_knowledge"
down_revision = None
branch_labels = depends_on = None

def upgrade():
    op.execute("""
    CREATE TABLE ai.knowledge_documents (
      id uuid PRIMARY KEY, title varchar(180) NOT NULL, revision integer NOT NULL DEFAULT 1,
      active_version uuid NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE ai.knowledge_versions (
      id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES ai.knowledge_documents(id), number integer NOT NULL,
      title varchar(180) NOT NULL, content text NOT NULL, content_hash char(64) NOT NULL, source_label varchar(300) NOT NULL,
      topic varchar(30) NOT NULL, product_slug varchar(140) NULL, evidence_type varchar(30) NOT NULL,
      index_status varchar(20) NOT NULL DEFAULT 'queued', created_by varchar(100) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,number),
      CHECK (index_status IN ('queued','running','ready','failed')),
      CHECK (evidence_type IN ('general','safety_evidence')));
    ALTER TABLE ai.knowledge_documents ADD CONSTRAINT fk_active_version FOREIGN KEY(active_version) REFERENCES ai.knowledge_versions(id);
    CREATE TABLE ai.knowledge_chunks (
      id uuid PRIMARY KEY, version_id uuid NOT NULL REFERENCES ai.knowledge_versions(id), ordinal integer NOT NULL,
      section varchar(180) NOT NULL, content text NOT NULL, embedding ai.vector(768) NOT NULL,
      embedding_model varchar(60) NOT NULL CHECK(embedding_model='gemini-embedding-001'),
      UNIQUE(version_id,ordinal));
    CREATE INDEX ix_knowledge_chunks_version ON ai.knowledge_chunks(version_id);
    CREATE TABLE ai.knowledge_jobs (
      id uuid PRIMARY KEY, version_id uuid NOT NULL REFERENCES ai.knowledge_versions(id),
      status varchar(20) NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0,
      lease_until timestamptz NULL, error_code varchar(60) NULL, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), CHECK(status IN ('queued','running','succeeded','failed')));
    CREATE UNIQUE INDEX ix_knowledge_active_job ON ai.knowledge_jobs(version_id) WHERE status IN ('queued','running');
    CREATE TABLE ai.knowledge_commands (
      request_id uuid PRIMARY KEY, payload_hash char(64) NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE ai.knowledge_audit (
      id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES ai.knowledge_documents(id), version_id uuid NOT NULL REFERENCES ai.knowledge_versions(id),
      action varchar(30) NOT NULL, actor_id varchar(100) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE ai.knowledge_feedback (
      id uuid PRIMARY KEY, chunk_id uuid NOT NULL REFERENCES ai.knowledge_chunks(id), useful boolean NOT NULL,
      request_id uuid NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION ai.prevent_knowledge_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Knowledge history is append only'; END $$;
    CREATE TRIGGER knowledge_audit_append_only BEFORE UPDATE OR DELETE ON ai.knowledge_audit
      FOR EACH ROW EXECUTE FUNCTION ai.prevent_knowledge_history_mutation();
    CREATE FUNCTION ai.prevent_knowledge_version_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF (NEW.title,NEW.content,NEW.content_hash,NEW.document_id,NEW.number,NEW.source_label,NEW.topic,NEW.product_slug,NEW.evidence_type,NEW.created_by)
        IS DISTINCT FROM (OLD.title,OLD.content,OLD.content_hash,OLD.document_id,OLD.number,OLD.source_label,OLD.topic,OLD.product_slug,OLD.evidence_type,OLD.created_by)
      THEN RAISE EXCEPTION 'Knowledge versions are immutable'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER knowledge_version_immutable BEFORE UPDATE ON ai.knowledge_versions
      FOR EACH ROW EXECUTE FUNCTION ai.prevent_knowledge_version_rewrite();
    """)

def downgrade():
    raise RuntimeError("Destructive knowledge downgrade is deliberately unsupported; restore a reviewed backup instead")
