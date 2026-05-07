"""
Test idempotent application UPSERT.
Creates a job + user record first, then tests double-apply safety.
"""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_application_upsert_idempotent(client, db):
    # Create prerequisite data
    await db.execute(text("""
        INSERT INTO companies (slug, name, ats, active)
        VALUES ('test-co', 'Test Co', 'greenhouse', true)
        ON CONFLICT (slug) DO NOTHING
    """))
    await db.execute(text("""
        INSERT INTO users (email, hashed_password)
        VALUES ('test@example.com', 'hashed')
        ON CONFLICT (email) DO NOTHING
    """))
    co = (await db.execute(text("SELECT id FROM companies WHERE slug='test-co'"))).scalar()
    user = (await db.execute(text("SELECT id FROM users WHERE email='test@example.com'"))).scalar()

    await db.execute(text(f"""
        INSERT INTO jobs (fingerprint, soft_key, company_id, external_id, ats, title, title_normalized, url)
        VALUES ('fp-test-001', 'sk-test-001', {co}, 'ext-001', 'greenhouse',
                'SWE', 'swe', 'https://example.com/jobs/1')
        ON CONFLICT (fingerprint) DO NOTHING
    """))
    job = (await db.execute(text("SELECT id FROM jobs WHERE fingerprint='fp-test-001'"))).scalar()
    await db.commit()

    # First apply
    r1 = await client.post("/api/applications", json={
        "job_id": job, "user_id": user, "status": "applied"
    })
    assert r1.status_code == 200
    assert r1.json()["status"] == "applied"

    # Second apply (double-click) — must be 200, not 409
    r2 = await client.post("/api/applications", json={
        "job_id": job, "user_id": user, "status": "applied"
    })
    assert r2.status_code == 200
    assert r2.json()["status"] == "applied"

    # Only one record should exist
    count = (await db.execute(
        text(f"SELECT COUNT(*) FROM applications WHERE job_id={job} AND user_id={user}")
    )).scalar()
    assert count == 1
