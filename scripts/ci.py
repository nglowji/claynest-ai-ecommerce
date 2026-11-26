"""Run CI against db-test only. Does not configure, start, stop or reset the main application."""
import argparse
import os
from pathlib import Path
import subprocess
from ops_common import ROOT, COMPOSE


def compose(*args):
    subprocess.run(COMPOSE + list(args), cwd=ROOT, check=True)


def backend():
    compose("--profile", "e2e", "stop", "e2e-api", "e2e-ai", "db-test")
    compose("--profile", "test", "build", "api-tests", "ai-tests")
    try:
        compose("--profile", "test", "run", "--rm", "api-tests", "--logger", "console;verbosity=minimal")
        compose("--profile", "test", "run", "--rm", "ai-tests")
    finally:
        compose("--profile", "test", "stop", "db-test")


def browser(shard, shards, suites=None):
    if not 0 <= shard < shards <= 20:
        raise ValueError("Invalid browser shard")
    known = sorted(p.name for p in (ROOT / "frontend/tests/e2e").glob("*.spec.ts"))
    if suites and not set(suites).issubset(known):
        raise ValueError("Unknown test suite")
    selected = sorted(suites or known)[shard::shards]
    if not selected:
        raise ValueError("Empty browser shard")
    mailbox = ROOT / ".local/test-mail"
    mailbox.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        # Only synthetic test email enters this directory; the API runs as a non-root UID.
        mailbox.chmod(0o777)
    compose("--profile", "e2e", "build", "e2e-api", "e2e-bootstrap", "e2e-ai", "frontend-tests")
    try:
        for suite in selected:
            # Fresh fixtures and request limits per suite; production limits are unchanged.
            compose("--profile", "e2e", "stop", "e2e-api", "e2e-ai", "db-test")
            compose("--profile", "e2e", "up", "-d", "--wait", "e2e-api")
            compose("--profile", "e2e", "run", "--rm", "--no-deps", "frontend-tests",
                    "node", "node_modules/@playwright/test/cli.js", "test", suite)
    finally:
        compose("--profile", "e2e", "stop", "e2e-api", "e2e-ai", "db-test")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["backend", "browser"])
    parser.add_argument("--shard", type=int, default=0)
    parser.add_argument("--shards", type=int, default=1)
    parser.add_argument("--suite", action="append")
    args = parser.parse_args()
    if args.mode == "backend":
        backend()
    else:
        browser(args.shard, args.shards, args.suite)
