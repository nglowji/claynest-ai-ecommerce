"""Create private deployment configuration without reusing development credentials."""
import argparse
from pathlib import Path
import re
import secrets
from ops_common import ROOT


def configure(rehearsal=False, domain=None):
    if domain and not re.fullmatch(r"(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?", domain):
        raise ValueError("Domain must be a hostname without protocol, port or path")
    folder = ROOT / ".local"
    folder.mkdir(exist_ok=True, mode=0o700)
    target = folder / ("rehearsal.env" if rehearsal else "production.env")
    if target.exists():
        print(f"Existing {target.relative_to(ROOT)} preserved; configuration was not replaced.")
        return target
    values = {key: secrets.token_hex(32) for key in ["POSTGRES_PASSWORD", "COMMERCE_DB_PASSWORD", "AI_DB_PASSWORD",
        "COMMERCE_RUNTIME_PASSWORD", "AI_RUNTIME_PASSWORD", "AI_GATEWAY_SECRET", "AI_TOOL_SECRET", "AI_KNOWLEDGE_ADMIN_SECRET"]}
    values.update(SITE_DOMAIN="localhost" if rehearsal else (domain or ""), RELEASE_TAG="local",
        RELEASE_IMAGE_PREFIX="nanggom-release", RELEASE_ADMIN_EMAIL="admin@nanggom.local",
        RELEASE_ADMIN_PASSWORD=secrets.token_urlsafe(24) + "aA1!", SMTP_HOST="rehearsal.invalid" if rehearsal else "",
        SMTP_PORT="587", SMTP_USERNAME="", SMTP_PASSWORD="", SMTP_FROM="Nàng Gốm <no-reply@nanggom.local>",
        GEMINI_API_KEY="", AI_GEMINI_MODEL="gemini-3.5-flash-lite", AI_DAILY_TURN_LIMIT="100",
        PROXY_ADDRESS="172.30.93.2" if rehearsal else "172.30.92.2",
        PROXY_SUBNET="172.30.93.0/24" if rehearsal else "172.30.92.0/24")
    header = "# Private deployment settings. Never commit or print credentials.\n"
    if rehearsal: header += "# Local HTTPS rehearsal only. SMTP is intentionally not connected.\n"
    else: header += "# Fill SITE_DOMAIN, SMTP settings and real administrator email before deployment.\n"
    with target.open("x", encoding="utf-8") as output:
        output.write(header + "".join(f"{key}={value}\n" for key, value in values.items()))
    target.chmod(0o600)
    print(f"Private configuration ready: {target.relative_to(ROOT)}. Credentials were not printed.")
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rehearsal", action="store_true")
    parser.add_argument("--domain")
    args = parser.parse_args()
    configure(args.rehearsal, args.domain)
