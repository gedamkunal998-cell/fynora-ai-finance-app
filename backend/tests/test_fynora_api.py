"""Fynora backend integration tests - all endpoints."""
import os
import time
import requests
import pytest

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://fynora-ai-finance.preview.emergentagent.com").rstrip("/")


# --- Auth ---
class TestAuth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("app") == "Fynora"

    def test_login_success(self, api_client, auth_token):
        assert auth_token and isinstance(auth_token, str) and len(auth_token) > 20

    def test_login_wrong_password(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "test@fynora.app", "password": "WRONG_PASSWORD"})
        assert r.status_code == 401

    def test_me_without_token(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "test@fynora.app"
        assert "user_id" in data
        assert "password_hash" not in data

    def test_signup_duplicate(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "Dup", "email": "test@fynora.app", "password": "Fynora@2026"})
        assert r.status_code == 400

    def test_signup_new_user(self, api_client):
        email = f"test_new_{int(time.time())}@fynora.app"
        r = api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "Temp", "email": email, "password": "Pass1234"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == email

    def test_forgot_and_reset_password(self, api_client):
        # create dedicated user so we don't mess up main test password
        email = f"test_reset_{int(time.time())}@fynora.app"
        api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "ResetTest", "email": email, "password": "OldPass1234"})
        r = api_client.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": email})
        assert r.status_code == 200
        data = r.json()
        assert "dev_token" in data, f"dev_token missing: {data}"
        token = data["dev_token"]
        r2 = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": "NewPass5678"})
        assert r2.status_code == 200
        # verify new password works
        r3 = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "NewPass5678"})
        assert r3.status_code == 200

    def test_reset_password_invalid_token(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/reset-password", json={"token": "invalid.token.here", "new_password": "Whatever1234"})
        assert r.status_code == 400

    def test_google_session_invalid(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/auth/google-session", json={"session_id": "invalid_session_xyz"})
        # 401 expected; provider could also throw 502
        assert r.status_code in (401, 502), r.text


# --- Transactions ---
class TestTransactions:
    created_ids = []

    def test_create_txn_swiggy_food(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/transactions", headers=auth_headers, json={
            "amount": 350, "type": "debit", "merchant": "Swiggy", "payment_method": "upi", "source": "manual"
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "Food"
        assert "txn_id" in d
        TestTransactions.created_ids.append(d["txn_id"])

    def test_create_txn_amazon_shopping(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/transactions", headers=auth_headers, json={
            "amount": 1200, "type": "debit", "merchant": "Amazon", "payment_method": "card", "source": "manual"
        })
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "Shopping"
        TestTransactions.created_ids.append(d["txn_id"])

    def test_list_txns_month(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=month", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 2

    def test_list_txns_today(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=today", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_txns_week(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=week", headers=auth_headers)
        assert r.status_code == 200

    def test_list_txns_all(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=auth_headers)
        assert r.status_code == 200

    def test_list_txns_filter_category(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=month&category=Food", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        for t in items:
            assert t["category"] == "Food"

    def test_list_txns_search(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/transactions?range=month&search=swi", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert any("swi" in t["merchant"].lower() for t in items)

    def test_parse_sms(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/transactions/parse-sms", headers=auth_headers, json={
            "messages": [
                "Rs. 250 debited from A/c via UPI to Zomato on 02-02-2026",
                "INR 80000 credited to your A/c as Salary from ABC Corp",
            ]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] >= 1
        zomato = next((t for t in d["transactions"] if t["merchant"].lower() == "zomato"), None)
        assert zomato is not None, f"Zomato not found: {d}"
        assert zomato["type"] == "debit"
        assert zomato["amount"] == 250
        assert zomato["category"] == "Food"

    def test_parse_sms_dedup(self, api_client, auth_headers):
        # Send same Zomato msg again — should be deduped within 2 min
        r = api_client.post(f"{BASE_URL}/api/transactions/parse-sms", headers=auth_headers, json={
            "messages": ["Rs. 250 debited from A/c via UPI to Zomato on 02-02-2026"]
        })
        assert r.status_code == 200
        # may be 0 created due to dedup
        assert r.json()["created"] == 0

    def test_delete_txn(self, api_client, auth_headers):
        if not TestTransactions.created_ids:
            pytest.skip("no txn to delete")
        txn_id = TestTransactions.created_ids[0]
        r = api_client.delete(f"{BASE_URL}/api/transactions/{txn_id}", headers=auth_headers)
        assert r.status_code == 200
        # verify removed
        r2 = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=auth_headers)
        assert all(t["txn_id"] != txn_id for t in r2.json())


# --- Dashboard / Aggregates ---
class TestDashboard:
    def test_dashboard(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("income", "expenses", "savings", "spending_score", "rating", "categories", "recent", "month"):
            assert k in d, f"missing key {k}"
        assert 0 <= d["spending_score"] <= 100
        assert d["rating"] in ("Excellent", "Good", "Average", "Needs Improvement")

    def test_streak(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/streak", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "current_streak" in d and "best_streak" in d

    def test_merchants(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/merchants", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        if items:
            amounts = [m["amount"] for m in items]
            assert amounts == sorted(amounts, reverse=True)

    def test_calendar(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/calendar", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "month" in d and "year" in d and "days" in d

    def test_recurring(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/recurring", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# --- Budgets ---
class TestBudgets:
    bid = None

    def test_create_budget(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/budgets", headers=auth_headers, json={"category": "Food", "amount": 2000})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "Food"
        assert d["amount"] == 2000
        TestBudgets.bid = d["budget_id"]

    def test_list_budgets(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/budgets", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        food = next((b for b in items if b["category"] == "Food"), None)
        assert food is not None
        for k in ("used", "remaining", "percent"):
            assert k in food

    def test_budget_upsert(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/budgets", headers=auth_headers, json={"category": "Food", "amount": 2500})
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/budgets", headers=auth_headers)
        food = next((b for b in r2.json() if b["category"] == "Food"), None)
        assert food["amount"] == 2500

    def test_delete_budget(self, api_client, auth_headers):
        if not TestBudgets.bid:
            pytest.skip()
        r = api_client.delete(f"{BASE_URL}/api/budgets/{TestBudgets.bid}", headers=auth_headers)
        assert r.status_code == 200


# --- Goals ---
class TestGoals:
    gid = None

    def test_create_goal(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/goals", headers=auth_headers, json={"name": "TEST_Bike", "target_amount": 50000, "current_amount": 5000})
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Bike"
        TestGoals.gid = d["goal_id"]

    def test_list_goals(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/goals", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        g = next((x for x in items if x["goal_id"] == TestGoals.gid), None)
        assert g is not None
        assert "progress" in g

    def test_update_goal(self, api_client, auth_headers):
        if not TestGoals.gid:
            pytest.skip()
        r = api_client.patch(f"{BASE_URL}/api/goals/{TestGoals.gid}", headers=auth_headers, json={"current_amount": 10000})
        assert r.status_code == 200
        r2 = api_client.get(f"{BASE_URL}/api/goals", headers=auth_headers)
        g = next((x for x in r2.json() if x["goal_id"] == TestGoals.gid), None)
        assert g["current_amount"] == 10000

    def test_delete_goal(self, api_client, auth_headers):
        if not TestGoals.gid:
            pytest.skip()
        r = api_client.delete(f"{BASE_URL}/api/goals/{TestGoals.gid}", headers=auth_headers)
        assert r.status_code == 200


# --- Insights / Report / Achievements ---
class TestInsights:
    def test_insights(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/insights", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "insights" in d
        assert isinstance(d["insights"], list)
        assert len(d["insights"]) >= 1
        # NEW: ai_status field must be present and one of ok | fallback
        assert "ai_status" in d, f"ai_status missing in /api/insights: {d}"
        assert d["ai_status"] in ("ok", "fallback")

    def test_insights_refresh(self, api_client, auth_headers):
        r = api_client.post(f"{BASE_URL}/api/insights/refresh", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("insights"), list)
        # NEW: ai_status field must be present and one of ok | fallback
        assert "ai_status" in d, f"ai_status missing in /api/insights/refresh: {d}"
        assert d["ai_status"] in ("ok", "fallback")

    def test_weekly_report(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/report/weekly", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("income", "expenses", "savings", "highest_category", "lowest_category", "tips", "period"):
            assert k in d

    def test_achievements(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/achievements", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 6
        for b in items:
            assert "badge_id" in b and "unlocked" in b


# --- Settings / Export / Push ---
class TestMisc:
    def test_settings_patch(self, api_client, auth_headers):
        r = api_client.patch(f"{BASE_URL}/api/settings", headers=auth_headers, json={"theme": "dark", "language": "en", "notifications_enabled": True})
        assert r.status_code == 200
        d = r.json()
        assert d["theme"] == "dark"

    def test_export_csv(self, api_client, auth_headers):
        r = api_client.get(f"{BASE_URL}/api/export/csv", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert "filename" in d and "content" in d
        assert d["filename"].endswith(".csv")
        assert "Date,Merchant,Category" in d["content"]

    def test_register_push_expected_500(self, api_client, auth_headers):
        # EMERGENT_PUSH_KEY is placeholder, expected to fail upstream → 500
        r = api_client.post(f"{BASE_URL}/api/register-push", headers=auth_headers, json={"platform": "ios", "device_token": "demo-token"})
        assert r.status_code in (500, 502), f"expected 500/502 but got {r.status_code}: {r.text}"


# --- Backup / Restore (NEW endpoints in iteration_4) ---
class TestBackupRestore:
    """Tests for new /api/backup and /api/restore endpoints introduced in iteration 4.

    Uses a dedicated throwaway user so it does not pollute the main test@fynora.app account.
    """
    user_email = None
    user_token = None
    user_headers = None
    backup_json = None

    @classmethod
    def _ensure_user(cls, api_client):
        if cls.user_headers:
            return
        cls.user_email = f"test_backup_{int(time.time())}@fynora.app"
        r = api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "BackupQA", "email": cls.user_email, "password": "BackupQA1234"})
        assert r.status_code == 200, r.text
        cls.user_token = r.json()["access_token"]
        cls.user_headers = {"Authorization": f"Bearer {cls.user_token}", "Content-Type": "application/json"}
        # seed: 2 transactions, 1 budget, 1 goal
        api_client.post(f"{BASE_URL}/api/transactions", headers=cls.user_headers, json={"amount": 200, "type": "debit", "merchant": "Swiggy", "payment_method": "upi", "source": "manual"})
        api_client.post(f"{BASE_URL}/api/transactions", headers=cls.user_headers, json={"amount": 50000, "type": "credit", "merchant": "Salary ABC Corp", "payment_method": "bank", "source": "manual"})
        api_client.post(f"{BASE_URL}/api/budgets", headers=cls.user_headers, json={"category": "Food", "amount": 3000})
        api_client.post(f"{BASE_URL}/api/goals", headers=cls.user_headers, json={"name": "TEST_BackupGoal", "target_amount": 100000, "current_amount": 10000})

    def test_backup_export(self, api_client):
        TestBackupRestore._ensure_user(api_client)
        r = api_client.get(f"{BASE_URL}/api/backup", headers=TestBackupRestore.user_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        # schema
        assert d.get("schema") == 1, f"schema must be 1, got {d.get('schema')}"
        assert "exported_at" in d and isinstance(d["exported_at"], str)
        # counts block with the four keys
        assert "counts" in d and isinstance(d["counts"], dict)
        for k in ("transactions", "budgets", "goals", "achievements"):
            assert k in d["counts"], f"counts.{k} missing"
            assert isinstance(d["counts"][k], int)
        # The four arrays must be present
        for k in ("transactions", "budgets", "goals", "achievements"):
            assert k in d and isinstance(d[k], list), f"array {k} missing"
        # settings block
        assert "settings" in d and isinstance(d["settings"], dict)
        # counts should match seeded data
        assert d["counts"]["transactions"] >= 2
        assert d["counts"]["budgets"] >= 1
        assert d["counts"]["goals"] >= 1
        # no mongo _id leakage
        for t in d["transactions"]:
            assert "_id" not in t
        TestBackupRestore.backup_json = d

    def test_restore_replace_false_no_dupes(self, api_client):
        TestBackupRestore._ensure_user(api_client)
        assert TestBackupRestore.backup_json is not None, "run test_backup_export first"
        # snapshot count
        r0 = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=TestBackupRestore.user_headers)
        before = len(r0.json())
        # restore same transactions back with replace=false → should NOT create duplicates (upsert by txn_id)
        payload = {"transactions": TestBackupRestore.backup_json["transactions"], "replace": False}
        r = api_client.post(f"{BASE_URL}/api/restore", headers=TestBackupRestore.user_headers, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "added" in d and isinstance(d["added"], dict)
        # verify final count == before (no dupes since upsert on txn_id)
        r1 = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=TestBackupRestore.user_headers)
        after = len(r1.json())
        assert after == before, f"restore replace=false created dupes: before={before} after={after}"

    def test_restore_replace_true_wipes_existing(self, api_client):
        TestBackupRestore._ensure_user(api_client)
        # confirm there is data before
        r0 = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=TestBackupRestore.user_headers)
        assert len(r0.json()) >= 1
        # replace=true with empty transactions list should wipe
        r = api_client.post(f"{BASE_URL}/api/restore", headers=TestBackupRestore.user_headers, json={"transactions": [], "replace": True})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("replaced") is True
        # verify wiped
        r1 = api_client.get(f"{BASE_URL}/api/transactions?range=all", headers=TestBackupRestore.user_headers)
        assert r1.json() == [], f"replace=true did not wipe: {r1.json()}"
        # budgets and goals should also be wiped
        rb = api_client.get(f"{BASE_URL}/api/budgets", headers=TestBackupRestore.user_headers)
        assert rb.json() == [], f"replace=true did not wipe budgets: {rb.json()}"
        rg = api_client.get(f"{BASE_URL}/api/goals", headers=TestBackupRestore.user_headers)
        assert rg.json() == [], f"replace=true did not wipe goals: {rg.json()}"

    def test_restore_unauthorized(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/restore", json={"transactions": [], "replace": False})
        assert r.status_code == 401

    def test_backup_unauthorized(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/backup")
        assert r.status_code == 401
