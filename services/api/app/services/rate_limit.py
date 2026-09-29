"""In-memory rate limiting abstraction (Redis-ready interface)."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass
from threading import Lock


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    reset_at: float


class RateLimiter:
    """Simple sliding-window counter. Swap backend for Redis in later phases."""

    def __init__(self) -> None:
        self._windows: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(
        self,
        *,
        key: str,
        limit: int,
        window_seconds: int = 60,
    ) -> RateLimitResult:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = [t for t in self._windows[key] if t > cutoff]
            if len(hits) >= limit:
                self._windows[key] = hits
                reset_at = hits[0] + window_seconds if hits else now + window_seconds
                return RateLimitResult(
                    allowed=False,
                    limit=limit,
                    remaining=0,
                    reset_at=reset_at,
                )
            hits.append(now)
            self._windows[key] = hits
            return RateLimitResult(
                allowed=True,
                limit=limit,
                remaining=max(0, limit - len(hits)),
                reset_at=now + window_seconds,
            )

    def reset(self) -> None:
        with self._lock:
            self._windows.clear()


_default_limiter = RateLimiter()


def get_rate_limiter() -> RateLimiter:
    return _default_limiter
