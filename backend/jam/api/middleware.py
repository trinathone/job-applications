"""FastAPI middleware — Prometheus request timing."""
from __future__ import annotations

import time

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from jam.monitoring.metrics import API_REQUEST_DURATION, DASHBOARD_PAGE_LOADS


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        t0 = time.monotonic()
        response = await call_next(request)
        duration = time.monotonic() - t0

        path = request.url.path
        API_REQUEST_DURATION.labels(
            method=request.method,
            path=path,
            status=str(response.status_code),
        ).observe(duration)

        if path == "/dashboard" and request.method == "GET":
            DASHBOARD_PAGE_LOADS.inc()

        return response
