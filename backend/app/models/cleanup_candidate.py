from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class CleanupCandidate(Base):
    __tablename__ = "cleanup_candidates"

    id = Column(Integer, primary_key=True, index=True)
    flag_key = Column(String(100), nullable=False, unique=True, index=True)
    status_type = Column(String(50), nullable=False)  # "ROLLED_OUT" or "DISABLED"
    since_date = Column(DateTime(timezone=True), nullable=False)
    days_in_state = Column(Integer, nullable=False, default=0)
    environment_states = Column(JSON, nullable=True)
    last_evaluated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    reviewed = Column(Boolean, nullable=False, default=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(100), nullable=True)
