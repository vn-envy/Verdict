"""Lightweight, dependency-free API guardrails for the public deliberation endpoint.

`POST /api/cases` kicks off a deliberation that fans out to ~100 LLM calls, so an unguarded
public endpoint is a direct cost/abuse exposure. Three cheap controls bound it:

  * per-IP sliding-window rate limit (throttles a single noisy client),
  * a global cap on concurrent deliberations (a hard ceiling on total in-flight spend),
  * optional API-key check (off by default so the live browser app keeps working; flip on by
    setting API_KEY once requests go through a server-side proxy that can hold the secret).

In-memory and single-process — under ACA scale-out each replica guards its own share, which is
why the global concurrency cap (the real money ceiling) is paired with the per-IP limit.
"""
from __future__ import annotations

import time
from collections import deque

from fastapi import Request


def client_ip(request: Request) -> str:
    """Best-effort client IP. ACA/most proxies set X-Forwarded-For: 'client, proxy1, ...'."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class SlidingWindowLimiter:
    """In-memory per-key sliding-window rate limiter. `max_requests <= 0` disables it."""

    def __init__(self, max_requests: int, window_seconds: float = 60.0):
        self.max = max_requests
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def allow(self, key: str) -> bool:
        if self.max <= 0:
            return True
        now = time.monotonic()
        dq = self._hits.setdefault(key, deque())
        while dq and now - dq[0] > self.window:
            dq.popleft()
        if len(dq) >= self.max:
            return False
        dq.append(now)
        return True


class ConcurrencyCap:
    """Bounds how many deliberations run at once in this process. `limit <= 0` disables it."""

    def __init__(self, limit: int):
        self.limit = limit
        self.active = 0

    def try_acquire(self) -> bool:
        if self.limit > 0 and self.active >= self.limit:
            return False
        self.active += 1
        return True

    def release(self) -> None:
        self.active = max(0, self.active - 1)
