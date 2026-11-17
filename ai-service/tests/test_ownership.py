import os

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import Settings
from app.db.session import build_engine

pytestmark = pytest.mark.skipif(os.environ.get("AI_INTEGRATION_TESTS") != "1", reason="Use Compose test profile for PostgreSQL integration tests")


def test_ai_owns_ai_schema_and_can_use_vector():
    engine = build_engine(Settings().database_url)
    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT current_user")) == "ai_app"
            assert connection.scalar(text("SELECT current_schema()")) == "ai"
            assert connection.scalar(text("SELECT has_schema_privilege(current_user, 'ai', 'CREATE')"))
            assert not connection.scalar(text("SELECT has_schema_privilege(current_user, 'commerce', 'USAGE')"))
            assert connection.scalar(text("SELECT '[1,2,3]'::ai.vector <-> '[1,2,3]'::ai.vector")) == 0
    finally:
        engine.dispose()


def test_database_denies_ai_commerce_mutation():
    engine = build_engine(Settings().database_url)
    try:
        with engine.connect() as connection:
            with pytest.raises(DBAPIError) as failure:
                connection.execute(text("CREATE TABLE commerce.__forbidden_probe (id integer)"))
            assert failure.value.orig.sqlstate == "42501"
            connection.rollback()
    finally:
        engine.dispose()
