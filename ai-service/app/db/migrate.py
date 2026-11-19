from pathlib import Path
from alembic import command
from alembic.config import Config

def migrate():
    command.upgrade(Config(str(Path(__file__).resolve().parents[2] / "alembic.ini")), "head")

if __name__ == "__main__":
    migrate()
