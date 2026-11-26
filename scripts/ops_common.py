"""Private backup helpers. Database values and credentials never enter command output."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
COMPOSE = ["docker", "compose", "--project-directory", str(ROOT), "-f", str(ROOT / "docker-compose.yml")]


def run(args, *, stdout=subprocess.PIPE, stdin=None):
    result = subprocess.run(args, cwd=ROOT, stdin=stdin, stdout=stdout, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError(f"Operation failed ({args[0]} exit {result.returncode}); private command output suppressed.")
    return result.stdout


def compose(*args, **kwargs):
    return run(COMPOSE + list(args), **kwargs)


def query(service, sql):
    if service not in {"db", "db-restore"}:
        raise ValueError("Database service is not allowed")
    # A temporary file avoids command interpolation and keeps SQL separate from credentials.
    import tempfile
    with tempfile.TemporaryFile() as source:
        source.write(sql.encode("utf-8")); source.seek(0)
        return compose("exec", "-T", service, "sh", "-c",
            'exec psql -XAt --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"', stdin=source)


def snapshot(service):
    sql = """
    SELECT format('SELECT jsonb_build_object(''table'',%L,''rows'',count(*),''hash'',md5(coalesce(string_agg(md5(to_jsonb(t)::text), ORDER BY md5(to_jsonb(t)::text)),))) FROM %I.%I t;',
        schemaname || '.' || tablename, schemaname, tablename)
    FROM pg_tables WHERE schemaname IN ('commerce','ai') ORDER BY schemaname, tablename
    \gexec
    """
    result = [json.loads(line) for line in query(service, sql).decode().splitlines() if line.strip()]
    if not result:
        raise RuntimeError("Database has no application tables; refusing an unverified backup.")
    return sorted(result, key=lambda item: item["table"])


def sha256(path):
    with Path(path).open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def archive_contents(path):
    result = {}
    with tarfile.open(path, "r:gz") as archive:
        for member in archive:
            name = Path(member.name)
            if name.is_absolute() or ".." in name.parts or member.issym() or member.islnk():
                raise ValueError("Unsafe archive entry")
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError("Only regular files are supported")
            with archive.extractfile(member) as source:
                result[member.name.removeprefix("./")] = hashlib.file_digest(source, "sha256").hexdigest()
    return result


def running_apps():
    return sorted(set(compose("ps", "--services", "--status", "running").decode().split()) & {"api", "ai-service"})
