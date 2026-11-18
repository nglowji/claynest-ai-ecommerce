from datetime import datetime, timezone
import json
import logging
from contextvars import ContextVar

correlation_context = ContextVar("correlation_id",default="")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "claynest-ai",
            "event": record.getMessage(),
        }
        for key in ("correlation_id", "exception_type", "method", "path", "status_code", "model", "input_tokens", "output_tokens", "total_tokens"):
            if hasattr(record, key):
                data[key] = getattr(record, key)
        if "correlation_id" not in data and correlation_context.get():
            data["correlation_id"] = correlation_context.get()
        return json.dumps(data, ensure_ascii=False)


def application_logger() -> logging.Logger:
    logger = logging.getLogger("claynest.ai")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False
    return logger
