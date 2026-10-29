from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for OAuth-only users
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    provider = Column(String, default="email")  # 'email', 'google', 'github'
    provider_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
