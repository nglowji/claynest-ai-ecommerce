from pathlib import Path
from alembic import command
from alembic.config import Config

def migrate():
    config_path=Path.cwd() / "alembic.ini"
    if not config_path.is_file():
        raise RuntimeError("Run knowledge migrations from the ai-service application directory")
    command.upgrade(Config(str(config_path)), "head")

if __name__ == "__main__":
    migrate()
