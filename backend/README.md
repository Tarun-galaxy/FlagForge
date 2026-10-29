# FlagForge — Backend Service

The high-performance core server for FlagForge, providing real-time feature flag evaluation, 5-tier targeting rules, Redis sub-millisecond caching, evaluation analytics tracking, audit logging, and stale flag cleanup governance.

---

## 🛠 Tech Stack

- **Framework**: FastAPI (Python 3.10+)
- **ORM & Database**: SQLAlchemy 2.0+, PostgreSQL (Production) / SQLite (Testing & Dev)
- **Database Migrations**: Alembic
- **Caching & Analytics**: Redis (py-redis)
- **Security**: PyJWT (HS256 signature verification), Passlib/PBKDF2 password hashing
- **Testing**: Pytest (42 automated test cases)

---

## 🚀 Quick Start & Setup

### 1. Environment Setup

Copy `.env.example` to `.env` in the `backend/` directory:

```bash
cp .env.example .env
```

Configure your `.env` parameters:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/feature_flags
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=super_secret_jwt_key_flagforge_2026
FRONTEND_ORIGIN=http://localhost:5173
```

### 2. Virtual Environment & Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate on Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# Activate on Linux / macOS
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

## 🗄 Database Migrations (Alembic)

FlagForge uses Alembic to manage database schema updates.

### Apply Migrations to Target Database
```bash
alembic upgrade head
```

### Generate a New Migration Script
```bash
alembic revision --autogenerate -m "Add new feature flag column"
```

### Roll Back to Previous Migration
```bash
alembic downgrade -1
```

---

## 🔌 FlagKit Python SDK & Middleware Usage

FlagForge includes a custom Python client library (`flagkit`) for integrating feature flags into microservices and FastAPI applications.

### 1. Standalone Python SDK (`FlagClient`)

```python
from flagkit import FlagClient

# Initialize client with background polling (every 30s) and fallback values
client = FlagClient(
    api_url="http://localhost:8000",
    environment="production",
    poll_interval=30,
    defaults={"new_checkout_flow": False}
)

# Evaluate boolean flag
is_checkout_v2 = client.is_enabled("new_checkout_flow", user_id="user_101", groups=["beta_testers"])

if is_checkout_v2:
    # Execute new checkout logic
    pass
else:
    # Execute legacy checkout logic
    pass

# Graceful shutdown when application stops
client.close()
```

### 2. FastAPI Middleware (`FlagKitMiddleware`)

```python
from fastapi import FastAPI, Depends
from flagkit import FlagKitMiddleware, get_flag_client

app = FastAPI()

# Register middleware with FlagForge server
app.add_middleware(
    FlagKitMiddleware,
    api_url="http://localhost:8000",
    environment="production",
    poll_interval=30,
    defaults={"AI_CHAT": False}
)

@app.get("/chat")
def get_chat_page(client = Depends(get_flag_client)):
    if client.is_enabled("AI_CHAT"):
        return {"feature": "AI Chat Enabled"}
    return {"feature": "Standard Chat"}
```

---

## 🧪 Running Automated Tests

Run the complete Pytest test suite (42 test cases):

```bash
pytest tests/ -v
```

### Test Suite Breakdown:
- **`test_evaluator.py`**: 5-tier evaluation hierarchy & default fallbacks.
- **`test_targeting_rules.py`**: Percentage rollout determinism, whitelist parsing, statistical distributions.
- **`test_cache_invalidation.py`**: Redis cache key determinism & isolated invalidation.
- **`test_audit_log_accuracy.py`**: Multi-field audit log filtering and chronological ordering.
- **`test_load_evaluation.py`**: Sequential and multi-threaded concurrent evaluation performance benchmarks.
- **`test_cleanup.py`**: Stale flag detection and governance review actions.
- **`test_auth.py`**: Password hashing, JWT token validation, and expiration.

---

## 📊 Core API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/evaluate` | High-speed flag evaluation endpoint for client SDKs |
| `GET` | `/flags` | List all flags for an environment |
| `POST` | `/flags` | Create a new feature flag |
| `PUT` | `/flags/{key}` | Update flag configurations & targeting rules |
| `DELETE` | `/flags/{key}` | Delete a flag across environments |
| `GET` | `/audit-logs` | Query audit log compliance history |
| `GET` | `/cleanup/candidates` | Fetch stale flag cleanup recommendations |
| `POST` | `/cleanup/candidates/{key}/review` | Mark stale candidate reviewed |
| `GET` | `/health` | Server and Redis health check |

Interactive OpenAPI documentation is automatically served at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📡 Complete API Endpoint Reference

### Flags Router (`/flags`)

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/flags` | Create a new feature flag across all environments | JWT/Header |
| `GET` | `/flags?environment=development` | List all flags for an environment | — |
| `GET` | `/flags/{key}?environment=development` | Get a single flag by key | — |
| `PUT` | `/flags/{key}?environment=development` | Update flag settings (name, description, enable/disable, default value) | JWT/Header |
| `DELETE` | `/flags/{key}` | Permanently delete a flag from all environments | JWT/Header |

### Targeting Rules (`/flags/{key}/targeting`)

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/flags/{key}/targeting?environment=development` | Retrieve whitelist, group, and percentage rules | — |
| `POST` | `/flags/{key}/targeting?environment=development` | Save/update all three targeting rules atomically | JWT/Header |

### Environment Overrides (`/flags/{key}/overrides`)

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `GET` | `/flags/{key}/overrides` | List override status across all environments | — |
| `PUT` | `/flags/{key}/overrides/{env_id}` | Create, update, or remove an environment override | JWT/Header |

### Flag Evaluation (`/evaluate`, `/flags/evaluate`)

| Method | Endpoint | Description | Auth |
|:-------|:---------|:------------|:-----|
| `POST` | `/evaluate` | Top-level evaluation endpoint (root path) | — |
| `POST` | `/flags/evaluate` | Evaluate flag via 5-tier priority engine | — |

**Request body:**
```json
{
  "flag_key": "new_checkout_flow",
  "environment": "production",
  "user_id": "user_42",
  "groups": ["beta_users", "internal_team"],
  "context": {"region": "us-west"}
}
```

### Analytics (`/flags/{key}/metrics`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/flags/analytics/flush` | Flush Redis hourly counters to PostgreSQL |
| `GET` | `/flags/{key}/metrics?timeframe=30D` | Get evaluation metrics (7D / 30D / 90D) |
| `POST` | `/flags/{key}/seed-analytics?days=30` | Generate sample analytics data |
| `POST` | `/flags/{key}/clear-analytics` | Clear analytics data for a flag |
| `DELETE` | `/flags/{key}/analytics` | Alias for clear-analytics |

### Environments (`/environments`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/environments` | List all environments |
| `POST` | `/environments` | Create environment (auto-syncs existing flags) |
| `GET` | `/environments/{id}` | Get environment by ID |
| `PUT` | `/environments/{id}` | Update environment name/description |
| `DELETE` | `/environments/{id}` | Delete environment (cascades flags, rules, overrides) |

### User Groups (`/groups`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/groups` | List all groups (auto-seeds defaults if empty) |
| `POST` | `/groups` | Create a new group |
| `DELETE` | `/groups/{name}` | Delete a group |
| `POST` | `/groups/batch-delete` | Bulk delete multiple groups |
| `GET` | `/groups/{name}/members` | List group members |
| `POST` | `/groups/{name}/members` | Add member to group |
| `DELETE` | `/groups/{name}/members/{user_id}` | Remove member from group |

### Audit Logs (`/audit-logs`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/audit-logs` | Query logs with filters: `flag_key`, `environment`, `actor`, `action`, `start_date`, `end_date` |

### Stale Flag Cleanup (`/cleanup`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/cleanup/candidates?threshold_days=30` | Get stale flag candidates |
| `POST` | `/cleanup/evaluate?threshold_days=30` | Trigger on-demand cleanup scan |
| `POST` | `/cleanup/candidates/{flag_key}/review` | Mark candidate as reviewed/unreviewed |

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/auth/register` | Register with email + password |
| `POST` | `/api/auth/login` | Login with email + password |
| `POST` | `/api/auth/google/callback` | Google OAuth 2.0 code exchange |
| `POST` | `/api/auth/github/callback` | GitHub OAuth code exchange |
| `GET` | `/api/auth/me` | Get authenticated user profile |
| `GET` | `/api/auth/users` | List all registered users |

### System (`/health`)

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/health` | Server health + Redis/DB connectivity check |
| `GET` | `/` | Redirects to `/docs` (Swagger UI) |

---

## 🗂 SQLAlchemy Models Reference

### `Flag` — Feature Flag Definition
```
flags (flag_key, name, description, type, default_value, owner_team, is_enabled, environment_id)
```
- One row per flag **per environment** (flags are duplicated across environments for independent control).
- `type` supports: `boolean`, `string`, `number`.
- Indexed on `flag_key` and `environment_id` for fast lookups.

### `TargetingRule` — Evaluation Rule
```
targeting_rules (flag_id, rule_type, rule_value)
```
- `rule_type` is one of: `whitelist`, `group`, `percentage`.
- `rule_value` is a string: comma-separated user IDs for whitelist, comma-separated group names for group, integer 0-100 for percentage.
- Each flag can have one rule per type.

### `FlagOverride` — Environment Override
```
flag_overrides (flag_key, environment_id, value)
```
- Stores environment-specific override values checked at Tier 4 of evaluation.
- Supports typed values: `"true"/"false"` for boolean, numeric strings for number, arbitrary strings for string.

### `FlagVersion` — Configuration Snapshot
```
flag_versions (flag_key, snapshot, created_at)
```
- Stores JSON snapshots of flag configuration at a point in time.
- Used for the version history and rollback feature in the frontend.

### `AuditLog` — Compliance Trail
```
audit_log (actor, action, flag_key, environment, details, previous_state, new_state, created_at)
```
- **Immutable**: Records are insert-only, never updated or deleted.
- `previous_state` and `new_state` are JSON fields capturing the before/after state.
- `action` values include: `CREATE`, `UPDATE`, `ENABLE`, `DISABLE`, `DELETE`, `TARGETING`, `MARK_REVIEWED`.

### `User` — Platform User Account
```
users (email, hashed_password, full_name, avatar_url, provider, provider_id, created_at)
```
- `provider` is one of: `email`, `google`, `github`.
- `hashed_password` uses PBKDF2-SHA256 with 100K iterations and a random 16-byte hex salt.

### `UserGroupMembership` — Group Membership
```
user_group_membership (user_id, group_name)
```
- Many-to-many mapping between users and groups.
- Groups are auto-seeded with 8 defaults on first query if table is empty.

### `EvaluationAnalytics` — Hourly Evaluation Metrics
```
evaluation_analytics (flag_key, hour_bucket, count)
```
- Aggregated from Redis hourly counters via flush pipeline.
- `hour_bucket` is a timezone-aware datetime truncated to the hour.

### `CleanupCandidate` — Stale Flag Governance
```
cleanup_candidates (flag_key, status_type, reason, reviewed, detected_at, reviewed_at, reviewed_by)
```
- `status_type`: `ROLLED_OUT` or `DISABLED`.
- `reviewed` boolean tracks governance review state.

---

## ⚙️ Core Engine Architecture

### Evaluation Engine (`app/core/evaluator.py`)

The evaluator implements a **strict 5-tier priority cascade**:

1. **Redis cache check** — Returns cached result if available (sub-millisecond).
2. **Disabled flag short-circuit** — If `is_enabled=False`, immediately returns default value.
3. **Tier 1 → Tier 5 cascade** — First matching tier wins; no further tiers are evaluated.

**Key design decisions:**
- User groups are merged from both the request payload AND the `user_group_membership` database table.
- Percentage rollout uses `MD5("{user_id}:{flag_key}") % 100` for deterministic bucketing.
- Every evaluation increments a Redis hourly counter (`INCR flag:{key}:{YYYY-MM-DD-HH}`).
- Results are cached with a 300-second TTL in Redis.

### Redis Client (`app/core/redis_client.py`)

**Cache key format:**
```
eval:{flag_key}:env:{environment}:user:{user_id}:ctx:{md5_of_groups+context}
```

**Graceful degradation:** If Redis is unreachable:
- `get_cached_evaluation()` returns `None` (cache miss, falls through to DB).
- `record_evaluation_count()` falls back to an in-memory dictionary.
- `invalidate_flag_cache()` returns 0 (no-op).

### Analytics Service (`app/services/analytics_service.py`)

**Flush pipeline:**
1. Scans all Redis keys matching `flag:*:*`.
2. Parses key format `flag:{flag_key}:{YYYY-MM-DD-HH}` to extract flag key and hour bucket.
3. Upserts count into `evaluation_analytics` table (adds to existing record if found).
4. Deletes the flushed key from Redis.

**Metrics calculation:**
- Queries both flushed DB records and live un-flushed Redis counters.
- Computes period-over-period percentage change.
- Returns chart-ready daily aggregations.

### Cleanup Service (`app/services/cleanup_service.py`)

**Detection algorithm:**
1. Scans all flags across all environments.
2. Flags with `is_enabled=True` and 100% rollout rule for ≥ threshold days → `ROLLED_OUT`.
3. Flags with `is_enabled=False` across all environments for ≥ threshold days → `DISABLED`.
4. Upserts results into `cleanup_candidates` table (preserving existing review state).

---

## 🔒 Security Implementation

### Password Hashing
- **Algorithm**: PBKDF2 with HMAC-SHA256.
- **Iterations**: 100,000.
- **Salt**: Random 16-byte hex, stored as `{salt}${key_hex}` in the database.
- **Verification**: Constant-time comparison via `hmac.compare_digest()`.

### JWT Tokens
- **Algorithm**: HS256 (HMAC-SHA256).
- **Expiry**: 7 days from issuance.
- **Payload**: Contains `sub` (user ID), `email`, and `exp` (expiry timestamp).
- **Implementation**: Custom JWT encode/decode using `base64url` and `hmac` (no external JWT library).

### CORS Policy
- Origins: Explicitly whitelisted frontend origins plus regex pattern `http://(localhost|127.0.0.1)(:\d+)?`.
- All HTTP methods and headers are allowed.
- Credentials are enabled for cookie/auth header propagation.

### Actor Tracking
Every mutation endpoint extracts the acting user from:
1. `Authorization: Bearer <JWT>` header (decoded to get email).
2. `X-Actor-Email` custom header (fallback).
3. Default: `t371899@gmail.com`.

---

## 🔧 Configuration (`app/core/config.py`)

Settings are loaded from environment variables via Pydantic `BaseSettings`:

```python
class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    JWT_SECRET: str = "flagforge_default_secret"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""
```

Settings are automatically loaded from the `.env` file in the backend directory.

---

## 📐 Startup Initialization Sequence

On application startup (`@app.on_event("startup")`), FlagForge performs:

1. **Schema creation**: `Base.metadata.create_all()` — creates any missing tables.
2. **Column patching**: Detects and ALTERs missing columns on existing tables for forward compatibility.
3. **Audit log backfill**: Fills in `NULL` values for `flag_key` and `environment` fields from `details` text.
4. **Environment seeding**: Ensures `development`, `staging`, and `production` environments exist.
5. **Admin user seeding**: Creates or resets the `admin@flagforge.com` account with password `admin123`.

