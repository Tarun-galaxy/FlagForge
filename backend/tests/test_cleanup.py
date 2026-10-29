from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.cleanup_candidate import CleanupCandidate
from app.models.audit_log import AuditLog
from app.services.cleanup_service import evaluate_flag_cleanup_status, run_cleanup_detection
from app.routers.cleanup import mark_candidate_reviewed, _build_summary_response, ReviewCandidateRequest


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh, clean SQLite in-memory database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Seed environments
    dev = Environment(name="development")
    staging = Environment(name="staging")
    prod = Environment(name="production")
    session.add_all([dev, staging, prod])
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_cleanup_detection_fully_rolled_out(db_session):
    envs = db_session.query(Environment).all()
    past_date = datetime.now(timezone.utc) - timedelta(days=40)

    for env in envs:
        flag = Flag(
            flag_key="stale_rolled_out_flag",
            name="Stale Rolled Out Flag",
            type="boolean",
            default_value="true",
            is_enabled=True,
            environment_id=env.id,
            created_at=past_date,
            updated_at=past_date
        )
        db_session.add(flag)
    db_session.commit()

    eval_res = evaluate_flag_cleanup_status(db_session, "stale_rolled_out_flag")
    assert eval_res is not None
    assert eval_res["status_type"] == "ROLLED_OUT"
    assert eval_res["days_in_state"] >= 40

    candidates = run_cleanup_detection(db_session, threshold_days=30)
    assert len(candidates) == 1
    assert candidates[0].flag_key == "stale_rolled_out_flag"
    assert candidates[0].status_type == "ROLLED_OUT"


def test_cleanup_detection_fully_disabled(db_session):
    envs = db_session.query(Environment).all()
    past_date = datetime.now(timezone.utc) - timedelta(days=45)

    for env in envs:
        flag = Flag(
            flag_key="stale_disabled_flag",
            name="Stale Disabled Flag",
            type="boolean",
            default_value="false",
            is_enabled=False,
            environment_id=env.id,
            created_at=past_date,
            updated_at=past_date
        )
        db_session.add(flag)
    db_session.commit()

    eval_res = evaluate_flag_cleanup_status(db_session, "stale_disabled_flag")
    assert eval_res is not None
    assert eval_res["status_type"] == "DISABLED"
    assert eval_res["days_in_state"] >= 45

    candidates = run_cleanup_detection(db_session, threshold_days=30)
    assert len(candidates) == 1
    assert candidates[0].flag_key == "stale_disabled_flag"
    assert candidates[0].status_type == "DISABLED"


def test_cleanup_detection_partial_mixed_state(db_session):
    envs = db_session.query(Environment).all()
    past_date = datetime.now(timezone.utc) - timedelta(days=50)

    # Enabled in dev, disabled in prod
    for env in envs:
        is_enabled = (env.name == "development")
        flag = Flag(
            flag_key="active_mixed_flag",
            name="Active Mixed Flag",
            type="boolean",
            default_value="true",
            is_enabled=is_enabled,
            environment_id=env.id,
            created_at=past_date,
            updated_at=past_date
        )
        db_session.add(flag)
    db_session.commit()

    eval_res = evaluate_flag_cleanup_status(db_session, "active_mixed_flag")
    assert eval_res is None

    candidates = run_cleanup_detection(db_session, threshold_days=30)
    assert len(candidates) == 0


def test_cleanup_threshold_filtering(db_session):
    envs = db_session.query(Environment).all()
    recent_date = datetime.now(timezone.utc) - timedelta(days=15)

    for env in envs:
        flag = Flag(
            flag_key="recent_flag",
            name="Recent Flag",
            type="boolean",
            default_value="true",
            is_enabled=True,
            environment_id=env.id,
            created_at=recent_date,
            updated_at=recent_date
        )
        db_session.add(flag)
    db_session.commit()

    # Excluded when threshold is 30
    c_30 = run_cleanup_detection(db_session, threshold_days=30)
    assert len(c_30) == 0

    # Included when threshold is 10
    c_10 = run_cleanup_detection(db_session, threshold_days=10)
    assert len(c_10) == 1
    assert c_10[0].flag_key == "recent_flag"


def test_cleanup_review_function(db_session):
    envs = db_session.query(Environment).all()
    past_date = datetime.now(timezone.utc) - timedelta(days=35)

    for env in envs:
        flag = Flag(
            flag_key="flag_to_review",
            name="Flag To Review",
            type="boolean",
            default_value="true",
            is_enabled=True,
            environment_id=env.id,
            created_at=past_date,
            updated_at=past_date
        )
        db_session.add(flag)
    db_session.commit()

    summary = _build_summary_response(db_session, threshold_days=30)
    assert summary.total_candidates == 1
    assert summary.candidates[0].flag_key == "flag_to_review"
    assert summary.candidates[0].reviewed is False

    # Mark reviewed
    updated_cand = mark_candidate_reviewed(
        flag_key="flag_to_review",
        payload=ReviewCandidateRequest(reviewed=True),
        db=db_session,
        authorization=None,
        x_actor_email="dev@acme.com"
    )
    assert updated_cand.reviewed is True
    assert updated_cand.reviewed_by == "dev@acme.com"

    # Verify audit log entry
    logs = db_session.query(AuditLog).filter(AuditLog.flag_key == "flag_to_review").all()
    assert len(logs) == 1
    assert logs[0].action == "MARK_REVIEWED"
