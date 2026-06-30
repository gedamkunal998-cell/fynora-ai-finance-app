"""Security regression tests for SEC-001..SEC-005 (Fynora security audit fixes)."""
import os
import re
import time
import jwt as pyjwt
import requests
import pytest

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://fynora-ai-finance.preview.emergentagent.com").rstrip("/")


def _signup_unique(api_client, prefix: str = "secqa") -> tuple[str, str, dict]:
    """Create a fresh user, return (email, password, headers)."""
    email = f"{prefix}_{int(time.time()*1000)}@fynora.app"
    password = "Pass1234!"
    r = api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "SecQA", "email": email, "password": password})
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    return email, password, {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# SEC-001: forgot-password / reset-password
# ---------------------------------------------------------------------------
class TestSEC001ForgotPasswordNoTokenLeak:
    def test_forgot_password_existing_email_does_not_leak_token(self, api_client):
        email, _, _ = _signup_unique(api_client, "sec001a")
        r = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        data = r.json()
        for k in ("dev_token", "token", "reset_token", "access_token"):
            assert k not in data, f"SEC-001 LEAK: {k} returned in forgot-password: {data}"

    def test_forgot_password_non_existing_email_same_response(self, api_client):
        """Email enumeration: both existing and non-existing must yield identical response."""
        email_existing, _, _ = _signup_unique(api_client, "sec001b")
        r1 = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email_existing})
        r2 = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": f"nobody_{int(time.time())}@fynora.app"})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json(), f"SEC-001 enumeration: differing responses {r1.json()} vs {r2.json()}"

    def test_reset_password_with_never_issued_token_returns_400(self, api_client):
        # forged JWT-shaped token never persisted in password_resets
        r = api_client.post(
            f"{BASE_URL}/api/auth/reset-password",
            json={"token": "eyJhbGciOiJIUzI1NiJ9.fakefake.signature", "new_password": "Whatever1234"},
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_reset_password_token_is_single_use(self, api_client):
        """The first reset must succeed. Re-using the same token must return 400.

        Because forgot-password no longer leaks the raw token, we extract it from
        the backend logs (test-only side channel)."""
        email, _, _ = _signup_unique(api_client, "sec001c")
        # Issue reset token
        r = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200

        # Pull raw token from backend log (best-effort dev-side channel only — fails
        # cleanly if logs are not retained, in which case we cannot fully verify
        # single-use semantics and skip).
        token = None
        try:
            with open("/var/log/supervisor/backend.out.log", "r", errors="ignore") as fh:
                logs = fh.read()
        except Exception:
            logs = ""
        # Try common token patterns: bare JWT in any reset-related log line.
        for line in logs.splitlines()[::-1]:
            m = re.search(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+", line)
            if m and "reset" in line.lower():
                token = m.group(0)
                break
        if not token:
            pytest.skip("Reset token not exposed in logs (expected after SEC-001 fix); cannot self-issue & test single-use without DB access")

        # First use → success
        r1 = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": "NewPass5678!"})
        assert r1.status_code == 200, f"first reset should succeed: {r1.status_code} {r1.text}"
        # Second use → MUST fail
        r2 = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": "AnotherPass9999!"})
        assert r2.status_code == 400, f"SEC-001: token re-use should be 400 got {r2.status_code}"


# ---------------------------------------------------------------------------
# SEC-002: token_version / logout / password-reset invalidates old JWTs
# ---------------------------------------------------------------------------
class TestSEC002TokenVersionRevocation:
    def test_login_token_has_tv_claim(self, api_client):
        _, _, headers = _signup_unique(api_client, "sec002a")
        token = headers["Authorization"].split(" ", 1)[1]
        decoded = pyjwt.decode(token, options={"verify_signature": False})
        assert "tv" in decoded, f"SEC-002: tv claim missing in JWT payload: {decoded}"
        assert isinstance(decoded["tv"], int)

    def test_logout_revokes_old_jwt(self, api_client):
        _, _, headers = _signup_unique(api_client, "sec002b")
        # token works
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r.status_code == 200
        # logout
        rl = api_client.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        assert rl.status_code == 200
        # old token must now be rejected
        r2 = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r2.status_code == 401, f"SEC-002: old JWT still valid after logout: {r2.status_code}"

    def test_password_reset_invalidates_old_jwt(self, api_client):
        email, password, headers = _signup_unique(api_client, "sec002c")
        # confirm token works
        assert api_client.get(f"{BASE_URL}/api/auth/me", headers=headers).status_code == 200

        # Trigger forgot-password and try to obtain token from logs (same channel as SEC-001)
        api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
        token = None
        try:
            with open("/var/log/supervisor/backend.out.log", "r", errors="ignore") as fh:
                logs = fh.read()
        except Exception:
            logs = ""
        for line in logs.splitlines()[::-1]:
            m = re.search(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+", line)
            if m and "reset" in line.lower():
                token = m.group(0)
                break
        if not token:
            # Fall back: simulate "any password change" by hitting logout (which
            # also bumps token_version) and verifying the old JWT dies. This
            # validates the token_version revocation primitive even if we can't
            # access the raw reset token.
            api_client.post(f"{BASE_URL}/api/auth/logout", headers=headers)
            r_after = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
            assert r_after.status_code == 401
            pytest.skip("Raw reset token unavailable in logs (correct after SEC-001); validated token_version bump via logout instead")
            return

        # Reset password
        rr = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": "BrandNew1234!"})
        assert rr.status_code == 200, rr.text
        # Old JWT must now be invalid
        r2 = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r2.status_code == 401, f"SEC-002: old JWT still valid after password reset: {r2.status_code}"


# ---------------------------------------------------------------------------
# SEC-003: premium/verify must reject stub-mode orders
# ---------------------------------------------------------------------------
class TestSEC003PremiumStubRejected:
    def test_verify_stub_order_returns_503_and_no_subscription(self, api_client):
        _, _, headers = _signup_unique(api_client, "sec003")
        # Create an order in stub mode (current env has placeholder Razorpay key)
        ro = api_client.post(f"{BASE_URL}/api/premium/order", headers=headers, json={"plan_id": "monthly"})
        assert ro.status_code == 200, ro.text
        order = ro.json()
        order_id = order.get("order_id") or order.get("id")
        assert order_id, f"no order_id in stub order response: {order}"

        # Attempt to verify with bogus payment id/sig
        rv = api_client.post(
            f"{BASE_URL}/api/premium/verify",
            headers=headers,
            json={
                "razorpay_order_id": order_id,
                "razorpay_payment_id": "pay_FAKE_stub_attack",
                "razorpay_signature": "deadbeef",
            },
        )
        assert rv.status_code == 503, f"SEC-003: stub verify should be 503, got {rv.status_code}: {rv.text}"

        # premium status must remain false
        rs = api_client.get(f"{BASE_URL}/api/premium/status", headers=headers)
        assert rs.status_code == 200
        assert rs.json().get("is_premium") is False, f"SEC-003 CRITICAL: stub order granted premium! {rs.json()}"


# ---------------------------------------------------------------------------
# SEC-004: transactions search is re.escape'd, no ReDoS, literal-only match
# ---------------------------------------------------------------------------
class TestSEC004TransactionSearchLiteral:
    def test_redos_pattern_returns_promptly_and_only_literal_matches(self, api_client):
        _, _, headers = _signup_unique(api_client, "sec004")
        # Seed: one merchant containing the literal regex chars, one normal
        api_client.post(f"{BASE_URL}/api/transactions", headers=headers, json={
            "amount": 100, "type": "debit", "merchant": ".*(a+)+$ store", "payment_method": "upi", "source": "manual",
        })
        api_client.post(f"{BASE_URL}/api/transactions", headers=headers, json={
            "amount": 200, "type": "debit", "merchant": "Swiggy", "payment_method": "upi", "source": "manual",
        })

        # First confirm seed is visible (no search)
        rlist = api_client.get(f"{BASE_URL}/api/transactions", headers=headers, params={"range": "month"})
        assert rlist.status_code == 200
        seeded_merchants = [t["merchant"] for t in rlist.json()]
        assert any(".*(a+)+$" in m for m in seeded_merchants), f"seed visible failed: {seeded_merchants}"

        start = time.time()
        r = api_client.get(f"{BASE_URL}/api/transactions", headers=headers, params={"range": "month", "search": ".*(a+)+$"}, timeout=10)
        elapsed = time.time() - start
        assert r.status_code == 200, r.text
        assert elapsed < 5.0, f"SEC-004 ReDoS suspect: search took {elapsed:.2f}s"
        items = r.json()
        # only the merchant literally containing the substring should match
        merchants = [t["merchant"] for t in items]
        assert any(".*(a+)+$" in m for m in merchants), f"literal substring not matched: {merchants}"
        assert "Swiggy" not in merchants, f"SEC-004: regex metacharacters interpreted (Swiggy matched): {merchants}"


# ---------------------------------------------------------------------------
# SEC-005: restore field allowlist + cross-user prevention
# ---------------------------------------------------------------------------
class TestSEC005RestoreAllowlist:
    def test_unknown_fields_dropped_and_user_id_is_caller(self, api_client):
        _, _, headers_a = _signup_unique(api_client, "sec005a")
        _, _, headers_b = _signup_unique(api_client, "sec005b")

        # Get user_id of user B (the would-be cross-user target)
        rb = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers_b)
        assert rb.status_code == 200
        other_user_id = rb.json()["user_id"]

        unique_txn_id = f"txn_sec005_{int(time.time()*1000)}"
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {"transactions": [{
            "txn_id": unique_txn_id,
            "amount": 100,
            "type": "debit",
            "merchant": "AllowlistTest",
            "date": now_iso,
            "created_at": now_iso,
            "hacker_field": "pwned",
            "user_id": other_user_id,          # attempt cross-user write
            "is_admin": True,                  # arbitrary unknown field
            "__proto__": {"polluted": True},
        }]}
        rr = api_client.post(f"{BASE_URL}/api/restore", headers=headers_a, json=payload)
        assert rr.status_code == 200, rr.text

        # As user A: the txn should exist and not contain unknown fields, and user_id must == A
        rl = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=headers_a)
        assert rl.status_code == 200
        mine = [t for t in rl.json() if t.get("txn_id") == unique_txn_id]
        assert len(mine) == 1, f"SEC-005: restored txn not visible to caller: {rl.json()}"
        saved = mine[0]
        for forbidden in ("hacker_field", "is_admin", "__proto__"):
            assert forbidden not in saved, f"SEC-005: unknown field {forbidden} persisted: {saved}"

        # As user B: must NOT see that txn (cross-user write was blocked)
        rl_b = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=headers_b)
        assert rl_b.status_code == 200
        cross = [t for t in rl_b.json() if t.get("txn_id") == unique_txn_id]
        assert cross == [], f"SEC-005 CRITICAL: cross-user write succeeded for user B: {cross}"


# ---------------------------------------------------------------------------
# Regression sanity: happy-path remains intact
# ---------------------------------------------------------------------------
class TestRegressionHappyPath:
    def test_signup_login_me_txn_dashboard(self, api_client):
        email, password, headers = _signup_unique(api_client, "secreg")
        # login produces JWT with tv claim
        rl = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
        assert rl.status_code == 200, rl.text
        tok = rl.json()["access_token"]
        decoded = pyjwt.decode(tok, options={"verify_signature": False})
        assert "tv" in decoded
        h = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
        # me
        assert api_client.get(f"{BASE_URL}/api/auth/me", headers=h).status_code == 200
        # create txn
        rt = api_client.post(f"{BASE_URL}/api/transactions", headers=h, json={
            "amount": 250, "type": "debit", "merchant": "Swiggy", "payment_method": "upi", "source": "manual",
        })
        assert rt.status_code == 200, rt.text
        assert "txn_id" in rt.json()
        # dashboard
        rd = api_client.get(f"{BASE_URL}/api/dashboard", headers=h)
        assert rd.status_code == 200
        # insights
        ri = api_client.get(f"{BASE_URL}/api/insights", headers=h, timeout=60)
        assert ri.status_code == 200
        body = ri.json()
        assert "ai_status" in body and body["ai_status"] in ("ok", "fallback")
        # budgets / goals / backup
        assert api_client.get(f"{BASE_URL}/api/budgets", headers=h).status_code == 200
        assert api_client.get(f"{BASE_URL}/api/goals", headers=h).status_code == 200
        assert api_client.get(f"{BASE_URL}/api/backup", headers=h).status_code == 200
        # parse-sms
        rs = api_client.post(f"{BASE_URL}/api/transactions/parse-sms", headers=h, json={
            "messages": ["Rs. 250 debited from A/c via UPI to Zomato on 02-02-2026"],
        })
        assert rs.status_code == 200

    def test_demo_account_login(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "demo@fynora.app", "password": "demo1234"})
        # Demo account should remain usable for frontend regression
        assert r.status_code == 200, f"demo account login failed: {r.status_code} {r.text}"
        assert "access_token" in r.json()
