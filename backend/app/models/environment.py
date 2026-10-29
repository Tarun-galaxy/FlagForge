from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Environment(Base):
    __tablename__ = "environments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)  # e.g. "development"
    description = Column(String(250), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())