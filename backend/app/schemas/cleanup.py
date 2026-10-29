from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class CleanupCandidateResponse(BaseModel):
    id: int
    flag_key: str
    status_type: str
    since_date: datetime
    days_in_state: int
    environment_states: Optional[Dict[str, Any]] = None
    last_evaluated_at: Optional[datetime] = None
    reviewed: bool = False
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        from_attributes = True


class CleanupSummaryResponse(BaseModel):
    total_candidates: int
    fully_rolled_out: int
    fully_disabled: int
    reviewed_count: int
    retention_threshold_days: int
    candidates: List[CleanupCandidateResponse]


class ReviewCandidateRequest(BaseModel):
    reviewed: bool = True
