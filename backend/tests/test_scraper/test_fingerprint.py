from jam.scraper.fingerprint import compute_fingerprint, compute_soft_key, normalize_text


def test_fingerprint_deterministic():
    fp1 = compute_fingerprint("greenhouse", "stripe", "12345")
    fp2 = compute_fingerprint("greenhouse", "stripe", "12345")
    assert fp1 == fp2


def test_fingerprint_different_ats():
    fp1 = compute_fingerprint("greenhouse", "stripe", "12345")
    fp2 = compute_fingerprint("lever", "stripe", "12345")
    assert fp1 != fp2


def test_fingerprint_length():
    fp = compute_fingerprint("ashby", "anthropic", "abc-uuid-123")
    assert len(fp) == 64


def test_soft_key_case_insensitive():
    sk1 = compute_soft_key("Senior Software Engineer", "Stripe")
    sk2 = compute_soft_key("senior software engineer", "stripe")
    assert sk1 == sk2


def test_soft_key_strips_stop_words():
    sk1 = compute_soft_key("Senior Remote Software Engineer", "Acme")
    sk2 = compute_soft_key("Software Engineer Remote Senior", "Acme")
    # After normalization, order and stop words shouldn't matter much
    assert sk1 == sk2


def test_normalize_removes_punctuation():
    result = normalize_text("Senior (Backend) Engineer — Remote OK!")
    assert "(" not in result
    assert "—" not in result
    assert "!" not in result
