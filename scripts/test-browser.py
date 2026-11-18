"""Run real-browser tests only against the isolated Compose e2e API."""
import os
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
values = {}
for line in (root / ".env").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        key, value = line.split("=", 1)
        values[key] = value.strip().strip("\"'")
environment = os.environ.copy()
for key in ("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD"):
    environment[key] = values[key]
environment["API_PROXY_TARGET"] = "http://127.0.0.1:18000"
npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
if not npm:
    raise SystemExit("Node/npm is required.")
subprocess.run([npm, "run", "build"], cwd=root / "frontend", env=environment, check=True)
raise SystemExit(subprocess.run([npm, "run", "test:e2e"], cwd=root / "frontend", env=environment).returncode)
