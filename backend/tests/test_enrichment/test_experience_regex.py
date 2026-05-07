import pytest
from jam.enrichment.experience import extract_yoe


@pytest.mark.parametrize("text, expected_min, expected_max", [
    ("We require 3+ years of experience in Python.", 3, 6),
    ("Minimum 5 years of experience required.", 5, 5),
    ("3-5 years of experience preferred.", 3, 5),
    ("At least 2 years of relevant work experience.", 2, 2),
    ("5 years of experience in backend development.", 5, 5),
    ("10+ years leading teams.", 10, 13),
    ("Experience: 4 years.", 4, 4),
])
def test_regex_extracts_yoe(text, expected_min, expected_max):
    result = extract_yoe(text)
    assert result.method == "regex"
    assert result.yoe_min == expected_min
    assert result.yoe_max == expected_max


@pytest.mark.parametrize("text", [
    "We're looking for passionate engineers.",
    "Join our team and grow your career!",
    "",
])
def test_regex_returns_none_on_miss(text):
    result = extract_yoe(text)
    assert result.method == "none"
    assert result.yoe_min is None


def test_clamp_large_values():
    # > 20 years should be clamped to None
    result = extract_yoe("25 years of experience required.")
    assert result.yoe_min is None
    assert result.method == "none"


def test_mismatch_flag_junior_high_yoe():
    result = extract_yoe("Junior developer with 6+ years of Python experience.")
    assert result.mismatch_flag is True


def test_seniority_detection_senior():
    result = extract_yoe("Senior engineer with 5+ years of Kubernetes experience.")
    assert result.seniority_raw == "senior"


def test_seniority_detection_junior():
    result = extract_yoe("Entry-level position, 1-2 years of experience preferred.")
    assert result.seniority_raw == "junior"
