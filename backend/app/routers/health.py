from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis_client import check_redis_connection

router = APIRouter()


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    # 1. Check PostgreSQL database connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
        db_operational = True
    except Exception as e:
        db_status = f"error: {str(e)}"
        db_operational = False

    # 2. Check Redis connection
    redis_operational = check_redis_connection()
    redis_status = "ok" if redis_operational else "error"

    all_operational = db_operational and redis_operational

    return {
        "status": "ok" if all_operational else "degraded",
        "all_systems_operational": all_operational,
        "database": db_status,
        "redis": redis_status,
        "api_server": "Operational",
        "redis_cache": "Operational" if redis_operational else "Degraded",
        "postgresql": "Operational" if db_operational else "Degraded",
        "background_worker": "Operational"
    }
