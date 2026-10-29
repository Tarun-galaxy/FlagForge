from sqlalchemy import Column, Integer, String, BigInteger, DateTime, Index, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base


class EvaluationAnalytics(Base):
    __tablename__ = "evaluation_analytics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    flag_key = Column(String(100), nullable=False, index=True)
    hour_bucket = Column(DateTime(timezone=True), nullable=False, index=True)
    count = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("flag_key", "hour_bucket", name="uq_flag_hour_bucket"),
        Index("ix_eval_analytics_flag_hour", "flag_key", "hour_bucket"),
    )
