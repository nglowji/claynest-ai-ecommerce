"""Recovery validation tests use only temporary directories, never Docker or a real DB."""
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backup import ARCHIVES, FILES, backup
from ops_common import archive_contents, query, sha256
from restore_drill import validate_bundle


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.folder = self.root / ".local/backups/complete"
        self.folder.mkdir(parents=True)
        self.patch = patch("restore_drill.ROOT", self.root)
        self.patch.start(); self.addCleanup(self.patch.stop)
        for name in FILES:
            (self.folder / name).write_bytes(b"synthetic backup fixture")
        for name in ARCHIVES:
            with tarfile.open(self.folder / name, "w:gz") as output:
                info = tarfile.TarInfo("file.txt"); info.size = 7
                output.addfile(info, io.BytesIO(b"fixture"))
        self.manifest = {"format": 1, "files": {name: sha256(self.folder / name) for name in FILES},
                         "assets": {name: archive_contents(self.folder / name) for name in ARCHIVES}, "tables": []}
        self.save()

    def save(self):
        (self.folder / "manifest.json").write_text(json.dumps(self.manifest), encoding="utf-8")

    def test_complete_bundle_verifies_without_revealing_values(self):
        folder, manifest = validate_bundle(self.folder)
        self.assertEqual(self.folder.resolve(), folder)
        self.assertEqual(manifest["files"], self.manifest["files"])

    def test_tampered_dump_is_rejected_before_restore(self):
        (self.folder / "database.dump").write_bytes(b"modified")
        with self.assertRaisesRegex(ValueError, "checksum"):
            validate_bundle(self.folder)

    def test_incomplete_backup_cannot_be_selected(self):
        partial = self.folder.with_name("interrupted.partial")
        self.folder.rename(partial)
        with self.assertRaises(ValueError):
            validate_bundle(partial)

    def test_arbitrary_external_path_cannot_be_selected(self):
        with self.assertRaises(ValueError):
            validate_bundle(self.root)

    def test_unknown_archive_format_is_rejected(self):
        self.manifest["format"] = 2; self.save()
        with self.assertRaises(ValueError):
            validate_bundle(self.folder)

    def test_unexpected_file_name_cannot_be_injected(self):
        self.manifest["files"]["../outside"] = "wrong"; self.save()
        with self.assertRaises(ValueError):
            validate_bundle(self.folder)

    def test_archive_links_and_parent_traversal_are_rejected(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("link", tarfile.SYMTYPE), ("hardlink", tarfile.LNKTYPE)]:
            with self.subTest(name=name):
                path = self.folder / "unsafe.tar.gz"
                with tarfile.open(path, "w:gz") as output:
                    info = tarfile.TarInfo(name); info.type = kind; info.linkname = "../escape"
                    output.addfile(info)
                with self.assertRaises(ValueError):
                    archive_contents(path)

    def test_backup_failure_resumes_the_originally_running_writers(self):
        with patch("backup.ROOT", self.root), patch("backup.running_apps", return_value=["api", "ai-service"]), \
             patch("backup.compose") as command, patch("backup.run", side_effect=RuntimeError("Synthetic interruption")):
            with self.assertRaises(RuntimeError):
                backup()
            self.assertEqual(command.call_args_list[0].args, ("stop", "api", "ai-service"))
            self.assertEqual(command.call_args_list[-1].args, ("up", "-d", "--no-deps", "--wait", "api", "ai-service"))
        partial = list((self.root / ".local/backups").glob("*.partial"))
        self.assertEqual(len(partial), 1)

    def test_database_query_guard_rejects_unapproved_services(self):
        for service in ("api", "db-test", "user-input"):
            with self.assertRaises(ValueError):
                query(service, "SELECT 1")


if __name__ == "__main__":
    unittest.main()
