from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.audit_log import AuditLog
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


class AuditLogSchema(BaseModel):
    id: int
    actor: str
    action: str
    flag_key: Optional[str] = None
    environment: Optional[str] = None
    details: Optional[str] = None
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("", response_model=List[AuditLogSchema])
def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor"),
    flag_key: Optional[str] = Query(None, description="Filter by flag key"),
    environment: Optional[str] = Query(None, description="Filter by environment"),
    start_date: Optional[str] = Query(None, description="Filter by start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (YYYY-MM-DD)"),
    limit: Optional[int] = Query(None, description="Max audit logs limit"),
    db: Session = Depends(get_db)
):
    """
    Fetch audit log entries, sorted by most recent first, with optional filters.
    """
    query = db.query(AuditLog)

    if actor and actor != "all":
        query = query.filter(AuditLog.actor == actor)
    if flag_key and flag_key != "all":
        query = query.filter(AuditLog.flag_key == flag_key)
    if environment and environment != "all":
        query = query.filter(AuditLog.environment.ilike(f"%{environment}%"))
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(AuditLog.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(AuditLog.created_at < end_dt)
        except ValueError:
            pass

    query = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())

    if limit and limit > 0:
        query = query.limit(limit)

    logs = query.all()
    return logs



@router.get("/users")
def get_audit_users(db: Session = Depends(get_db)):
    """Fetches list of registered users on the platform."""
    from app.models.user import User
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name or u.email.split("@")[0],
            "avatar_url": u.avatar_url,
            "provider": u.provider
        }
        for u in users
    ]

