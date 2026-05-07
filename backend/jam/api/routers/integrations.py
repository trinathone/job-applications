"""
POST /api/integrations/test — validate a third-party API key without storing it.
Supported providers: anthropic, openai, gemini
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from jam.api.deps import get_current_user

router = APIRouter(tags=["integrations"])


class TestKeyRequest(BaseModel):
    provider: str  # "anthropic" | "openai" | "gemini"
    api_key: str


@router.post("/api/integrations/test")
async def test_api_key(
    body: TestKeyRequest,
    _user=Depends(get_current_user),
) -> dict:
    provider = body.provider.lower().strip()
    key = body.api_key.strip()

    if not key:
        raise HTTPException(400, "api_key is required")

    if provider == "anthropic":
        return await _test_anthropic(key)
    elif provider == "openai":
        return await _test_openai(key)
    elif provider == "gemini":
        return await _test_gemini(key)
    else:
        raise HTTPException(400, f"Unknown provider: {provider}")


async def _test_anthropic(key: str) -> dict:
    """Hit the Anthropic models list endpoint — cheap, no tokens consumed."""
    if not key.startswith("sk-ant-"):
        raise HTTPException(400, "Key format looks wrong — should start with sk-ant-")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
            },
        )

    if r.status_code == 200:
        data = r.json()
        models = [m["id"] for m in data.get("data", [])[:3]]
        return {"ok": True, "detail": f"Valid — {len(data.get('data', []))} models available"}
    elif r.status_code == 401:
        raise HTTPException(401, "Invalid API key — authentication failed")
    else:
        raise HTTPException(502, f"Anthropic returned {r.status_code}")


async def _test_openai(key: str) -> dict:
    """Hit the OpenAI models list endpoint."""
    if not key.startswith("sk-"):
        raise HTTPException(400, "Key format looks wrong — should start with sk-")

    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {key}"},
        )

    if r.status_code == 200:
        data = r.json()
        count = len(data.get("data", []))
        return {"ok": True, "detail": f"Valid — {count} models available"}
    elif r.status_code == 401:
        raise HTTPException(401, "Invalid API key")
    else:
        raise HTTPException(502, f"OpenAI returned {r.status_code}")


async def _test_gemini(key: str) -> dict:
    """Hit the Gemini models list endpoint."""
    async with httpx.AsyncClient(timeout=10) as http:
        r = await http.get(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={key}",
        )

    if r.status_code == 200:
        data = r.json()
        count = len(data.get("models", []))
        return {"ok": True, "detail": f"Valid — {count} models available"}
    elif r.status_code == 400:
        raise HTTPException(401, "Invalid API key")
    else:
        raise HTTPException(502, f"Gemini returned {r.status_code}")
