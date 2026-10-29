from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.database import Base


class TargetingRule(Base):
    __tablename__ = "targeting_rules"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False)
    rule_type = Column(String(50), nullable=False)   # e.g. "percentage", "user_group"
    rule_value = Column(String(255), nullable=False) # e.g. "10" or "beta-testers"