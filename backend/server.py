"""Fynora — AI Powered Personal Finance Assistant backend."""
import os
import re
import uuid
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone, date
from typing import List, Optional, Dict, Any

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Header, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
ACCESS_TOKEN_REMEMBER_MINUTES = int(os.environ.get("ACCESS_TOKEN_REMEMBER_MINUTES", "43200"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "placeholder")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "placeholder")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "placeholder")

# Premium plans (amounts in paise = INR * 100)
PREMIUM_PLANS = {
    "monthly": {"id": "monthly", "name": "Pro Monthly", "amount": 19900, "currency": "INR", "period": "month", "features": ["unlimited_ocr", "multi_currency", "premium_insights", "priority_support"]},
    "annual": {"id": "annual", "name": "Pro Annual", "amount": 179900, "currency": "INR", "period": "year", "features": ["unlimited_ocr", "multi_currency", "premium_insights", "priority_support", "early_access"]},
}

# Supported currencies (multi-currency)
SUPPORTED_CURRENCIES = {
    "INR": {"symbol": "₹", "name": "Indian Rupee"},
    "USD": {"symbol": "$", "name": "US Dollar"},
    "EUR": {"symbol": "€", "name": "Euro"},
    "GBP": {"symbol": "£", "name": "British Pound"},
    "AED": {"symbol": "د.إ", "name": "UAE Dirham"},
    "SGD": {"symbol": "S$", "name": "Singapore Dollar"},
}

EMERGENT_AUTH_BASE = "https://demobackend.emergentagent.com"
EMERGENT_PUSH_BASE = "https://integrations.emergentagent.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

push_client = httpx.AsyncClient(
    base_url=EMERGENT_PUSH_BASE,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)
auth_client = httpx.AsyncClient(base_url=EMERGENT_AUTH_BASE, timeout=10.0)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fynora")

from contextlib import asynccontextmanager

# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app_: FastAPI):
    # Startup
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.transactions.create_index([("user_id", 1), ("date", -1)])
    await db.budgets.create_index([("user_id", 1), ("category", 1), ("period_month", 1), ("period_year", 1)], unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    logger.info("Fynora backend ready ✨")
    yield
    # Shutdown
    await push_client.aclose()
    await auth_client.aclose()
    client.close()


app = FastAPI(title="Fynora API", lifespan=lifespan)
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_jwt(user_id: str, remember: bool = False) -> str:
    minutes = ACCESS_TOKEN_REMEMBER_MINUTES if remember else ACCESS_TOKEN_EXPIRE_MINUTES
    payload = {
        "sub": user_id,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_reset_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "password_reset",
        "iat": now_utc(),
        "exp": now_utc() + timedelta(minutes=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


async def get_user_from_token(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    token = authorization.split(" ", 1)[1]
    # try emergent session first
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        expires = ensure_aware(session["expires_at"])
        if expires < now_utc():
            raise HTTPException(401, "Session expired")
        user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    # else JWT
    payload = decode_jwt(token)
    if not payload or "sub" not in payload:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SignupReq(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    remember: bool = False


class LoginReq(BaseModel):
    email: EmailStr
    password: str
    remember: bool = False


class ForgotReq(BaseModel):
    email: EmailStr


class ResetReq(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class GoogleSessionReq(BaseModel):
    session_id: str


class TransactionReq(BaseModel):
    amount: float
    type: str  # debit | credit
    merchant: str
    category: Optional[str] = None
    payment_method: str = "manual"  # manual | upi | card | cash | sms
    date: Optional[str] = None  # ISO
    description: Optional[str] = ""
    source: str = "manual"  # manual | sms


class SMSParseReq(BaseModel):
    messages: List[str]


class BudgetReq(BaseModel):
    category: str
    amount: float
    period_month: Optional[int] = None  # 1-12
    period_year: Optional[int] = None


class GoalReq(BaseModel):
    name: str
    target_amount: float
    current_amount: float = 0
    target_date: Optional[str] = None
    icon: str = "target"


class GoalUpdateReq(BaseModel):
    current_amount: Optional[float] = None
    target_amount: Optional[float] = None
    target_date: Optional[str] = None


class PushReg(BaseModel):
    platform: str
    device_token: str


class SettingsReq(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    notifications_enabled: Optional[bool] = None


# ---------------------------------------------------------------------------
# AI: Categorization rules + Claude fallback
# ---------------------------------------------------------------------------
CATEGORY_RULES = {
    "Food": ["swiggy", "zomato", "dominos", "pizza", "kfc", "mcdonald", "restaurant", "cafe", "food", "biryani", "starbucks"],
    "Fuel": ["petrol", "indianoil", "hp ", "iocl", "bpcl", "shell", "fuel", "diesel"],
    "Shopping": ["amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tata cliq", "shoppers", "lifestyle"],
    "Travel": ["uber", "ola", "rapido", "irctc", "indigo", "airline", "makemytrip", "goibibo", "yatra"],
    "Bills": ["electricity", "internet", "wifi", "broadband", "mobile recharge", "airtel", "jio", "vodafone", "bescom", "tata power", "gas"],
    "Healthcare": ["pharmacy", "apollo", "medplus", "1mg", "pharmeasy", "hospital", "clinic", "lab", "diagnostic"],
    "Education": ["udemy", "coursera", "byjus", "unacademy", "books", "tuition", "school", "college", "fees"],
    "Entertainment": ["netflix", "prime", "hotstar", "spotify", "youtube", "movie", "pvr", "inox", "bookmyshow", "gaming"],
    "Rent": ["rent", "lease", "landlord"],
    "EMI": ["emi", "loan", "installment"],
    "Salary": ["salary", "stipend", "payroll", "credited by employer"],
    "Investment": ["sip", "mutual fund", "stocks", "zerodha", "groww", "upstox", "kite"],
}

CATEGORY_ICONS = {
    "Food": "restaurant",
    "Fuel": "local-gas-station",
    "Shopping": "shopping-bag",
    "Travel": "flight",
    "Bills": "receipt-long",
    "Healthcare": "local-hospital",
    "Education": "school",
    "Entertainment": "movie",
    "Rent": "home",
    "EMI": "account-balance",
    "Salary": "payments",
    "Investment": "trending-up",
    "Others": "category",
}


def rule_categorize(merchant: str, description: str = "") -> Optional[str]:
    text = f"{merchant} {description}".lower()
    for cat, kws in CATEGORY_RULES.items():
        for kw in kws:
            if kw in text:
                return cat
    return None


async def claude_categorize(merchant: str, description: str = "") -> str:
    """Fallback: ask Claude to categorize. Cached in DB."""
    cache_key = merchant.strip().lower()
    cached = await db.category_cache.find_one({"merchant": cache_key}, {"_id": 0})
    if cached:
        return cached["category"]
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        cats = ", ".join(list(CATEGORY_RULES.keys()) + ["Others"])
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"categorize-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are an Indian expense categorizer. Reply with ONLY one word from the allowed categories. "
                f"Categories: {cats}."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=f"Merchant: {merchant}\nDescription: {description}\nReturn one category word only."))
        cat = (resp or "").strip().split()[0].rstrip(".,") if resp else "Others"
        if cat not in CATEGORY_RULES and cat != "Others":
            cat = "Others"
        await db.category_cache.insert_one({"merchant": cache_key, "category": cat, "created_at": now_utc()})
        return cat
    except Exception as e:
        logger.warning(f"Claude categorize failed: {e}")
        return "Others"


async def auto_categorize(merchant: str, description: str = "") -> str:
    cat = rule_categorize(merchant, description)
    if cat:
        return cat
    return await claude_categorize(merchant, description)


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------
@api.post("/auth/signup")
async def signup(body: SignupReq):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = gen_id("user")
    doc = {
        "user_id": user_id,
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "provider": "email",
        "avatar": None,
        "theme": "dark",
        "language": "en",
        "notifications_enabled": True,
        "current_streak": 0,
        "best_streak": 0,
        "last_spend_date": None,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    token = create_jwt(user_id, body.remember)
    return {
        "access_token": token,
        "user": {"user_id": user_id, "name": body.name, "email": body.email.lower(), "provider": "email"},
    }


@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_jwt(user["user_id"], body.remember)
    return {
        "access_token": token,
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "email": user["email"],
            "provider": user.get("provider", "email"),
        },
    }


@api.post("/auth/google-session")
async def google_session(body: GoogleSessionReq):
    """Process Emergent Google session_id -> upsert user, store session_token."""
    try:
        resp = await auth_client.get(
            "/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
        if resp.status_code != 200:
            raise HTTPException(401, "Invalid session_id")
        data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Auth provider unavailable: {e}")

    email = data["email"].lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"avatar": picture or existing.get("avatar"), "name": existing.get("name") or name}},
        )
    else:
        user_id = gen_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "avatar": picture,
            "provider": "google",
            "password_hash": None,
            "theme": "dark",
            "language": "en",
            "notifications_enabled": True,
            "current_streak": 0,
            "best_streak": 0,
            "last_spend_date": None,
            "created_at": now_utc(),
        })

    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    return {
        "access_token": session_token,
        "user": {"user_id": user_id, "email": email, "name": name, "avatar": picture, "provider": "google"},
    }


@api.get("/auth/me")
async def me(authorization: Optional[str] = Header(None)):
    return await get_user_from_token(authorization)


@api.post("/auth/forgot-password")
async def forgot(body: ForgotReq):
    user = await db.users.find_one({"email": body.email.lower()})
    if user and user.get("password_hash"):
        token = create_reset_token(user["user_id"])
        # In production, send via email. For dev/demo: log + return.
        logger.info(f"[Fynora] Password reset link for {body.email}: token={token}")
        return {"message": "Reset link sent if account exists", "dev_token": token}
    return {"message": "Reset link sent if account exists"}


@api.post("/auth/reset-password")
async def reset(body: ResetReq):
    payload = decode_jwt(body.token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(400, "Invalid or expired token")
    res = await db.users.update_one(
        {"user_id": payload["sub"]},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "Password updated"}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"message": "logged out"}


# ---------------------------------------------------------------------------
# Push notifications
# ---------------------------------------------------------------------------
@api.post("/register-push", status_code=201)
async def register_push(body: PushReg, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    try:
        resp = await push_client.post(
            "/api/v1/push/users/register",
            json={"user_id": user["user_id"], "platform": body.platform, "device_token": body.device_token},
        )
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except httpx.HTTPError as e:
        logger.warning(f"register_push relay error: {e}")
        raise HTTPException(502, "Push provider unavailable")
    return {"status": "registered"}


async def send_push(recipients: List[str], data: Dict[str, Any], idempotency_key: Optional[str] = None) -> None:
    if not recipients:
        return
    if "title" not in data or "message" not in data:
        return
    payload: Dict[str, Any] = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        resp = await push_client.post("/api/v1/push/trigger", json=payload)
        if resp.status_code >= 400:
            logger.warning(f"send_push status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"send_push failed (non-blocking): {e}")


# ---------------------------------------------------------------------------
# SMS parsing
# ---------------------------------------------------------------------------
AMOUNT_RE = re.compile(r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)", re.I)
DEBIT_RE = re.compile(r"\b(debited|debit|paid|sent|spent|purchase|withdraw)", re.I)
CREDIT_RE = re.compile(r"\b(credited|credit|received|deposit|refund)", re.I)
MERCHANT_RE = re.compile(r"(?:to|at|for|towards|on)\s+([A-Z][A-Za-z0-9 &@*'._-]{2,40}?)(?:\s+(?:on|via|ref|info|upi|txn)|\.|,|$)", re.I)


def parse_sms_text(text: str) -> Optional[Dict[str, Any]]:
    amt_match = AMOUNT_RE.search(text)
    if not amt_match:
        return None
    amount = float(amt_match.group(1).replace(",", ""))
    if CREDIT_RE.search(text) and not DEBIT_RE.search(text):
        type_ = "credit"
    elif DEBIT_RE.search(text):
        type_ = "debit"
    else:
        return None
    merchant = "Unknown"
    m = MERCHANT_RE.search(text)
    if m:
        merchant = m.group(1).strip().rstrip(".").title()
    payment_method = "upi" if re.search(r"upi", text, re.I) else "card"
    return {
        "amount": amount,
        "type": type_,
        "merchant": merchant,
        "payment_method": payment_method,
        "description": text[:200],
        "source": "sms",
    }


@api.post("/transactions/parse-sms")
async def parse_sms(body: SMSParseReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    created = []
    for msg in body.messages:
        parsed = parse_sms_text(msg)
        if not parsed:
            continue
        # dedup: same amount/merchant within 2 min
        dup = await db.transactions.find_one({
            "user_id": user["user_id"],
            "amount": parsed["amount"],
            "merchant": parsed["merchant"],
            "source": "sms",
            "date": {"$gte": now_utc() - timedelta(minutes=2)},
        })
        if dup:
            continue
        category = await auto_categorize(parsed["merchant"], parsed["description"])
        doc = {
            "txn_id": gen_id("txn"),
            "user_id": user["user_id"],
            "amount": parsed["amount"],
            "type": parsed["type"],
            "merchant": parsed["merchant"],
            "category": category,
            "payment_method": parsed["payment_method"],
            "description": parsed["description"],
            "source": "sms",
            "date": now_utc(),
            "created_at": now_utc(),
        }
        await db.transactions.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    return {"created": len(created), "transactions": created}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
@api.post("/transactions")
async def create_txn(body: TransactionReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    cat = body.category or await auto_categorize(body.merchant, body.description or "")
    txn_date = now_utc()
    if body.date:
        try:
            txn_date = ensure_aware(datetime.fromisoformat(body.date.replace("Z", "+00:00")))
        except Exception:
            pass
    doc = {
        "txn_id": gen_id("txn"),
        "user_id": user["user_id"],
        "amount": body.amount,
        "type": body.type,
        "merchant": body.merchant,
        "category": cat,
        "payment_method": body.payment_method,
        "description": body.description or "",
        "source": body.source,
        "date": txn_date,
        "created_at": now_utc(),
    }
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    # update streak
    await _update_streak(user["user_id"], doc)
    return doc


def _serialize_txn(t: dict) -> dict:
    t.pop("_id", None)
    if isinstance(t.get("date"), datetime):
        t["date"] = ensure_aware(t["date"]).isoformat()
    if isinstance(t.get("created_at"), datetime):
        t["created_at"] = ensure_aware(t["created_at"]).isoformat()
    return t


@api.get("/transactions")
async def list_txns(
    range: str = "month",
    category: Optional[str] = None,
    search: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    user = await get_user_from_token(authorization)
    now = now_utc()
    if range == "today":
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif range == "week":
        start_dt = now - timedelta(days=7)
        end_dt = now
    elif range == "month":
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_dt = now
    elif range == "all":
        start_dt = now - timedelta(days=3650)
        end_dt = now
    elif range == "custom" and start and end:
        start_dt = ensure_aware(datetime.fromisoformat(start))
        end_dt = ensure_aware(datetime.fromisoformat(end))
    else:
        start_dt = now - timedelta(days=30)
        end_dt = now
    q: Dict[str, Any] = {"user_id": user["user_id"], "date": {"$gte": start_dt, "$lte": end_dt}}
    if category and category != "All":
        q["category"] = category
    if search:
        q["merchant"] = {"$regex": search, "$options": "i"}
    items = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(1000)
    return [_serialize_txn(t) for t in items]


@api.delete("/transactions/{txn_id}")
async def delete_txn(txn_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    await db.transactions.delete_one({"txn_id": txn_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Streak
# ---------------------------------------------------------------------------
async def _update_streak(user_id: str, txn: dict):
    """Seed last_spend_date on a debit; the real streak math runs in GET /streak."""
    if txn.get("type") != "debit":
        return
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"current_streak": 0, "last_spend_date": txn["date"]}},
    )


@api.get("/streak")
async def get_streak(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    # compute current streak: days since last debit
    last = await db.transactions.find_one(
        {"user_id": user["user_id"], "type": "debit"},
        sort=[("date", -1)],
    )
    today = now_utc().date()
    if last:
        last_date = ensure_aware(last["date"]).date()
        current = (today - last_date).days
    else:
        current = 0
    best = max(user.get("best_streak", 0), current)
    if best != user.get("best_streak", 0):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"best_streak": best}})
    return {"current_streak": current, "best_streak": best}


# ---------------------------------------------------------------------------
# Dashboard / Spending Score
# ---------------------------------------------------------------------------
def _compute_spending_score(income: float, expenses: float, budgets_pct: float) -> int:
    if income <= 0:
        savings_ratio = 0.0
    else:
        savings_ratio = max(0.0, (income - expenses) / income)
    # score: 60% savings ratio + 40% budget discipline (1 - budgets_pct over 100%)
    budget_disc = max(0.0, 1.0 - max(0.0, budgets_pct - 1.0))
    score = (savings_ratio * 60.0) + (budget_disc * 40.0)
    return max(0, min(100, int(round(score * 1.5))))


@api.get("/dashboard")
async def dashboard(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "date": {"$gte": start, "$lte": now}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]).to_list(10)
    totals = {r["_id"]: r["total"] for r in agg}
    income = float(totals.get("credit", 0))
    expenses = float(totals.get("debit", 0))
    savings = income - expenses
    budgets = await db.budgets.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    total_budget = sum(b["amount"] for b in budgets) or 1
    budgets_pct = expenses / total_budget if total_budget else 0
    score = _compute_spending_score(income, expenses, budgets_pct)
    if score >= 85:
        rating = "Excellent"
    elif score >= 65:
        rating = "Good"
    elif score >= 40:
        rating = "Average"
    else:
        rating = "Needs Improvement"
    # category breakdown
    cat_agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "type": "debit", "date": {"$gte": start, "$lte": now}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]).to_list(20)
    categories = [{"category": c["_id"] or "Others", "amount": float(c["total"])} for c in cat_agg]
    # last 5 txns
    recent = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).limit(5).to_list(5)
    return {
        "income": income,
        "expenses": expenses,
        "savings": savings,
        "spending_score": score,
        "rating": rating,
        "categories": categories,
        "recent": [_serialize_txn(t) for t in recent],
        "month": now.strftime("%B %Y"),
    }


@api.get("/merchants")
async def top_merchants(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "type": "debit", "date": {"$gte": start}}},
        {"$group": {"_id": "$merchant", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}, "category": {"$last": "$category"}}},
        {"$sort": {"amount": -1}},
        {"$limit": 20},
    ]).to_list(20)
    return [{"merchant": r["_id"], "amount": float(r["amount"]), "count": r["count"], "category": r.get("category", "Others")} for r in agg]


@api.get("/calendar")
async def calendar(month: Optional[int] = None, year: Optional[int] = None, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    m = month or now.month
    y = year or now.year
    start = datetime(y, m, 1, tzinfo=timezone.utc)
    end_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "type": "debit", "date": {"$gte": start, "$lt": end_month}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
            "total": {"$sum": "$amount"},
        }},
    ]).to_list(40)
    return {"month": m, "year": y, "days": [{"date": r["_id"], "amount": float(r["total"])} for r in agg]}


@api.get("/recurring")
async def recurring(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    cutoff = now_utc() - timedelta(days=90)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "type": "debit", "date": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$merchant",
            "count": {"$sum": 1},
            "avg_amount": {"$avg": "$amount"},
            "last": {"$max": "$date"},
            "category": {"$last": "$category"},
        }},
        {"$match": {"count": {"$gte": 2}}},
        {"$sort": {"count": -1}},
    ]).to_list(50)
    items = []
    for r in agg:
        items.append({
            "merchant": r["_id"],
            "count": r["count"],
            "avg_amount": float(r["avg_amount"]),
            "category": r.get("category", "Others"),
            "last_date": ensure_aware(r["last"]).isoformat() if r["last"] else None,
        })
    return items


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------
@api.post("/budgets")
async def create_budget(body: BudgetReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    m = body.period_month or now.month
    y = body.period_year or now.year
    doc = {
        "budget_id": gen_id("bud"),
        "user_id": user["user_id"],
        "category": body.category,
        "amount": body.amount,
        "period_month": m,
        "period_year": y,
        "created_at": now_utc(),
    }
    await db.budgets.update_one(
        {"user_id": user["user_id"], "category": body.category, "period_month": m, "period_year": y},
        {"$set": doc},
        upsert=True,
    )
    return doc


@api.get("/budgets")
async def list_budgets(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    items = await db.budgets.find(
        {"user_id": user["user_id"], "period_month": now.month, "period_year": now.year},
        {"_id": 0},
    ).to_list(100)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    out = []
    for b in items:
        agg = await db.transactions.aggregate([
            {"$match": {"user_id": user["user_id"], "category": b["category"], "type": "debit", "date": {"$gte": start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(1)
        used = float(agg[0]["total"]) if agg else 0
        out.append({
            **b,
            "used": used,
            "remaining": max(0, b["amount"] - used),
            "percent": min(100, round(used / b["amount"] * 100, 1)) if b["amount"] else 0,
        })
        # alert if >= 80%
        if b["amount"] and used / b["amount"] >= 0.8:
            await send_push(
                [user["user_id"]],
                {
                    "title": f"{b['category']} budget alert!",
                    "message": f"You have used {round(used/b['amount']*100)}% of your {b['category']} budget.",
                    "action_url": "/budgets",
                },
                idempotency_key=f"budget-alert-{b['budget_id']}-{now.day}",
            )
    return out


@api.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    await db.budgets.delete_one({"budget_id": budget_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Goals
# ---------------------------------------------------------------------------
@api.post("/goals")
async def create_goal(body: GoalReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    doc = {
        "goal_id": gen_id("goal"),
        "user_id": user["user_id"],
        "name": body.name,
        "target_amount": body.target_amount,
        "current_amount": body.current_amount,
        "target_date": body.target_date,
        "icon": body.icon,
        "created_at": now_utc(),
    }
    await db.goals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/goals")
async def list_goals(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    items = await db.goals.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    for g in items:
        progress = (g["current_amount"] / g["target_amount"] * 100) if g["target_amount"] else 0
        g["progress"] = round(min(100, progress), 1)
        if isinstance(g.get("created_at"), datetime):
            g["created_at"] = ensure_aware(g["created_at"]).isoformat()
    return items


@api.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, body: GoalUpdateReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    update: Dict[str, Any] = {}
    if body.current_amount is not None:
        update["current_amount"] = body.current_amount
    if body.target_amount is not None:
        update["target_amount"] = body.target_amount
    if body.target_date is not None:
        update["target_date"] = body.target_date
    if update:
        await db.goals.update_one({"goal_id": goal_id, "user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}


@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    await db.goals.delete_one({"goal_id": goal_id, "user_id": user["user_id"]})
    return {"ok": True}


# ---------------------------------------------------------------------------
# AI Insights (multilingual)
# ---------------------------------------------------------------------------
LANG_NAME = {
    "en": "English",
    "hi": "Hinglish (Hindi + English in Roman script)",
    "mr": "Marathi (in Roman script)",
    "gu": "Gujarati (in Roman script)",
    "ta": "Tamil (in Roman script)",
    "te": "Telugu (in Roman script)",
    "ml": "Malayalam (in Roman script)",
    "bn": "Bengali (in Roman script)",
    "pa": "Punjabi (in Roman script)",
    "ur": "Urdu (in Roman script)",
    "or": "Odia (in Roman script)",
}

FALLBACK_INSIGHTS = {
    "en": [
        "Your spending is on track this month 💰 keep going!",
        "Watch Swiggy / Zomato — small orders add up 🍔😅",
        "Fuel cost is balanced 🚗",
        "Shopping urge? Stick to your budget 🛍️",
        "Your savings are in rocket mode 🚀",
    ],
    "hi": [
        "Is month abhi tak kharcha thik hai 💰 keep going!",
        "Swiggy / Zomato pe nazar rakho 🍔😅",
        "Fuel kharcha balance me hai 🚗",
        "Shopping ka mood hai, budget yaad rakhna 🛍️",
        "Savings rocket mode me hai 🚀",
    ],
    "mr": [
        "Ya mahinyat kharch theek aahe 💰 chalu thev!",
        "Swiggy / Zomato var lakshya theva 🍔😅",
        "Indhan kharch sanyamit aahe 🚗",
        "Shopping cha mood aahe, budget visaru naka 🛍️",
        "Bachat rocket mode madhe aahe 🚀",
    ],
    "gu": [
        "Aa mahine kharch saru chhe 💰 chalu rakho!",
        "Swiggy / Zomato par dhyaan rakho 🍔😅",
        "Petrol kharch santulit chhe 🚗",
        "Shopping no mood? Budget yaad raakho 🛍️",
        "Bachat rocket mode maan chhe 🚀",
    ],
    "ta": [
        "Indha maatham selavu sariyaaga ulladhu 💰 thodaravum!",
        "Swiggy / Zomato vil kavanam vaikkavum 🍔😅",
        "Petrol selavu samaththu ulladhu 🚗",
        "Shopping mood? Budget ai nyaayam vaikka 🛍️",
        "Semippu rocket mode-il ulladhu 🚀",
    ],
    "te": [
        "Ee nelaa karchu baagunnadhi 💰 munduku saagandi!",
        "Swiggy / Zomato meedha kannu vesi undandi 🍔😅",
        "Petrol karchu balance lo undi 🚗",
        "Shopping mood? Budget gurthu pettukondi 🛍️",
        "Pondhulu rocket mode lo unnaayi 🚀",
    ],
    "ml": [
        "Ee maasam chelavu nallaayittund 💰 thudarukuka!",
        "Swiggy / Zomato yil shradhayikkuka 🍔😅",
        "Petrol chelavu santhulanam und 🚗",
        "Shopping mood? Budget orma vekkuka 🛍️",
        "Sambadhyam rocket mode-il und 🚀",
    ],
    "bn": [
        "Ei mash khoroch thik ache 💰 chaliye jao!",
        "Swiggy / Zomato e nojor rakho 🍔😅",
        "Tel-er khoroch balance ache 🚗",
        "Shopping er mood? Budget mone rakho 🛍️",
        "Sonchoy rocket mode-e 🚀",
    ],
    "pa": [
        "Es maheene kharch theek hai 💰 chalde raho!",
        "Swiggy / Zomato te nazar rakho 🍔😅",
        "Petrol kharch balance vich hai 🚗",
        "Shopping da mood? Budget yaad rakho 🛍️",
        "Bachat rocket mode vich hai 🚀",
    ],
    "ur": [
        "Is mahine kharch theek hai 💰 jaari rakhein!",
        "Swiggy / Zomato par nazar rakhein 🍔😅",
        "Petrol kharch balanced hai 🚗",
        "Shopping ka mood? Budget yaad rakhein 🛍️",
        "Bachat rocket mode mein hai 🚀",
    ],
    "or": [
        "E maasare kharcha thik aache 💰 jari rakhantu!",
        "Swiggy / Zomato re dhyana rakhantu 🍔😅",
        "Petrol kharcha balance re aache 🚗",
        "Shopping mood? Budget mane rakhantu 🛍️",
        "Sanchaya rocket mode re aache 🚀",
    ],
}

WEEKLY_TIPS = {
    "en": ["Try a no-spend day this week", "Cook one meal at home instead of ordering", "Move ₹500 to savings before spending"],
    "hi": ["Is hafte ek no-spend day try karo", "Order ki jagah ek meal ghar pe banao", "Kharch se pehle ₹500 savings me daalo"],
    "mr": ["Ya athavdyat ek no-spend divas thavava", "Order chya badli ek jevan ghari banva", "Kharch karnyaapurvi ₹500 bachatit taka"],
    "gu": ["Aa athvaadiye ek no-spend divas try karo", "Order ne badle ek meal ghare banavo", "Kharch karyaa pehla ₹500 bachat maan daalo"],
    "ta": ["Indha vaaram oru no-spend naal try seyyavum", "Order seyyaadhu oru unav veetil samaikkavum", "Selavu seyyum mun ₹500 semippil sera"],
    "te": ["Ee vaaram oka no-spend roju try cheyyandi", "Order ki badulu oka bhojanam intlo ne tayaru cheyyandi", "Karchu mundu ₹500 pondhulu lo pettandi"],
    "ml": ["Ee aazhcha oru no-spend divasam pareekshikkuka", "Order ennathinu binnam oru bhakshanam veetil undaakkuka", "Chelavinu munpu ₹500 sambadhyam-il vekkuka"],
    "bn": ["Ei saptaho ek no-spend din try koro", "Order er bodole ek bela bari te ranna koro", "Khoroch er aage ₹500 sonchoy e rakho"],
    "pa": ["Es hafte ik no-spend din try karo", "Order di jagah ik vaari ghar te khaana banao", "Kharch ton pehlan ₹500 bachat vich paao"],
    "ur": ["Is hafte ek no-spend din try karein", "Order ke badle ek meal ghar par banayein", "Kharch se pehle ₹500 bachat mein daalein"],
    "or": ["E saptahare ekati no-spend dina chesta karantu", "Order badle ekati khaadya gharare tayar karantu", "Kharcha purvaru ₹500 sanchayare rakhantu"],
}


async def _generate_insights(user_id: str, lang: str = "en") -> List[str]:
    lines, _ = await _generate_insights_with_status(user_id, lang)
    return lines


@api.get("/insights")
async def insights(lang: str = "en", authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    cached = await db.insights_cache.find_one({"user_id": user["user_id"], "lang": lang}, {"_id": 0})
    if cached and ensure_aware(cached["created_at"]) > now_utc() - timedelta(hours=6):
        return {"insights": cached["insights"], "ai_status": cached.get("ai_status", "ok")}
    lines, ai_status = await _generate_insights_with_status(user["user_id"], lang)
    await db.insights_cache.update_one(
        {"user_id": user["user_id"], "lang": lang},
        {"$set": {"user_id": user["user_id"], "lang": lang, "insights": lines, "ai_status": ai_status, "created_at": now_utc()}},
        upsert=True,
    )
    return {"insights": lines, "ai_status": ai_status}


@api.post("/insights/refresh")
async def refresh_insights(lang: str = "en", authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    lines, ai_status = await _generate_insights_with_status(user["user_id"], lang)
    await db.insights_cache.update_one(
        {"user_id": user["user_id"], "lang": lang},
        {"$set": {"user_id": user["user_id"], "lang": lang, "insights": lines, "ai_status": ai_status, "created_at": now_utc()}},
        upsert=True,
    )
    return {"insights": lines, "ai_status": ai_status}


async def _generate_insights_with_status(user_id: str, lang: str) -> tuple:
    """Wrapper around _generate_insights that also returns 'ok' | 'fallback' status."""
    now = now_utc()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    cat_agg = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": "debit", "date": {"$gte": start}}},
        {"$group": {"_id": "$category", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
    ]).to_list(20)
    income_agg = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": "credit", "date": {"$gte": start}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    expenses = sum(c["total"] for c in cat_agg)
    income = income_agg[0]["total"] if income_agg else 0
    top_cats = ", ".join(f"{c['_id']}: ₹{int(c['total'])}" for c in cat_agg[:5])
    if not cat_agg:
        return [FALLBACK_INSIGHTS.get(lang, FALLBACK_INSIGHTS["en"])[0]], "fallback"
    lang_descr = LANG_NAME.get(lang, "English")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insights-{user_id}-{lang}-{now.strftime('%Y%m%d')}",
            system_message=(
                f"You are Fynora, a witty Indian financial buddy. Speak ONLY in {lang_descr}. "
                "Tone: friendly, mildly funny, supportive — NEVER robotic. Use 1-2 emojis per line. Use Indian Rupees with ₹ symbol. "
                "Each insight is 1 short sentence (max 18 words). Return EXACTLY 5 insights, one per line, no numbering, no bullets. "
                "Do NOT mix English words unless the target language naturally uses them."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = (
            f"This month: income ₹{int(income)}, expenses ₹{int(expenses)}. "
            f"Top categories: {top_cats}. "
            f"Give 5 witty, friendly insights in {lang_descr}."
        )
        resp = await chat.send_message(UserMessage(text=prompt))
        lines = [ln.strip("-•*0123456789. ").strip() for ln in (resp or "").splitlines() if ln.strip()]
        lines = [ln for ln in lines if len(ln) > 10][:5]
        if not lines:
            return FALLBACK_INSIGHTS.get(lang, FALLBACK_INSIGHTS["en"]), "fallback"
        return lines, "ok"
    except Exception as e:
        logger.warning(f"Claude insights failed: {e}")
        return FALLBACK_INSIGHTS.get(lang, FALLBACK_INSIGHTS["en"]), "fallback"


# ---------------------------------------------------------------------------
# Weekly report
# ---------------------------------------------------------------------------
@api.get("/report/weekly")
async def weekly_report(lang: str = "en", authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    now = now_utc()
    start = now - timedelta(days=7)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user["user_id"], "date": {"$gte": start}}},
        {"$group": {"_id": {"type": "$type", "cat": "$category"}, "total": {"$sum": "$amount"}}},
    ]).to_list(50)
    income = 0.0
    expenses = 0.0
    cats: Dict[str, float] = {}
    for r in agg:
        if r["_id"]["type"] == "credit":
            income += r["total"]
        else:
            expenses += r["total"]
            cats[r["_id"]["cat"] or "Others"] = cats.get(r["_id"]["cat"] or "Others", 0) + r["total"]
    sorted_cats = sorted(cats.items(), key=lambda x: x[1], reverse=True)
    highest = sorted_cats[0] if sorted_cats else None
    lowest = sorted_cats[-1] if sorted_cats else None
    tips = WEEKLY_TIPS.get(lang, WEEKLY_TIPS["en"])
    return {
        "period": {"start": start.isoformat(), "end": now.isoformat()},
        "income": income,
        "expenses": expenses,
        "savings": income - expenses,
        "highest_category": {"category": highest[0], "amount": highest[1]} if highest else None,
        "lowest_category": {"category": lowest[0], "amount": lowest[1]} if lowest else None,
        "tips": tips,
    }


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------
ALL_BADGES = [
    {"badge_id": "budget_master", "title": "Budget Master", "description": "Stay under budget for a full month", "icon": "emoji-events"},
    {"badge_id": "savings_hero", "title": "Savings Hero", "description": "Save 30% of monthly income", "icon": "savings"},
    {"badge_id": "no_spend_7", "title": "7 Day No Spend", "description": "No spend streak of 7 days", "icon": "local-fire-department"},
    {"badge_id": "no_spend_30", "title": "30 Day Saver", "description": "No spend streak of 30 days", "icon": "stars"},
    {"badge_id": "expense_controller", "title": "Expense Controller", "description": "Log 50 transactions", "icon": "bar-chart"},
    {"badge_id": "goal_achiever", "title": "Goal Achiever", "description": "Complete a savings goal", "icon": "emoji-events"},
]


async def _evaluate_achievements(user_id: str) -> List[dict]:
    unlocked_docs = await db.achievements.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    unlocked_ids = {a["badge_id"] for a in unlocked_docs}

    # streak
    streak = await get_streak_for_user(user_id)
    cur = streak["current_streak"]

    # txn count
    txn_count = await db.transactions.count_documents({"user_id": user_id})

    # goals completed
    goals = await db.goals.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    goal_completed = any((g["current_amount"] or 0) >= (g["target_amount"] or 1) for g in goals)

    # savings ratio
    now = now_utc()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    agg = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "date": {"$gte": start}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]).to_list(5)
    totals = {r["_id"]: r["total"] for r in agg}
    income = totals.get("credit", 0)
    expenses = totals.get("debit", 0)
    savings_pct = ((income - expenses) / income * 100) if income > 0 else 0

    # budgets under
    budgets = await db.budgets.find({"user_id": user_id, "period_month": now.month, "period_year": now.year}, {"_id": 0}).to_list(50)
    budget_master = False
    if budgets:
        budget_master = True
        for b in budgets:
            used_agg = await db.transactions.aggregate([
                {"$match": {"user_id": user_id, "category": b["category"], "type": "debit", "date": {"$gte": start}}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
            ]).to_list(1)
            used = used_agg[0]["total"] if used_agg else 0
            if used > b["amount"]:
                budget_master = False
                break

    conditions = {
        "no_spend_7": cur >= 7,
        "no_spend_30": cur >= 30,
        "expense_controller": txn_count >= 50,
        "goal_achiever": goal_completed,
        "savings_hero": savings_pct >= 30,
        "budget_master": budget_master,
    }
    out = []
    for badge in ALL_BADGES:
        unlocked = badge["badge_id"] in unlocked_ids or conditions.get(badge["badge_id"], False)
        if unlocked and badge["badge_id"] not in unlocked_ids:
            await db.achievements.insert_one({
                "user_id": user_id,
                "badge_id": badge["badge_id"],
                "unlocked_at": now_utc(),
            })
        out.append({**badge, "unlocked": unlocked})
    return out


async def get_streak_for_user(user_id: str) -> dict:
    last = await db.transactions.find_one({"user_id": user_id, "type": "debit"}, sort=[("date", -1)])
    today = now_utc().date()
    if last:
        last_date = ensure_aware(last["date"]).date()
        current = (today - last_date).days
    else:
        current = 0
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    best = max(user.get("best_streak", 0), current)
    return {"current_streak": current, "best_streak": best}


@api.get("/achievements")
async def list_achievements(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    return await _evaluate_achievements(user["user_id"])


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@api.patch("/settings")
async def update_settings(body: SettingsReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    upd: Dict[str, Any] = {}
    if body.theme is not None:
        upd["theme"] = body.theme
    if body.language is not None:
        upd["language"] = body.language
    if body.notifications_enabled is not None:
        upd["notifications_enabled"] = body.notifications_enabled
    if upd:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    if isinstance(fresh.get("created_at"), datetime):
        fresh["created_at"] = ensure_aware(fresh["created_at"]).isoformat()
    if isinstance(fresh.get("last_spend_date"), datetime):
        fresh["last_spend_date"] = ensure_aware(fresh["last_spend_date"]).isoformat()
    return fresh


# ---------------------------------------------------------------------------
# Backup / Restore (JSON)
# ---------------------------------------------------------------------------
@api.get("/backup")
async def backup(authorization: Optional[str] = Header(None)):
    """Export all user data (transactions, budgets, goals, achievements, settings) as JSON."""
    user = await get_user_from_token(authorization)
    uid = user["user_id"]
    txns = await db.transactions.find({"user_id": uid}, {"_id": 0}).to_list(10000)
    buds = await db.budgets.find({"user_id": uid}, {"_id": 0}).to_list(500)
    goals = await db.goals.find({"user_id": uid}, {"_id": 0}).to_list(500)
    achs = await db.achievements.find({"user_id": uid}, {"_id": 0}).to_list(50)
    for t in txns:
        if isinstance(t.get("date"), datetime):
            t["date"] = ensure_aware(t["date"]).isoformat()
        if isinstance(t.get("created_at"), datetime):
            t["created_at"] = ensure_aware(t["created_at"]).isoformat()
    for b in buds:
        if isinstance(b.get("created_at"), datetime):
            b["created_at"] = ensure_aware(b["created_at"]).isoformat()
    for g in goals:
        if isinstance(g.get("created_at"), datetime):
            g["created_at"] = ensure_aware(g["created_at"]).isoformat()
    for a in achs:
        if isinstance(a.get("unlocked_at"), datetime):
            a["unlocked_at"] = ensure_aware(a["unlocked_at"]).isoformat()
    return {
        "schema": 1,
        "exported_at": now_utc().isoformat(),
        "user_email": user.get("email"),
        "counts": {
            "transactions": len(txns),
            "budgets": len(buds),
            "goals": len(goals),
            "achievements": len(achs),
        },
        "transactions": txns,
        "budgets": buds,
        "goals": goals,
        "achievements": achs,
        "settings": {
            "theme": user.get("theme"),
            "language": user.get("language"),
            "notifications_enabled": user.get("notifications_enabled"),
        },
    }


class RestoreReq(BaseModel):
    transactions: Optional[List[Dict[str, Any]]] = None
    budgets: Optional[List[Dict[str, Any]]] = None
    goals: Optional[List[Dict[str, Any]]] = None
    replace: bool = False  # if true, wipe existing data first


@api.post("/restore")
async def restore(body: RestoreReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    uid = user["user_id"]
    if body.replace:
        await db.transactions.delete_many({"user_id": uid})
        await db.budgets.delete_many({"user_id": uid})
        await db.goals.delete_many({"user_id": uid})
    added = {"transactions": 0, "budgets": 0, "goals": 0}
    if body.transactions:
        for raw in body.transactions:
            doc = {**raw, "user_id": uid}
            doc.pop("_id", None)
            if "txn_id" not in doc:
                doc["txn_id"] = gen_id("txn")
            if isinstance(doc.get("date"), str):
                try:
                    doc["date"] = ensure_aware(datetime.fromisoformat(doc["date"].replace("Z", "+00:00")))
                except Exception:
                    doc["date"] = now_utc()
            if isinstance(doc.get("created_at"), str):
                try:
                    doc["created_at"] = ensure_aware(datetime.fromisoformat(doc["created_at"].replace("Z", "+00:00")))
                except Exception:
                    doc["created_at"] = now_utc()
            try:
                await db.transactions.update_one({"txn_id": doc["txn_id"], "user_id": uid}, {"$setOnInsert": doc}, upsert=True)
                added["transactions"] += 1
            except Exception:
                pass
    if body.budgets:
        for raw in body.budgets:
            doc = {**raw, "user_id": uid}
            doc.pop("_id", None)
            if "budget_id" not in doc:
                doc["budget_id"] = gen_id("bud")
            try:
                await db.budgets.update_one(
                    {"user_id": uid, "category": doc.get("category"), "period_month": doc.get("period_month"), "period_year": doc.get("period_year")},
                    {"$set": doc},
                    upsert=True,
                )
                added["budgets"] += 1
            except Exception:
                pass
    if body.goals:
        for raw in body.goals:
            doc = {**raw, "user_id": uid}
            doc.pop("_id", None)
            if "goal_id" not in doc:
                doc["goal_id"] = gen_id("goal")
            try:
                await db.goals.update_one({"goal_id": doc["goal_id"], "user_id": uid}, {"$setOnInsert": doc}, upsert=True)
                added["goals"] += 1
            except Exception:
                pass
    return {"ok": True, "added": added, "replaced": body.replace}


# ---------------------------------------------------------------------------
# Premium / Razorpay subscription (P3)
# ---------------------------------------------------------------------------
class OrderReq(BaseModel):
    plan_id: str  # "monthly" | "annual"


class VerifyReq(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.get("/premium/status")
async def premium_status(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    sub = await db.subscriptions.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    if not sub:
        return {"is_premium": False, "plan": None, "expires_at": None}
    expires = ensure_aware(sub["expires_at"]) if sub.get("expires_at") else None
    if expires and expires < now_utc():
        await db.subscriptions.update_one({"_id": sub.get("_id")}, {"$set": {"active": False}})
        return {"is_premium": False, "plan": None, "expires_at": None}
    return {
        "is_premium": True,
        "plan": sub.get("plan_id"),
        "expires_at": expires.isoformat() if expires else None,
    }


@api.get("/premium/plans")
async def premium_plans():
    return {"plans": list(PREMIUM_PLANS.values())}


@api.post("/premium/order")
async def premium_create_order(body: OrderReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    plan = PREMIUM_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    if RAZORPAY_KEY_ID == "placeholder" or RAZORPAY_KEY_SECRET == "placeholder":
        # Dev mode: return a stub order so frontend wiring can be tested without keys
        order_id = f"order_dev_{uuid.uuid4().hex[:14]}"
        await db.payment_orders.insert_one({
            "order_id": order_id,
            "user_id": user["user_id"],
            "plan_id": plan["id"],
            "amount": plan["amount"],
            "currency": plan["currency"],
            "status": "created",
            "mode": "dev_stub",
            "created_at": now_utc(),
        })
        return {"order_id": order_id, "amount": plan["amount"], "currency": plan["currency"], "key_id": RAZORPAY_KEY_ID, "mode": "dev_stub", "plan": plan}
    try:
        import razorpay  # lazy import; only required when real keys present
        rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        order = rzp.order.create({
            "amount": plan["amount"],
            "currency": plan["currency"],
            "payment_capture": 1,
            "notes": {"user_id": user["user_id"], "plan_id": plan["id"]},
        })
        await db.payment_orders.insert_one({
            "order_id": order["id"],
            "user_id": user["user_id"],
            "plan_id": plan["id"],
            "amount": plan["amount"],
            "currency": plan["currency"],
            "status": "created",
            "mode": "razorpay",
            "created_at": now_utc(),
        })
        return {"order_id": order["id"], "amount": plan["amount"], "currency": plan["currency"], "key_id": RAZORPAY_KEY_ID, "mode": "razorpay", "plan": plan}
    except ImportError:
        raise HTTPException(503, "Razorpay SDK not installed; run `pip install razorpay`.")
    except Exception as e:
        logger.warning(f"Razorpay order failed: {e}")
        raise HTTPException(502, "Payment provider unavailable")


@api.post("/premium/verify")
async def premium_verify(body: VerifyReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    order = await db.payment_orders.find_one({"order_id": body.razorpay_order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    plan = PREMIUM_PLANS.get(order["plan_id"])
    if not plan:
        raise HTTPException(400, "Plan invalid")
    if order.get("mode") == "razorpay" and RAZORPAY_KEY_SECRET != "placeholder":
        try:
            import razorpay
            rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            rzp.utility.verify_payment_signature({
                "razorpay_order_id": body.razorpay_order_id,
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception as e:
            logger.warning(f"Signature verify failed: {e}")
            raise HTTPException(400, "Signature verification failed")
    period_days = 30 if plan["period"] == "month" else 365
    expires_at = now_utc() + timedelta(days=period_days)
    await db.subscriptions.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "user_id": user["user_id"],
            "plan_id": plan["id"],
            "order_id": body.razorpay_order_id,
            "payment_id": body.razorpay_payment_id,
            "active": True,
            "expires_at": expires_at,
            "updated_at": now_utc(),
        }},
        upsert=True,
    )
    await db.payment_orders.update_one({"order_id": body.razorpay_order_id}, {"$set": {"status": "paid"}})
    return {"ok": True, "plan": plan["id"], "expires_at": expires_at.isoformat()}


@api.post("/premium/webhook")
async def premium_webhook(payload: Dict[str, Any], x_razorpay_signature: Optional[str] = Header(None)):
    """Razorpay webhook endpoint. Signature verification when key present."""
    if RAZORPAY_WEBHOOK_SECRET != "placeholder" and x_razorpay_signature:
        try:
            import razorpay
            rzp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            import json as _json
            rzp.utility.verify_webhook_signature(_json.dumps(payload), x_razorpay_signature, RAZORPAY_WEBHOOK_SECRET)
        except Exception as e:
            logger.warning(f"Webhook signature failed: {e}")
            raise HTTPException(400, "Invalid signature")
    event = payload.get("event")
    logger.info(f"Razorpay webhook event: {event}")
    return {"received": True}


# ---------------------------------------------------------------------------
# Multi-currency (P3)
# ---------------------------------------------------------------------------
@api.get("/currencies")
async def list_currencies():
    return [{"code": c, **info} for c, info in SUPPORTED_CURRENCIES.items()]


class CurrencyReq(BaseModel):
    code: str


@api.post("/user/currency")
async def set_currency(body: CurrencyReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    if body.code not in SUPPORTED_CURRENCIES:
        raise HTTPException(400, "Unsupported currency")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"currency": body.code}})
    return {"ok": True, "currency": body.code}


# ---------------------------------------------------------------------------
# OCR Receipt scanning (P3) — Claude Vision via emergentintegrations
# ---------------------------------------------------------------------------
class OcrReceiptReq(BaseModel):
    image_base64: str  # data URI or raw base64


@api.post("/ocr/receipt")
async def ocr_receipt(body: OcrReceiptReq, authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    # Premium gating
    sub = await db.subscriptions.find_one({"user_id": user["user_id"], "active": True}, {"_id": 0})
    is_premium = bool(sub and (not sub.get("expires_at") or ensure_aware(sub["expires_at"]) > now_utc()))
    if not is_premium:
        # Allow 3 free OCR calls per user as a teaser
        ocr_count = await db.ocr_usage.count_documents({"user_id": user["user_id"]})
        if ocr_count >= 3:
            raise HTTPException(402, "Premium required: free OCR limit reached (3/3). Upgrade to Pro for unlimited scans.")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContent
        b64 = body.image_base64
        if b64.startswith("data:"):
            b64 = b64.split(",", 1)[1]
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ocr-{user['user_id']}-{uuid.uuid4().hex[:6]}",
            system_message=(
                "You are an expert receipt OCR. Extract these fields from the image and return STRICT JSON only "
                "(no prose, no markdown, no backticks): "
                '{"merchant": "string", "amount": number, "currency": "INR|USD|EUR|GBP|AED|SGD", '
                '"date": "YYYY-MM-DD or null", "category_hint": "Food|Fuel|Shopping|Travel|Bills|Healthcare|'
                'Education|Entertainment|Rent|EMI|Investment|Others"}.'
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(
            text="Extract receipt fields as JSON.",
            file_contents=[FileContent(content_type="image", file_content_base64=b64)],
        )
        resp = await chat.send_message(msg)
        import json as _json
        raw = (resp or "").strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()
        parsed = _json.loads(raw)
        # Persist usage
        await db.ocr_usage.insert_one({"user_id": user["user_id"], "at": now_utc(), "merchant": parsed.get("merchant")})
        return {"ok": True, "parsed": parsed, "is_premium": is_premium}
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"OCR failed: {e}")
        raise HTTPException(502, "OCR provider unavailable. Try again later.")


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
@api.get("/export/csv")
async def export_csv(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    items = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).sort("date", -1).to_list(5000)
    rows = ["Date,Merchant,Category,Type,Amount,Payment,Source,Description"]
    for t in items:
        d = ensure_aware(t["date"]).strftime("%Y-%m-%d") if isinstance(t["date"], datetime) else str(t["date"])
        desc = (t.get("description") or "").replace(",", " ").replace("\n", " ")[:80]
        rows.append(f"{d},{t['merchant']},{t.get('category','Others')},{t['type']},{t['amount']},{t.get('payment_method','')},{t.get('source','')},{desc}")
    csv_text = "\n".join(rows)
    return {"filename": f"fynora-transactions-{now_utc().strftime('%Y%m%d')}.csv", "content": csv_text}


# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "Fynora", "version": "1.0.0"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
