"""Run only the isolated localhost HTTPS release rehearsal. Never deploy the live project."""
import argparse
from pathlib import Path
import subprocess
from configure_release import configure
from ops_common import ROOT

ENVIRONMENT = ROOT / ".local/rehearsal.env"
COMMAND = ["docker", "compose", "--project-name", "nanggom-rehearsal", "--env-file", str(ENVIRONMENT),
           "-f", str(ROOT / "compose.production.yml"), "-f", str(ROOT / "compose.rehearsal.yml")]


def compose(*args, stdin=None, check=True):
    result = subprocess.run(COMMAND + list(args), cwd=ROOT, stdin=stdin, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        # Compose can resolve secrets into config/errors. Retain diagnostic output privately.
        (ROOT / ".local/rehearsal-error.log").write_bytes(result.stderr)
        raise RuntimeError(f"Rehearsal operation failed (exit {result.returncode}); see private diagnostic log.")
    return result


def up():
    configure(rehearsal=True)
    compose("config", "--quiet")
    print("Building isolated production images...", flush=True)
    compose("build", "api", "ai-service", "web")
    print("Applying migrations with deployment identities...", flush=True)
    compose("up", "-d", "--wait", "db")
    compose("run", "--rm", "--no-deps", "api-migrate")
    compose("run", "--rm", "--no-deps", "ai-migrate")
    compose("run", "--rm", "--no-deps", "runtime-grants")
    # Seed only this disposable rehearsal project, never the main or public production database.
    compose("--profile", "setup", "run", "--rm", "--no-deps", "bootstrap", "--bootstrap-auth", "--seed-catalog")
    print("Starting HTTPS proxy and restricted application identities...", flush=True)
    compose("up", "-d", "--wait", "api", "ai-service", "web")
    certificate = compose("exec", "-T", "web", "cat", "/data/caddy/pki/authorities/local/root.crt").stdout
    (ROOT / ".local/rehearsal-ca.crt").write_bytes(certificate)
    print("Rehearsal ready at https://localhost:8443. CA saved locally; system trust was not changed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["up", "stop"])
    args = parser.parse_args()
    try:
        if args.command == "up": up()
        else:
            compose("stop", "web", "api", "ai-service", "db")
            print("Rehearsal stopped; volumes retained. Main application untouched.")
    except (RuntimeError, OSError):
        raise SystemExit("Rehearsal did not complete. Main application was not changed; inspect .local/rehearsal-error.log.")
