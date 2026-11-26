"""Release configuration tests are filesystem-only and never launch Docker."""
from contextlib import redirect_stdout
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from configure_release import configure


class ReleaseConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(); self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        active = patch("configure_release.ROOT", self.root); active.start(); self.addCleanup(active.stop)

    def test_rehearsal_generates_separate_credentials_without_printing_them(self):
        output = io.StringIO()
        with redirect_stdout(output): path = configure(rehearsal=True)
        values = dict(line.split("=",1) for line in path.read_text(encoding="utf-8").splitlines() if "=" in line and not line.startswith("#"))
        keys = [key for key in values if "PASSWORD" in key or "SECRET" in key]
        secrets = [values[key] for key in keys if values[key]]
        self.assertEqual(len(set(secrets)), len(secrets))
        self.assertTrue(all(value not in output.getvalue() for value in secrets))
        self.assertEqual("localhost", values["SITE_DOMAIN"])
        self.assertEqual("", values["GEMINI_API_KEY"])

    def test_repeated_setup_preserves_every_existing_setting(self):
        with redirect_stdout(io.StringIO()):
            path = configure(rehearsal=True); before = path.read_bytes()
            self.assertEqual(path, configure(rehearsal=True))
        self.assertEqual(before, path.read_bytes())

    def test_public_release_does_not_copy_development_credentials(self):
        (self.root / ".env").write_text("POSTGRES_PASSWORD=existing-development-fixture", encoding="utf-8")
        with redirect_stdout(io.StringIO()): path = configure(domain="pottery.example")
        self.assertNotIn("existing-development-fixture", path.read_text(encoding="utf-8"))
        self.assertIn("SITE_DOMAIN=pottery.example", path.read_text(encoding="utf-8"))
        self.assertIn("SMTP_HOST=\n", path.read_text(encoding="utf-8"))

    def test_domain_rejects_url_port_and_injected_configuration(self):
        for domain in ("https://pottery.example", "pottery.example:443", "pottery.example/path", "x\nSMTP_HOST=other", "*"):
            with self.subTest(domain=domain), self.assertRaises(ValueError): configure(domain=domain)


if __name__ == "__main__": unittest.main()
