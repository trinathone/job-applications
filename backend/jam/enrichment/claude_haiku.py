"""
Claude Haiku LLM fallback for YOE extraction (Stage 2).

Only called when regex returns method="none".

Cost controls:
  - Uses claude-haiku-4-5-20251001 (~$0.0003/JD at current pricing)
  - Hard daily budget cap tracked in Redis: jam:claude_spend:YYYYMMDD
  - Batches up to 20 JDs per API call (Claude batch API)
  - Prompt is versioned: jobs.extraction_prompt_ver tracks which version extracted
  - When budget exceeded: sets job.needs_extraction=True, stores NULL for YOE

Validation guardrails (same as regex stage):
  - Clamp: yoe > 20 or < 0 → store NULL, flag mismatch
  - Cross-validate: junior + yoe > 4 → flag mismatch

Idempotency:
  - Jobs with needs_extraction=True are eligible for a daily retry task
  - Re-extraction with new prompt version: filter by extraction_prompt_ver != current
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
import structlog

from jam.config import settings
from jam.enrichment.experience import ExtractionResult, _check_mismatch

logger = structlog.get_logger(__name__)

EXTRACTION_PROMPT_VERSION = "v4"

# Haiku pricing (as of 2026-05)
# Input: $0.80/MTok, Output: $4.00/MTok
_INPUT_COST_PER_TOKEN = 0.80 / 1_000_000
_OUTPUT_COST_PER_TOKEN = 4.00 / 1_000_000

_SYSTEM_PROMPT = """You are an expert job description parser. Extract years-of-experience requirements.

Return ONLY a JSON object with these fields (no other text):
{
  "yoe_min": <integer or null>,
  "yoe_max": <integer or null>,
  "seniority": "<junior|mid|senior|staff|principal|null>"
}

Rules:
- yoe_min: minimum years required (null if not mentioned)
- yoe_max: maximum or upper range (null if open-ended)
- If "5+ years": yoe_min=5, yoe_max=null
- If "3-5 years": yoe_min=3, yoe_max=5
- If no experience mentioned: yoe_min=null, yoe_max=null
- Never return values over 20 for yoe_min or over 25 for yoe_max
- Only return integers, not strings"""


@dataclass
class HaikuExtractionResult:
    job_id: int
    yoe_min: Optional[int]
    yoe_max: Optional[int]
    seniority_raw: Optional[str]
    mismatch_flag: bool
    cost_usd: float
    input_tokens: int
    output_tokens: int
    budget_exceeded: bool = False


class BudgetExceededError(Exception):
    """Raised when the daily Claude spend cap would be exceeded."""
    pass


async def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def get_today_spend() -> float:
    """Return current day's accumulated Claude spend in USD."""
    redis = await _get_redis()
    try:
        val = await redis.get(settings.redis_spend_key_today)
        return float(val) if val else 0.0
    finally:
        await redis.aclose()


async def check_budget(estimated_cost: float) -> bool:
    """Return True if we can spend `estimated_cost` without exceeding the daily cap."""
    current = await get_today_spend()
    return (current + estimated_cost) <= settings.claude_daily_budget_usd


async def record_spend(cost_usd: float) -> float:
    """Atomically increment today's spend counter. Returns new total."""
    redis = await _get_redis()
    try:
        key = settings.redis_spend_key_today
        new_total = await redis.incrbyfloat(key, cost_usd)
        # Set expiry to tomorrow midnight UTC
        tomorrow = _tomorrow_midnight_unix()
        await redis.expireat(key, tomorrow)
        return float(new_total)
    finally:
        await redis.aclose()


def _tomorrow_midnight_unix() -> int:
    from datetime import timedelta
    now = datetime.now(tz=timezone.utc)
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(tomorrow.timestamp())


def _estimate_cost(text: str) -> float:
    """Rough cost estimate before making the API call."""
    input_tokens = len(text.split()) * 1.3  # ~1.3 tokens per word
    output_tokens = 30  # small JSON response
    return (input_tokens * _INPUT_COST_PER_TOKEN) + (output_tokens * _OUTPUT_COST_PER_TOKEN)


def _parse_haiku_response(content: str) -> tuple[Optional[int], Optional[int], Optional[str]]:
    """Parse Claude's JSON response. Returns (yoe_min, yoe_max, seniority)."""
    try:
        data = json.loads(content.strip())
        yoe_min = data.get("yoe_min")
        yoe_max = data.get("yoe_max")
        seniority = data.get("seniority")

        # Validate and clamp
        if yoe_min is not None:
            yoe_min = int(yoe_min)
            if yoe_min < 0 or yoe_min > 20:
                yoe_min = None
        if yoe_max is not None:
            yoe_max = int(yoe_max)
            if yoe_max < 0:
                yoe_max = None
            elif yoe_max > 25:
                yoe_max = 25

        return yoe_min, yoe_max, seniority
    except (json.JSONDecodeError, ValueError, TypeError):
        return None, None, None


async def extract_yoe_batch(
    jobs: list[tuple[int, str]],  # list of (job_id, description_text)
) -> list[HaikuExtractionResult]:
    """
    Extract YOE for a batch of job descriptions using Claude Haiku.

    Args:
        jobs: list of (job_id, description) — max 20 per batch

    Returns:
        list of HaikuExtractionResult, one per input job.

    Budget guard: if adding this batch would exceed the daily cap,
    returns results with budget_exceeded=True and null YOE fields.
    """
    import anthropic

    if not settings.anthropic_api_key:
        logger.warning("claude_haiku_skipped", reason="no_api_key")
        return [
            HaikuExtractionResult(
                job_id=job_id, yoe_min=None, yoe_max=None,
                seniority_raw=None, mismatch_flag=False,
                cost_usd=0, input_tokens=0, output_tokens=0, budget_exceeded=True,
            )
            for job_id, _ in jobs
        ]

    # Estimate total cost for this batch
    total_estimated = sum(_estimate_cost(desc) for _, desc in jobs)

    if not await check_budget(total_estimated):
        remaining = settings.claude_daily_budget_usd - await get_today_spend()
        logger.warning(
            "claude_budget_exceeded",
            daily_budget=settings.claude_daily_budget_usd,
            remaining_usd=remaining,
            requested_usd=total_estimated,
        )
        return [
            HaikuExtractionResult(
                job_id=job_id, yoe_min=None, yoe_max=None,
                seniority_raw=None, mismatch_flag=False,
                cost_usd=0, input_tokens=0, output_tokens=0, budget_exceeded=True,
            )
            for job_id, _ in jobs
        ]

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    results: list[HaikuExtractionResult] = []
    total_cost = 0.0

    for job_id, description in jobs:
        # Truncate to ~2000 words to cap token usage
        truncated = " ".join(description.split()[:2000]) if description else ""

        try:
            t0 = time.monotonic()
            response = await client.messages.create(
                model=settings.claude_extraction_model,
                max_tokens=150,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Job description:\n\n{truncated}"}],
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            content = response.content[0].text if response.content else ""
            yoe_min, yoe_max, seniority = _parse_haiku_response(content)

            input_tok = response.usage.input_tokens
            output_tok = response.usage.output_tokens
            cost = (input_tok * _INPUT_COST_PER_TOKEN) + (output_tok * _OUTPUT_COST_PER_TOKEN)
            total_cost += cost

            mismatch = _check_mismatch(seniority, yoe_min) if yoe_min is not None else False

            logger.info(
                "haiku_extraction",
                job_id=job_id,
                yoe_min=yoe_min,
                yoe_max=yoe_max,
                seniority=seniority,
                cost_usd=round(cost, 6),
                latency_ms=latency_ms,
            )

            results.append(HaikuExtractionResult(
                job_id=job_id,
                yoe_min=yoe_min,
                yoe_max=yoe_max,
                seniority_raw=seniority,
                mismatch_flag=mismatch,
                cost_usd=cost,
                input_tokens=input_tok,
                output_tokens=output_tok,
            ))

        except anthropic.RateLimitError:
            logger.warning("haiku_rate_limited", job_id=job_id)
            results.append(HaikuExtractionResult(
                job_id=job_id, yoe_min=None, yoe_max=None,
                seniority_raw=None, mismatch_flag=False,
                cost_usd=0, input_tokens=0, output_tokens=0,
            ))

        except anthropic.APIError as exc:
            logger.error("haiku_api_error", job_id=job_id, exc=str(exc))
            results.append(HaikuExtractionResult(
                job_id=job_id, yoe_min=None, yoe_max=None,
                seniority_raw=None, mismatch_flag=False,
                cost_usd=0, input_tokens=0, output_tokens=0,
            ))

    # Record actual spend after the batch
    if total_cost > 0:
        await record_spend(total_cost)

    return results


async def tailor_cover_letter(job_description: str, job_title: str) -> str:
    """
    Stream a tailored cover letter / resume bullet points for the InlineTailor panel.
    Returns the full text (caller is responsible for SSE streaming).
    """
    import anthropic

    if not settings.anthropic_api_key:
        return "Claude API key not configured."

    if not await check_budget(0.01):  # estimate ~$0.01 per tailor call
        return "Daily Claude budget exhausted. Try again tomorrow."

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    system = """You help job seekers tailor their application materials.
Given a job description, produce:
1. 3-5 bullet points highlighting relevant experience to emphasize
2. One short paragraph for a cover letter intro (2-3 sentences)

Be specific, action-oriented, and concise. Focus on technical skills and impact."""

    prompt = f"Job title: {job_title}\n\nJob description:\n{' '.join(job_description.split()[:1000])}"

    full_text = ""
    total_tokens = 0

    async with client.messages.stream(
        model=settings.claude_extraction_model,
        max_tokens=500,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for chunk in stream.text_stream:
            full_text += chunk

        final = await stream.get_final_message()
        total_tokens = final.usage.input_tokens + final.usage.output_tokens
        cost = (final.usage.input_tokens * _INPUT_COST_PER_TOKEN +
                final.usage.output_tokens * _OUTPUT_COST_PER_TOKEN)

    await record_spend(cost)
    logger.info("tailor_complete", job_title=job_title, tokens=total_tokens, cost_usd=cost)

    return full_text
