from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.core.config import settings
from app.core.database import engine, Base
from app.routers import health, flags, environments, audit_logs, groups, auth, cleanup
import app.models  # Ensure all models are registered with Base metadata

app = FastAPI(
    title="FlagForge API",
    description="Application Feature Planning & Release Governance System API",
    docs_url="/docs",
    redoc_url=None
)

# Allow the React frontend (running on a different port) to call this API
cors_origins = list({
    settings.FRONTEND_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(flags.router)
app.include_router(environments.router)
app.include_router(audit_logs.router)
app.include_router(groups.router)
app.include_router(cleanup.router)



@app.on_event("startup")
def startup_event():
    # Auto-create tables and patch missing columns for existing tables
    try:
        Base.metadata.create_all(bind=engine)
        from sqlalchemy import text, inspect
        inspector = inspect(engine)
        with engine.connect() as conn:
            def patch_missing_columns(table_name, required_cols):
                try:
                    if table_name in inspector.get_table_names():
                        existing_cols = {col['name'] for col in inspector.get_columns(table_name)}
                        for col_name, col_def in required_cols.items():
                            if col_name not in existing_cols:
                                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_def};"))
                                conn.commit()
                                print(f"Patched column {col_name} into {table_name}")
                except Exception as ex:
                    print(f"Error checking/patching columns for {table_name}: {ex}")

            patch_missing_columns("users", {
                "hashed_password": "VARCHAR",
                "full_name": "VARCHAR",
                "avatar_url": "VARCHAR",
                "provider": "VARCHAR DEFAULT 'email'",
                "provider_id": "VARCHAR",
                "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            })

            patch_missing_columns("audit_log", {
                "flag_key": "VARCHAR",
                "environment": "VARCHAR",
                "details": "TEXT",
                "previous_state": "JSON",
                "new_state": "JSON",
                "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            })

            patch_missing_columns("flags", {
                "description": "VARCHAR",
                "type": "VARCHAR DEFAULT 'boolean'",
                "default_value": "VARCHAR DEFAULT 'false'",
                "owner_team": "VARCHAR"
            })

            patch_missing_columns("environments", {
                "description": "VARCHAR"
            })

            # Backfill missing audit_log flag_key and environment fields from details
            try:
                import re
                import json
                audit_rows = conn.execute(text("SELECT id, actor, action, flag_key, environment, details, previous_state, new_state FROM audit_log WHERE flag_key IS NULL OR environment IS NULL")).fetchall()
                for row in audit_rows:
                    row_id, actor, action, flag_k, env_name, details, prev_s, new_s = row
                    det_str = details or ''
                    if not flag_k:
                        m_flag = re.search(r"Flag ['\"]([^'\"]+)['\"]", det_str)
                        flag_k = m_flag.group(1) if m_flag else 'system'
                    if not env_name:
                        m_env = re.search(r"in ([A-Z_]+)", det_str, re.IGNORECASE)
                        env_name = m_env.group(1).lower() if m_env else 'development'
                    act_name = action if action else ('UPDATE' if 'updated' in det_str.lower() else 'CREATE')
                    act_email = actor if (actor and '@' in actor) else 'admin@acme.com'
                    p_state = prev_s or json.dumps({"flag_key": flag_k, "environment": env_name, "is_enabled": False})
                    n_state = new_s or json.dumps({"flag_key": flag_k, "environment": env_name, "is_enabled": True})
                    conn.execute(
                        text("UPDATE audit_log SET flag_key = :fk, environment = :env, action = :act, actor = :ac, previous_state = :ps, new_state = :ns WHERE id = :id"),
                        {"fk": flag_k, "env": env_name, "act": act_name, "ac": act_email, "ps": str(p_state), "ns": str(n_state), "id": row_id}
                    )
            except Exception as ex_bf:
                print(f"Audit log backfill note: {ex_bf}")

            conn.commit()
    except Exception as e:
        print(f"Table creation/migration note: {e}")

    from app.core.database import SessionLocal
    from app.models.environment import Environment
    from app.models.user import User
    from app.core.security import hash_password

    db = SessionLocal()
    try:
        default_envs = {
            "development": "For developers to test features",
            "staging": "QA & pre-production testing",
            "production": "Live environment for end users"
        }
        for env_name, env_desc in default_envs.items():
            existing = db.query(Environment).filter(Environment.name == env_name).first()
            if not existing:
                db.add(Environment(name=env_name, description=env_desc))
            else:
                if not existing.description:
                    existing.description = env_desc

        # Ensure default admin account exists
        admin_user = db.query(User).filter(User.email == "admin@flagforge.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@flagforge.com",
                hashed_password=hash_password("admin123"),
                full_name="Admin",
                provider="email"
            )
            db.add(admin_user)
        else:
            admin_user.hashed_password = hash_password("admin123")
            admin_user.full_name = "Admin"

        db.commit()
    except Exception as e:
        print(f"Error seeding environments/users: {e}")
        db.rollback()
    finally:
        db.close()


@app.get("/")
def root():
    return RedirectResponse(url="/docs")


@app.post("/evaluate")
def evaluate_root(
    payload: flags.EvaluationRequest,
    db=flags.Depends(flags.get_db)
):
    """
    Top-level evaluation endpoint for consuming applications (POST /evaluate).
    """
    return flags.evaluate_flag_endpoint(payload=payload, db=db)