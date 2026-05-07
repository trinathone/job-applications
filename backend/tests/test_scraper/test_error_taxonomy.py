import pytest
from jam.scraper.error_taxonomy import (
    ErrorKind,
    classify_http,
    classify_exception,
    retry_policy,
)
import asyncio


def test_classify_404():
    assert classify_http(404) == ErrorKind.DEAD


def test_classify_429():
    assert classify_http(429) == ErrorKind.RATE_LIMITED


def test_classify_500():
    assert classify_http(500) == ErrorKind.SERVER_ERROR


def test_classify_503():
    assert classify_http(503) == ErrorKind.SERVER_ERROR


def test_classify_200():
    assert classify_http(200) == ErrorKind.OK


def test_classify_timeout():
    assert classify_exception(asyncio.TimeoutError()) == ErrorKind.TIMEOUT


def test_retry_policy_dead_no_retry():
    policy = retry_policy(ErrorKind.DEAD)
    assert policy.should_retry is False
    assert policy.count_as_failure is True


def test_retry_policy_429_no_fail_count():
    policy = retry_policy(ErrorKind.RATE_LIMITED)
    assert policy.should_retry is True
    assert policy.count_as_failure is False


def test_retry_policy_timeout_no_fail_count():
    policy = retry_policy(ErrorKind.TIMEOUT)
    assert policy.should_retry is False
    assert policy.count_as_failure is False


def test_retry_policy_5xx_retries():
    policy = retry_policy(ErrorKind.SERVER_ERROR)
    assert policy.should_retry is True
    assert policy.max_attempts >= 2
    assert policy.count_as_failure is True
