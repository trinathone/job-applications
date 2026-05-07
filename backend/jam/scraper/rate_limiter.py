"""
Per-ATS Redis-backed token bucket rate limiter.

Each ATS gets its own bucket in Redis. Implemented as a Lua script for
atomicity — no race conditions across multiple Celery workers.

Token bucket:
  - Refills at `rate` tokens/second
  - Max burst capacity = `capacity`
  - Each request consumes 1 token
  - If insufficient tokens: sleep until replenished, then retry

Per-ATS defaults (conservative, well below any documented limit):
  greenhouse: 4 req/s, burst 10
  lever:      5 req/s, burst 15
  ashby:      5 req/s, burst 15
  adzuna:     2 req/s, burst 5
  reed:       1 req/s, burst 3  (strict UK API)
  default:    2 req/s, burst 5
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field

import redis.asyncio as aioredis

from jam.config import settings

# Lua script: atomic check-and-consume token bucket
# Keys: [bucket_key, last_refill_key]
# Args: [capacity, rate_per_second, now_float, tokens_requested]
# Returns: [tokens_remaining, wait_ms]  (wait_ms > 0 means caller must sleep)
_LUA_TOKEN_BUCKET = """
local bucket_key   = KEYS[1]
local refill_key   = KEYS[2]
local capacity     = tonumber(ARGV[1])
local rate         = tonumber(ARGV[2])
local now          = tonumber(ARGV[3])
local requested    = tonumber(ARGV[4])

local last_refill  = tonumber(redis.call('GET', refill_key) or now)
local tokens       = tonumber(redis.call('GET', bucket_key) or capacity)

-- Refill based on elapsed time
local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + elapsed * rate)

if tokens >= requested then
    tokens = tokens - requested
    redis.call('SET', bucket_key,  tokens, 'EX', 60)
    redis.call('SET', refill_key,  now,    'EX', 60)
    return {tokens, 0}
else
    -- Calculate wait: how long until we have enough tokens
    local deficit   = requested - tokens
    local wait_s    = deficit / rate
    local wait_ms   = math.ceil(wait_s * 1000)
    -- Don't consume tokens — caller will retry after sleeping
    redis.call('SET', refill_key, now, 'EX', 60)
    return {tokens, wait_ms}
end
"""

@dataclass
class RateLimiterConfig:
    rate: float       # tokens per second
    capacity: int     # max burst capacity


ATS_RATE_LIMITS: dict[str, RateLimiterConfig] = {
    "greenhouse":       RateLimiterConfig(rate=4.0,  capacity=10),
    "lever":            RateLimiterConfig(rate=5.0,  capacity=15),
    "ashby":            RateLimiterConfig(rate=5.0,  capacity=15),
    "workday":          RateLimiterConfig(rate=1.0,  capacity=3),
    "icims":            RateLimiterConfig(rate=2.0,  capacity=5),
    "smartrecruiters":  RateLimiterConfig(rate=2.0,  capacity=5),
    "adzuna":           RateLimiterConfig(rate=2.0,  capacity=5),
    "reed":             RateLimiterConfig(rate=1.0,  capacity=3),
    "remotive":         RateLimiterConfig(rate=1.0,  capacity=3),
    "jobicy":           RateLimiterConfig(rate=1.0,  capacity=3),
    "the_muse":         RateLimiterConfig(rate=2.0,  capacity=5),
    "working_nomads":   RateLimiterConfig(rate=1.0,  capacity=3),
    "linkedin":         RateLimiterConfig(rate=0.5,  capacity=2),
    "indeed":           RateLimiterConfig(rate=0.5,  capacity=2),
    "glassdoor":        RateLimiterConfig(rate=0.5,  capacity=2),
    "ycombinator":      RateLimiterConfig(rate=1.0,  capacity=3),
    "wellfound":        RateLimiterConfig(rate=1.0,  capacity=3),
    "himalayas":        RateLimiterConfig(rate=1.0,  capacity=3),
    "aijobs":           RateLimiterConfig(rate=1.0,  capacity=3),
    "levels_fyi":       RateLimiterConfig(rate=1.0,  capacity=3),
    "default":          RateLimiterConfig(rate=2.0,  capacity=5),
}


class RateLimiter:
    """
    Async context manager for per-ATS token bucket rate limiting.

    Usage:
        limiter = RateLimiter(redis_client, "greenhouse")
        async with limiter:
            response = await session.get(url)
    """

    MAX_WAIT_S = 30.0  # refuse to wait more than this; caller should back off

    def __init__(self, redis_client: aioredis.Redis, ats: str):
        self._redis = redis_client
        self._ats = ats
        cfg = ATS_RATE_LIMITS.get(ats, ATS_RATE_LIMITS["default"])
        self._rate = cfg.rate
        self._capacity = cfg.capacity
        self._script: aioredis.client.Script | None = None

    async def _get_script(self) -> aioredis.client.Script:
        if self._script is None:
            self._script = self._redis.register_script(_LUA_TOKEN_BUCKET)
        return self._script

    async def acquire(self) -> None:
        """Block until a token is available. Raises RuntimeError if wait > MAX_WAIT_S."""
        bucket_key = f"jam:ratelimit:{self._ats}:tokens"
        refill_key = f"jam:ratelimit:{self._ats}:refill"

        script = await self._get_script()
        total_waited = 0.0

        while True:
            now = time.monotonic()
            tokens_remaining, wait_ms = await script(
                keys=[bucket_key, refill_key],
                args=[self._capacity, self._rate, now, 1],
            )
            if wait_ms == 0:
                return  # token consumed, proceed

            wait_s = wait_ms / 1000.0
            total_waited += wait_s

            if total_waited > self.MAX_WAIT_S:
                raise RuntimeError(
                    f"Rate limiter for {self._ats!r} exceeded max wait "
                    f"({self.MAX_WAIT_S}s). Aborting request."
                )

            await asyncio.sleep(min(wait_s, 1.0))  # cap per-sleep to 1s for responsiveness

    async def __aenter__(self) -> "RateLimiter":
        await self.acquire()
        return self

    async def __aexit__(self, *_) -> None:
        pass


class RateLimiterPool:
    """
    Pool of RateLimiter instances, one per ATS.
    Module-level singleton created on first use.
    """

    def __init__(self):
        self._redis: aioredis.Redis | None = None
        self._limiters: dict[str, RateLimiter] = {}

    def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.redis_url, decode_responses=True, max_connections=20
            )
        return self._redis

    def get(self, ats: str) -> RateLimiter:
        if ats not in self._limiters:
            self._limiters[ats] = RateLimiter(self._get_redis(), ats)
        return self._limiters[ats]


# Module-level singleton
rate_limiter_pool = RateLimiterPool()
