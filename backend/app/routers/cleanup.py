from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.cleanup_candidate import CleanupCandidate
from app.models.audit_log import AuditLog
from app.schemas.cleanup import (
    CleanupCandidateResponse,
    CleanupSummaryResponse,
    ReviewCandidateRequest
)
from app.services.cleanup_service import run_cleanup_detection

router = APIRouter(prefix="/cleanup", tags=["cleanup"])


def _build_summary_response(db: Session, threshold_days: int) -> CleanupSummaryResponse:
    # Trigger scan for threshold
    candidates = run_cleanup_detection(db, threshold_days=threshold_days)

    total = len(candidates)
    rolled_out = sum(1 for c in candidates if c.status_type == "ROLLED_OUT")
    disabled = sum(1 for c in candidates if c.status_type == "DISABLED")
    reviewed_count = sum(1 for c in candidates if c.reviewed)

    return CleanupSummaryResponse(
        total_candidates=total,
        fully_rolled_out=rolled_out,
        fully_disabled=disabled,
        reviewed_count=reviewed_count,
        retention_threshold_days=threshold_days,
        candidates=candidates
    )


@router.get("/candidates", response_model=CleanupSummaryResponse)
def get_cleanup_candidates(
    threshold_days: int = Query(30, ge=0, description="Retention threshold in days"),
    db: Session = Depends(get_db)
):
    """
    Get all flag cleanup candidates that have been fully rolled out or disabled for >= threshold_days.
    """
    return _build_summary_response(db, threshold_days)


@router.post("/evaluate", response_model=CleanupSummaryResponse)
def evaluate_cleanup(
    threshold_days: int = Query(30, ge=0, description="Retention threshold in days"),
    db: Session = Depends(get_db)
):
    """
    Trigger on-demand cleanup scan across all flags for >= threshold_days.
    """
    return _build_summary_response(db, threshold_days)


@router.post("/candidates/{flag_key}/review", response_model=CleanupCandidateResponse)
def mark_candidate_reviewed(
    flag_key: str,
    payload: Optional[ReviewCandidateRequest] = None,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    """
    Mark a cleanup candidate flag as reviewed or unreviewed.
    """
    current_actor = get_current_actor(authorization, x_actor_email)
    candidate = db.query(CleanupCandidate).filter(CleanupCandidate.flag_key == flag_key).first()
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cleanup candidate for flag '{flag_key}' not found."
        )

    is_reviewed = payload.reviewed if payload else True
    now = datetime.now(timezone.utc)

    candidate.reviewed = is_reviewed
    candidate.reviewed_at = now if is_reviewed else None
    candidate.reviewed_by = current_actor if is_reviewed else None

    # Record Audit Log
    db.add(AuditLog(
        actor=current_actor,
        action="MARK_REVIEWED" if is_reviewed else "MARK_UNREVIEWED",
        flag_key=flag_key,
        environment="all",
        details=f"Flag cleanup candidate '{flag_key}' marked as reviewed={is_reviewed}",
        previous_state={"reviewed": not is_reviewed},
        new_state={"reviewed": is_reviewed, "reviewed_by": current_actor, "reviewed_at": str(now)}
    ))

    db.commit()
    db.refresh(candidate)

    return candidate
