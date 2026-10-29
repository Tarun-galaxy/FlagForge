from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.core.database import Base


class Flag(Base):
    __tablename__ = "flags"

    id = Column(Integer, primary_key=True, index=True)
    flag_key = Column(String(100), nullable=False)   # e.g. "new-checkout-flow"
    name = Column(String(150), nullable=False)
    description = Column(String(500), nullable=True)
    type = Column(String(50), nullable=False, default="boolean") # boolean, string, number
    default_value = Column(String(500), nullable=False, default="false")
    owner_team = Column(String(100), nullable=True)
    is_enabled = Column(Boolean, default=False, nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_flags_flag_key", "flag_key"),
        Index("ix_flags_environment_id", "environment_id"),
    )