"""
Years-of-experience extraction — Stage 1 (regex, free, ~70% hit rate).

Design:
  - Tries patterns in priority order (most specific first)
  - Returns (yoe_min, yoe_max, method) or (None, None, None) on miss
  - Clamps output: any value > 20 → None (flag for LLM or manual review)
  - Cross-validates: if seniority_raw says junior but min_years > 4 → flag mismatch

The LLM fallback (Stage 2) in claude_haiku.py is only called when this returns None.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

# Ordered by specificity — match most specific pattern first
_PATTERNS: list[tuple[str, re.Pattern]] = [
    # "3 to 5 years", "3-5 years of experience"
    ("range", re.compile(
        r"(\d+)\s*(?:to|[-–])\s*(\d+)\s*\+?\s*years?\s*(?:of\s+(?:relevant\s+)?(?:work\s+)?experience)?",
        re.IGNORECASE,
    )),
    # "5+ years", "5 or more years"
    ("min_plus", re.compile(
        r"(\d+)\s*\+\s*years?\s*(?:of\s+(?:relevant\s+)?(?:work\s+)?experience)?",
        re.IGNORECASE,
    )),
    # "at least 3 years", "minimum 3 years"
    ("min_keyword", re.compile(
        r"(?:at\s+least|minimum|min\.?\s+of?|minimum\s+of)\s+(\d+)\s*\+?\s*years?",
        re.IGNORECASE,
    )),
    # "3 years of experience"
    ("exact", re.compile(
        r"(\d+)\s*years?\s+of\s+(?:relevant\s+)?(?:work\s+)?experience",
        re.IGNORECASE,
    )),
    # "experience: 5 years"
    ("colon", re.compile(
        r"experience[:\s]+(\d+)\s*\+?\s*years?",
        re.IGNORECASE,
    )),
    # "5-year experience", "5 year background"
    ("adjective", re.compile(
        r"(\d+)\s*(?:-|\s)?year\s+(?:of\s+)?(?:experience|background|track\s+record)",
        re.IGNORECASE,
    )),
]

_SENIORITY_JUNIOR = re.compile(
    r"\b(?:junior|jr\.?|entry[-\s]?level|graduate|intern|new\s+grad|0[-–]2\s+years?)\b",
    re.IGNORECASE,
)
_SENIORITY_SENIOR = re.compile(
    r"\b(?:senior|sr\.?|staff|principal|lead|architect|director|manager|head\s+of)\b",
    re.IGNORECASE,
)

MAX_YEARS = 20
MAX_YEARS_UPPER = 25


@dataclass
class ExtractionResult:
    yoe_min: Optional[int]
    yoe_max: Optional[int]
    method: Optional[str]           # "regex" | "llm" | "manual" | "none"
    seniority_raw: Optional[str]    # raw seniority indicator found in text
    mismatch_flag: bool = False     # True → LLM/manual review needed


def extract_yoe(text: str) -> ExtractionResult:
    """
    Extract years-of-experience from job description text.

    Returns:
        ExtractionResult with yoe_min, yoe_max, method.
        method="none" means regex found nothing → trigger LLM fallback.
        mismatch_flag=True means values look suspicious.
    """
    if not text or len(text) < 20:
        return ExtractionResult(None, None, None, None)

    seniority_raw = _detect_seniority(text)
    yoe_min = yoe_max = None
    matched_pattern = None

    for name, pattern in _PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        matched_pattern = name
        groups = [int(g) for g in match.groups() if g is not None]

        if name == "range" and len(groups) >= 2:
            yoe_min, yoe_max = sorted(groups[:2])
        elif len(groups) >= 1:
            yoe_min = groups[0]
            if name == "min_plus":
                yoe_max = yoe_min + 3  # "5+ years" → [5, 8] estimate
            else:
                yoe_max = yoe_min

        break  # first match wins

    if yoe_min is None:
        return ExtractionResult(None, None, "none", seniority_raw)

    # Clamp
    if yoe_min > MAX_YEARS:
        return ExtractionResult(None, None, "none", seniority_raw)
    if yoe_max and yoe_max > MAX_YEARS_UPPER:
        yoe_max = MAX_YEARS_UPPER

    # Cross-validate seniority vs extracted years
    mismatch = _check_mismatch(seniority_raw, yoe_min)

    return ExtractionResult(
        yoe_min=yoe_min,
        yoe_max=yoe_max,
        method="regex",
        seniority_raw=seniority_raw,
        mismatch_flag=mismatch,
    )


def _detect_seniority(text: str) -> Optional[str]:
    """Return 'junior', 'senior', or None based on title/description signals."""
    if _SENIORITY_JUNIOR.search(text):
        return "junior"
    if _SENIORITY_SENIOR.search(text):
        return "senior"
    return None


def _check_mismatch(seniority: Optional[str], yoe_min: int) -> bool:
    """
    Flag suspicious combinations:
      - junior role but 5+ years required
      - senior role but 0-1 years required
    """
    if seniority == "junior" and yoe_min > 4:
        return True
    if seniority == "senior" and yoe_min < 2:
        return True
    return False
