from alembic import context
from sqlalchemy import text
from app.core.config import Settings
from app.db.session import build_engine

engine = build_engine(Settings().database_url)
with engine.connect() as connection:
    with connection.begin():
        connection.execute(text("SELECT pg_advisory_xact_lock(742019007)"))
        context.configure(connection=connection, version_table_schema="ai", transactional_ddl=True)
        with context.begin_transaction():
            context.run_migrations()
engine.dispose()
