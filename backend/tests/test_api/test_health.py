import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "db" in data
    assert "redis" in data


@pytest.mark.asyncio
async def test_readiness(client):
    resp = await client.get("/api/ready")
    # DB must be up for tests to run at all
    assert resp.status_code == 200
