import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.audit_log import AuditLog
from app.routers.audit_logs import list_audit_logs


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh SQLite in-memory database for audit log tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    dev = Environment(name="development")
    session.add(dev)
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_audit_log_creation_and_fields(db_session):
    """(1) Audit log entries capture actor, action, flag_key, env, and states accurately."""
    log = AuditLog(
        actor="developer@flagforge.io",
        action="CREATE",
        flag_key="new_paywall",
        environment="development",
        details="Created new paywall flag for mobile users",
        previous_state={},
        new_state={"flag_key": "new_paywall", "is_enabled": True}
    )
    db_session.add(log)
    db_session.commit()

    fetched = db_session.query(AuditLog).filter(AuditLog.flag_key == "new_paywall").first()
    assert fetched is not None
    assert fetched.actor == "developer@flagforge.io"
    assert fetched.action == "CREATE"
    assert fetched.environment == "development"
    assert fetched.new_state["is_enabled"] is True


def test_audit_log_filtering_by_actor_and_flag_key(db_session):
    """(2) Filter audit logs by actor, flag_key, environment, and date limits."""
    log1 = AuditLog(actor="user_a@test.com", action="CREATE", flag_key="flag_one", environment="development")
    log2 = AuditLog(actor="user_b@test.com", action="UPDATE", flag_key="flag_two", environment="production")
    log3 = AuditLog(actor="user_a@test.com", action="DELETE", flag_key="flag_one", environment="production")
    db_session.add_all([log1, log2, log3])
    db_session.commit()

    # Filter by actor user_a@test.com
    logs_user_a = list_audit_logs(actor="user_a@test.com", flag_key=None, environment=None, start_date=None, end_date=None, limit=None, db=db_session)
    assert len(logs_user_a) == 2
    assert all(l.actor == "user_a@test.com" for l in logs_user_a)

    # Filter by flag_key flag_two
    logs_flag_two = list_audit_logs(actor=None, flag_key="flag_two", environment=None, start_date=None, end_date=None, limit=None, db=db_session)
    assert len(logs_flag_two) == 1
    assert logs_flag_two[0].flag_key == "flag_two"

    # Filter by environment production
    logs_prod = list_audit_logs(actor=None, flag_key=None, environment="production", start_date=None, end_date=None, limit=None, db=db_session)
    assert len(logs_prod) == 2


def test_audit_log_date_range_filtering(db_session):
    """(3) Filter audit logs by start_date and end_date YYYY-MM-DD."""
    now = datetime.now(timezone.utc)
    old_log = AuditLog(actor="admin@test.com", action="OLD_ACTION", created_at=now - timedelta(days=10))
    recent_log = AuditLog(actor="admin@test.com", action="RECENT_ACTION", created_at=now)
    db_session.add_all([old_log, recent_log])
    db_session.commit()

    today_str = now.strftime("%Y-%m-%d")
    logs_today = list_audit_logs(actor=None, flag_key=None, environment=None, start_date=today_str, end_date=None, limit=None, db=db_session)
    assert len(logs_today) >= 1
    assert any(l.action == "RECENT_ACTION" for l in logs_today)


def test_audit_log_ordering_descending(db_session):
    """(4) Audit logs are ordered most recent first (created_at DESC)."""
    now = datetime.now(timezone.utc)
    l1 = AuditLog(actor="a", action="FIRST", created_at=now - timedelta(seconds=100))
    l2 = AuditLog(actor="a", action="SECOND", created_at=now - timedelta(seconds=50))
    l3 = AuditLog(actor="a", action="THIRD", created_at=now)
    db_session.add_all([l1, l2, l3])
    db_session.commit()

    logs = list_audit_logs(actor=None, flag_key=None, environment=None, start_date=None, end_date=None, limit=None, db=db_session)
    assert logs[0].action == "THIRD"
    assert logs[1].action == "SECOND"
    assert logs[2].action == "FIRST"
