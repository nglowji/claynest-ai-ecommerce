from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def build_engine(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 3, "options": "-c search_path=ai"})


def check_database(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
