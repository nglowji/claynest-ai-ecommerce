"""Restore a trusted local bundle only into disposable db-restore; production restore is intentionally excluded."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import tarfile
import uuid
from backup import ARCHIVES, FILES
from ops_common import ROOT, archive_contents, compose, query, sha256, snapshot


def validate_bundle(folder):
    folder = Path(folder).resolve(strict=True)
    if not folder.is_relative_to((ROOT / ".local" / "backups").resolve()) or folder.name.endswith(".partial"):
        raise ValueError("Only complete private local backups are allowed")
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("format") != 1 or set(manifest.get("files", {})) != set(FILES):
        raise ValueError("Unsupported recovery bundle")
    for name in FILES:
        if sha256(folder / name) != manifest["files"][name]:
            raise ValueError("Backup checksum mismatch")
    for name in ARCHIVES:
        if archive_contents(folder / name) != manifest["assets"][name]:
            raise ValueError("Backup media manifest mismatch")
    return folder, manifest


def drill(folder):
    folder, manifest = validate_bundle(folder)
    # No drop/create/restore command accepts an arbitrary DB service or database name.
    source_before = snapshot("db")
    output = ROOT / ".local" / "restore-drills" / uuid.uuid4().hex
    output.mkdir(parents=True, mode=0o700)
    try:
        compose("--profile", "recovery", "stop", "db-restore")
        compose("--profile", "recovery", "up", "-d", "--wait", "db-restore")
        actual = query("db-restore", "SELECT current_database();").decode().strip()
        if actual != "claynest_restore":
            raise RuntimeError("Restore target guard rejected the database")
        with (folder / "database.dump").open("rb") as source:
            compose("exec", "-T", "db-restore", "sh", "-c",
                'exec pg_restore --exit-on-error --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"', stdin=source)
        restored = snapshot("db-restore")
        if restored != manifest["tables"]:
            raise RuntimeError("Restored table counts or fingerprints differ from the backup")
        permissions = query("db-restore", """SELECT
          has_schema_privilege('commerce_app','commerce','USAGE') AND
          has_schema_privilege('ai_app','ai','USAGE') AND
          NOT has_schema_privilege('commerce_app','ai','USAGE') AND
          NOT has_schema_privilege('ai_app','commerce','USAGE');""").decode().strip()
        if permissions != "t":
            raise RuntimeError("Restored schema permissions differ from the expected isolation")
        for name, directory in (("keys.tar.gz", "keys"), ("images.tar.gz", "images"), ("storefront.tar.gz", "storefront")):
            destination = output / directory
            destination.mkdir(mode=0o700)
            with tarfile.open(folder / name, "r:gz") as archive:
                archive.extractall(destination, filter="data")
            extracted = {p.relative_to(destination).as_posix(): sha256(p) for p in destination.rglob("*") if p.is_file()}
            if extracted != manifest["assets"][name]:
                raise RuntimeError("Extracted assets differ from the backup")
        if snapshot("db") != source_before:
            raise RuntimeError("Source changed during drill; source equality could not be established")
        report = {"verifiedAt": datetime.now(timezone.utc).isoformat(), "backup": folder.name,
                  "tablesVerified": len(restored), "assetsVerified": sum(len(v) for v in manifest["assets"].values()),
                  "schemaIsolation": True, "sourceUnchanged": True, "target": "db-restore/claynest_restore"}
        (output / "verification.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Restore drill passed: {len(restored)} tables; keys/images and schema permissions verified.")
        print(f"Private report: {output.relative_to(ROOT)}/verification.json")
        return report
    finally:
        compose("--profile", "recovery", "stop", "db-restore")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", help="Complete directory under .local/backups")
    args = parser.parse_args()
    try:
        drill(args.backup)
    except (RuntimeError, OSError, ValueError, KeyError, tarfile.TarError):
        raise SystemExit("Restore drill failed. Target was isolated; private artifacts retained for inspection.")
