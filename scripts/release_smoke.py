"""Check the isolated Production-mode deployment through its verified localhost TLS endpoint."""
import http.cookiejar
import json
import re
import ssl
import subprocess
import tempfile
import urllib.error
import urllib.request
from uuid import uuid4
from ops_common import ROOT
from rehearsal import compose

BASE = "https://localhost:8443"


def ensure(condition, message):
    if not condition: raise RuntimeError(message)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl): return None


class Client:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        context = ssl.create_default_context(cafile=str(ROOT / ".local/rehearsal-ca.crt"))
        self.opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),
            urllib.request.HTTPCookieProcessor(self.jar), NoRedirect())

    def request(self, path, body=None, method="GET", headers=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(path if path.startswith("http") else BASE + path, data=data, method=method,
            headers={"Content-Type": "application/json", **(headers or {})})
        try: response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as failure: response = failure
        with response:
            payload = response.read()
            return response.code, response.headers, payload

    def get(self, path, expected=200):
        code, headers, body = self.request(path)
        ensure(code == expected, f"Unexpected HTTP {code} for {path.split('?')[0]}")
        return json.loads(body)

    def post(self, path, body, expected=200, headers=None, method="POST"):
        token = self.get("/api/v1/auth/csrf")["requestToken"]
        code, result, payload = self.request(path, body, method, {"X-CSRF-TOKEN": token, **(headers or {})})
        ensure(code == expected, f"Unexpected HTTP {code} for account/commerce mutation")
        return result, json.loads(payload) if payload else None


def sql(text, check=True):
    with tempfile.TemporaryFile() as source:
        source.write(text.encode()); source.seek(0)
        return compose("exec", "-T", "db", "sh", "-c",
            'exec psql -XAt --set=ON_ERROR_STOP=1 --set=VERBOSITY=sqlstate --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"', stdin=source, check=check)


def permissions():
    checks = sql("""SELECT
      has_schema_privilege('commerce_runtime','commerce','USAGE') AND
      NOT has_schema_privilege('commerce_runtime','commerce','CREATE') AND
      NOT has_schema_privilege('commerce_runtime','ai','USAGE') AND
      has_schema_privilege('ai_runtime','ai','USAGE') AND
      NOT has_schema_privilege('ai_runtime','ai','CREATE') AND
      NOT has_schema_privilege('ai_runtime','commerce','USAGE') AND
      has_table_privilege('commerce_runtime','commerce."Orders"','INSERT') AND
      has_table_privilege('ai_runtime','ai.knowledge_jobs','UPDATE') AND
      NOT has_table_privilege('commerce_runtime','commerce."__EFMigrationsHistory"','UPDATE') AND
      NOT has_table_privilege('ai_runtime','ai.alembic_version','UPDATE');""")
    ensure(checks.stdout.decode().strip() == "t", "Runtime database permissions differ from release policy")
    for role, schema, table in [("commerce_runtime", "commerce", '"Orders"'), ("ai_runtime", "ai", "knowledge_documents")]:
        for command in [f"CREATE TABLE {schema}.__forbidden (id integer)", f"ALTER TABLE {schema}.{table} ADD COLUMN __forbidden integer"]:
            result = sql(f"SET ROLE {role}; {command};", check=False)
            ensure(result.returncode != 0 and b"42501" in result.stderr, "Runtime identity unexpectedly obtained DDL privileges")


def network_boundary():
    for service in ("db", "api", "ai-service"):
        container = compose("ps", "--quiet", service).stdout.decode().strip()
        ensure(bool(container), "Rehearsal service is not running")
        result = subprocess.run(["docker", "inspect", "--format", "{{json .HostConfig.PortBindings}}", container], capture_output=True, check=True)
        ensure(not json.loads(result.stdout), "A private service unexpectedly publishes a host port")


def smoke():
    public = Client()
    code, headers, body = public.request("/")
    ensure(code == 200 and b'<div id="root"' in body, "Static storefront is unavailable over verified TLS")
    ensure(headers.get("X-Content-Type-Options") == "nosniff", "Response security headers missing")
    ensure("frame-ancestors 'none'" in headers.get("Content-Security-Policy", ""), "CSP is missing")
    module = re.search(rb'src="(/assets/[^"]+\.js)"', body)
    ensure(module is not None, "Production module not found")
    code, asset_headers, _ = public.request(module.group(1).decode())
    ensure(code == 200 and "immutable" in asset_headers.get("Cache-Control", ""), "Hashed asset is not served correctly")
    ensure(public.request("/assets/missing-file.js")[0] == 404, "Missing module must not return SPA HTML")
    ensure(public.request("/account/orders")[0] == 200, "SPA deep link failed")
    ensure(public.request("/internal/ai/tools/search", body={}, method="POST")[0] == 404, "Internal tools exposed by public proxy")
    ensure(public.request("/openapi/v1.json")[0] == 404, "Development OpenAPI exposed")
    ensure(public.get("/healthz")["status"] == "ready", "Proxy readiness failed")
    code, redirected, _ = public.request("http://localhost:8088/account")
    ensure(code == 308 and redirected.get("Location") == BASE + "/account", "Local HTTP to HTTPS redirect failed")
    ensure(public.request("/api/v1/admin/session", headers={"X-Role": "Admin", "X-Forwarded-Host": "attacker.invalid"})[0] == 401,
           "Anonymous caller reached the administrator session")
    config = dict(line.split("=", 1) for line in (ROOT / ".local/rehearsal.env").read_text(encoding="utf-8").splitlines() if "=" in line and not line.startswith("#"))
    admin = Client()
    signed, profile = admin.post("/api/v1/auth/login", {"email": config["RELEASE_ADMIN_EMAIL"], "password": config["RELEASE_ADMIN_PASSWORD"], "rememberMe": True})
    ensure(profile["role"] == "Admin", "Bootstrap role did not survive migration/runtime separation")
    cookies = " ".join(signed.get_all("Set-Cookie", []))
    ensure("secure" in cookies.lower() and "httponly" in cookies.lower() and "samesite=strict" in cookies.lower(), "Identity cookie protections missing")
    ensure(admin.get("/api/v1/admin/session")["role"] == "Admin", "HTTPS session did not persist")
    product = public.get("/api/v1/products/nang-coc-suong-mai")
    variant = product["variants"][0]
    _, quote = public.post("/api/v1/cart/quote", {"items": [{"variantId": variant["id"], "quantity": 1}]})
    key = str(uuid4())
    command = {"quoteToken": quote["quoteToken"], "acceptTerms": True, "paymentMethod": "cod", "contact": {
        "name": "HTTPS rehearsal customer", "phone": "0901234567", "email": "rehearsal@example.test", "province": "Trà Vinh",
        "address": "Isolated HTTPS rehearsal address", "note": "Local deployment verification"}}
    _, receipt = public.post("/api/v1/orders", command, 201, {"Idempotency-Key": key})
    ensure(receipt["grandTotalVnd"] == quote["grandTotalVnd"], "Checkout total changed unexpectedly")
    _, replay = public.post("/api/v1/orders", command, 201, {"Idempotency-Key": key})
    ensure(replay["reference"] == receipt["reference"], "Duplicate order created during retry")
    reference = receipt["reference"]
    ensure(public.request("/api/v1/orders/" + reference + "/status")[0] == 404, "Private order leaked")
    ensure(public.request("/api/v1/orders/" + reference + "/status", headers={"X-Order-Token": receipt["accessToken"]})[0] == 200, "Private tracking failed")
    order = admin.get("/api/v1/admin/orders/?q=" + reference)["items"][0]
    admin.post("/api/v1/admin/orders/" + order["id"] + "/status", {"status": "cancelled", "revision": order["revision"],
        "reason": "Local HTTPS deployment verification", "requestId": str(uuid4()), "confirmCodCollected": False}, method="PATCH")
    ensure(public.get("/api/v1/products/" + product["slug"])["variants"][0]["stockQty"] == variant["stockQty"], "Cancellation did not restore stock")
    permissions()
    network_boundary()
    _, cors, _ = public.request("/api/v1/auth/me", method="OPTIONS", headers={"Origin": BASE, "Access-Control-Request-Method": "GET"})
    ensure(cors.get("Access-Control-Allow-Origin") == BASE, "Release origin was not applied")
    _, cors, _ = public.request("/api/v1/auth/me", method="OPTIONS", headers={"Origin": "http://127.0.0.1:5173", "Access-Control-Request-Method": "GET"})
    ensure(cors.get("Access-Control-Allow-Origin") is None, "Development origin remains enabled in production")
    report = {"verifiedTls": True, "secureSession": True, "isolatedRuntimePrivileges": True, "checkoutReplay": True,
              "privateTracking": True, "cancellationRestock": True, "staticRoutes": True, "proxyBoundary": True, "privateServicePorts": True, "releaseCors": True}
    (ROOT / ".local/release-smoke.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("HTTPS release smoke passed: secure session, checkout/replay, private tracking, restock and runtime privilege checks.")


if __name__ == "__main__":
    try: smoke()
    except Exception as failure:
        # Do not dump HTTP request/response bodies or credentials.
        raise SystemExit("Release smoke failed: " + (str(failure) if isinstance(failure, RuntimeError) else type(failure).__name__))
