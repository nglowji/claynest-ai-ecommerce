import hashlib
import hmac
import time
from threading import Lock
from uuid import UUID, uuid4


def signature(secret: str, path: str, scope: str, timestamp: str, nonce: str, body: bytes) -> str:
    value = f"POST\n{path}\n{scope}\n{timestamp}\n{nonce}\n{hashlib.sha256(body).hexdigest()}"
    return hmac.new(secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def headers(secret: str, path: str, scope: str, body: bytes) -> dict[str, str]:
    timestamp, nonce = str(int(time.time())), uuid4().hex
    return {"Content-Type": "application/json", "X-Service-Time": timestamp, "X-Service-Nonce": nonce,
            "X-Service-Scope": scope, "X-Service-Signature": signature(secret,path,scope,timestamp,nonce,body)}


class ReplayGuard:
    def __init__(self):
        self.nonces: dict[str, float] = {}
        self.lock = Lock()

    def verify(self, secret: str, path: str, supplied, body: bytes) -> bool:
        now = time.time()
        stamp, nonce = supplied.get("x-service-time", ""), supplied.get("x-service-nonce", "")
        try:
            if len(secret) < 32 or abs(now - int(stamp)) > 60 or UUID(nonce).hex != nonce or supplied.get("x-service-scope") != "chat:public":
                return False
        except (ValueError, TypeError):
            return False
        expected = signature(secret,path,"chat:public",stamp,nonce,body)
        provided = supplied.get("x-service-signature", "")
        if not isinstance(provided,str) or len(provided) != 64 or any(c not in "0123456789abcdef" for c in provided) or not hmac.compare_digest(expected,provided):
            return False
        with self.lock:
            self.nonces = {key: expiry for key,expiry in self.nonces.items() if expiry >= now}
            if nonce in self.nonces or len(self.nonces) >= 10000:
                return False
            self.nonces[nonce] = now + 120
            return True
