"""Create a complete local recovery bundle; never overwrite or remove older backups."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import subprocess
import uuid
from ops_common import ROOT, archive_contents, compose, run, running_apps, sha256, snapshot

FILES = ("database.dump", "keys.tar.gz", "images.tar.gz", "environment.env")


def backup():
    parent = ROOT / ".local" / "backups"
    parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    name = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    target = parent / (name + ".partial")
    target.mkdir(mode=0o700)
    apps = running_apps()
    try:
        # Pause writers so the DB, encryption keys and uploaded media form one recovery point.
        if apps:
            print("Pausing API/AI writers for a consistent backup.", flush=True)
            compose("stop", *apps)
        revision = run(["git", "rev-parse", "HEAD"]).decode().strip()
        with (target / "database.dump").open("wb") as output:
            compose("exec", "-T", "db", "sh", "-c",
                'exec pg_dump --format=custom --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"', stdout=output)
        data = snapshot("db")
        # Reuse the API service volume definitions; no hard-coded Docker project volume names.
        for filename, source in (("keys.tar.gz", "/app/keys"), ("images.tar.gz", "/app/media/catalog")):
            with (target / filename).open("wb") as output:
                compose("run", "--rm", "--no-deps", "-T", "--entrypoint", "tar", "api", "-czf", "-", "-C", source, ".", stdout=output)
        shutil.copyfile(ROOT / ".env", target / "environment.env")
        files = {name: sha256(target / name) for name in FILES}
        assets = {name: archive_contents(target / name) for name in ("keys.tar.gz", "images.tar.gz")}
        if not assets["keys.tar.gz"]:
            raise RuntimeError("No DataProtection keys found; recovery bundle is incomplete.")
        manifest = {"format": 1, "createdAt": datetime.now(timezone.utc).isoformat(), "revision": revision,
                    "files": files, "tables": data, "assets": assets}
        (target / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        for path in target.iterdir():
            path.chmod(0o600)
        if snapshot("db") != data:
            raise RuntimeError("Source changed during backup; incomplete bundle was retained for inspection.")
        final = parent / name
        target.rename(final)
        print(f"Backup ready: {final.relative_to(ROOT)} ({len(data)} tables).", flush=True)
        return final
    finally:
        if apps:
            compose("up", "-d", "--no-deps", "--wait", *apps)
            print("API/AI writers resumed.", flush=True)


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    try:
        backup()
    except (RuntimeError, OSError, ValueError):
        raise SystemExit("Backup failed. Partial output retained privately; source database was not replaced.")
