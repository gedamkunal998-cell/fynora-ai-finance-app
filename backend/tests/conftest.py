import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://fynora-ai-finance.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")

TEST_EMAIL = "test@fynora.app"
TEST_PASSWORD = "Fynora@2026"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    # try login; if fails, signup
    r = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code == 200:
        return r.json()["access_token"]
    r2 = api_client.post(f"{BASE_URL}/api/auth/signup", json={"name": "Fynora Tester", "email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r2.status_code == 200:
        return r2.json()["access_token"]
    pytest.skip(f"Cannot establish auth. login={r.status_code} signup={r2.status_code}")


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
