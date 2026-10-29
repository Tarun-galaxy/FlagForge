from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.core.database import Base


class FlagOverride(Base):
    __tablename__ = "flag_overrides"

    id = Column(Integer, primary_key=True, index=True)
    flag_key = Column(String(100), nullable=False)
    environment_id = Column(Integer, ForeignKey("environments.id"), nullable=False)
    value = Column(String(500), nullable=False)  # The override value represented as string
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        Index("ix_flag_overrides_flag_key_environment", "flag_key", "environment_id", unique=True),
    )
