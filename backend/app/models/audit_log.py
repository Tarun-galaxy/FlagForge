from sqlalchemy import Column, Integer, String, DateTime, Text, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(100), nullable=False)     # who made the change
    action = Column(String(100), nullable=False)     # e.g. "flag_enabled"
    flag_key = Column(String(100), nullable=True, index=True)
    environment = Column(String(100), nullable=True, index=True)
    details = Column(Text, nullable=True)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())