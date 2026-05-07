"""
Resume LaTeX builder endpoint.
POST /api/resume/latex — takes resume text, writing rules, JD, provider, and api_key.
The caller supplies their own API key; the server key is only used as fallback for Anthropic.
"""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from jam.api.routers.auth import get_current_user
from jam.models import User

router = APIRouter(prefix="/api/resume", tags=["resume-builder"])

SYSTEM_PROMPT = (
    "You are an expert resume writer and LaTeX typesetter. "
    "Rewrite the user's resume as a polished LaTeX document tailored to the given job description. "
    "Follow the user's writing rules exactly. "
    "Output ONLY valid LaTeX code — no explanations, no markdown fences, no commentary. "
    "Start directly with \\documentclass and end with \\end{document}."
)


class LatexRequest(BaseModel):
    resume_text: str
    writing_rules: str
    job_description: str
    provider: Literal["anthropic", "openai", "gemini"] = "anthropic"
    api_key: Optional[str] = None  # caller's own key; falls back to server key for anthropic


class LatexResponse(BaseModel):
    latex: str


class TestKeyRequest(BaseModel):
    provider: Literal["anthropic", "openai", "gemini"]
    api_key: str


class TestKeyResponse(BaseModel):
    ok: bool
    message: str


def _strip_fences(text: str) -> str:
    lines = text.strip().splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


async def _call_anthropic(api_key: str, user_message: str) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    return msg.content[0].text


async def _call_openai(api_key: str, user_message: str) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key)
    resp = await client.chat.completions.create(
        model="gpt-4o",
        max_tokens=4096,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )
    return resp.choices[0].message.content or ""


async def _call_gemini(api_key: str, user_message: str) -> str:
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=api_key)
    resp = await client.aio.models.generate_content(
        model="gemini-2.0-flash",
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            max_output_tokens=4096,
        ),
    )
    return resp.text or ""


@router.post("/latex", response_model=LatexResponse)
async def generate_latex(
    req: LatexRequest,
    _user: User = Depends(get_current_user),
) -> LatexResponse:
    from jam.config import settings

    user_message = (
        f"## My Resume\n{req.resume_text}\n\n"
        f"## My Writing Rules\n{req.writing_rules}\n\n"
        f"## Job Description\n{req.job_description}"
    )

    # Resolve which key to use
    key = (req.api_key or "").strip()
    if not key and req.provider == "anthropic":
        key = settings.anthropic_api_key
    if not key:
        raise HTTPException(
            status_code=422,
            detail=f"No API key provided for {req.provider}. Enter your key in the Brain selector.",
        )

    try:
        if req.provider == "anthropic":
            raw = await _call_anthropic(key, user_message)
        elif req.provider == "openai":
            raw = await _call_openai(key, user_message)
        elif req.provider == "gemini":
            raw = await _call_gemini(key, user_message)
        else:
            raise HTTPException(status_code=422, detail="Unknown provider.")

        return LatexResponse(latex=_strip_fences(raw))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/test-key", response_model=TestKeyResponse)
async def test_api_key(
    req: TestKeyRequest,
    _user: User = Depends(get_current_user),
) -> TestKeyResponse:
    """Send a minimal request to verify the API key works."""
    key = req.api_key.strip()
    if not key:
        return TestKeyResponse(ok=False, message="No key provided.")
    try:
        if req.provider == "anthropic":
            import anthropic
            c = anthropic.AsyncAnthropic(api_key=key)
            msg = await c.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=5,
                messages=[{"role": "user", "content": "hi"}],
            )
            return TestKeyResponse(ok=True, message=f"Claude OK — model {msg.model}")

        elif req.provider == "openai":
            from openai import AsyncOpenAI
            c = AsyncOpenAI(api_key=key)
            models = await c.models.list()
            names = [m.id for m in models.data[:3]]
            return TestKeyResponse(ok=True, message=f"OpenAI OK — {', '.join(names)}…")

        elif req.provider == "gemini":
            from google import genai
            c = genai.Client(api_key=key)
            resp = await c.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents="hi",
            )
            return TestKeyResponse(ok=True, message=f"Gemini OK — {resp.text[:30].strip()}")

        return TestKeyResponse(ok=False, message="Unknown provider.")
    except Exception as exc:
        msg = str(exc)
        # Extract clean error message
        if "invalid_api_key" in msg or "Invalid API" in msg or "API key" in msg.lower():
            return TestKeyResponse(ok=False, message="Invalid API key.")
        if "quota" in msg.lower() or "billing" in msg.lower():
            return TestKeyResponse(ok=False, message="Key valid but quota exceeded.")
        return TestKeyResponse(ok=False, message=msg[:120])
