from sqlalchemy import Column, Integer, String
from app.core.database import Base


class UserGroupMembership(Base):
    __tablename__ = "user_group_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False)
    group_name = Column(String(100), nullable=False)   # e.g. "beta-testers"