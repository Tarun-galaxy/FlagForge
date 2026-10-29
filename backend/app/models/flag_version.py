from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class FlagVersion(Base):
    __tablename__ = "flag_versions"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False)
    is_enabled = Column(Boolean, nullable=False)
    change_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())