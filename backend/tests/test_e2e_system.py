from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.targeting_rule import TargetingRule
from app.models.audit_log import AuditLog
from app.core.evaluator import evaluate_flag_detailed
from app.core.redis_client import invalidate_flag_cache, invalidate_all_eval_cache, record_evaluation_count
from app.services.analytics_service import flush_redis_analytics_to_db, get_flag_metrics
from app.services.cleanup_service import run_cleanup_detection


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a clean SQLite in-memory database for end-to-end integration testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    dev = Environment(name="development", description="Dev Environment")
    staging = Environment(name="staging", description="Staging Environment")
    prod = Environment(name="production", description="Production Environment")
    session.add_all([dev, staging, prod])
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_end_to_end_flag_lifecycle_pipeline(db_session):
    """
    Day 19 End-to-End System Integration Test:
    Stage 1: Flag creation
    Stage 2: Targeting rule configuration
    Stage 3: Evaluation engine execution & priority check
    Stage 4: Caching & invalidation
    Stage 5: Audit log tracking
    Stage 6: Analytics counting & database flush
    """
    invalidate_all_eval_cache()
    dev_env = db_session.query(Environment).filter(Environment.name == "development").first()
    staging_env = db_session.query(Environment).filter(Environment.name == "staging").first()
    prod_env = db_session.query(Environment).filter(Environment.name == "production").first()

    flag_key = "e2e_checkout_v2"

    # STAGE 1: Flag Creation across environments
    for env in [dev_env, staging_env, prod_env]:
        new_flag = Flag(
            flag_key=flag_key,
            name="E2E Checkout V2",
            type="boolean",
            default_value="false",
            owner_team="Checkout Team",
            is_enabled=(env.name == "development"),
            environment_id=env.id
        )
        db_session.add(new_flag)

    db_session.add(AuditLog(
        actor="admin@flagforge.com",
        action="CREATE",
        flag_key=flag_key,
        environment="development",
        details="Created E2E Checkout V2 flag",
        previous_state={},
        new_state={"flag_key": flag_key, "is_enabled": True}
    ))
    db_session.commit()

    dev_flag = db_session.query(Flag).filter(Flag.flag_key == flag_key, Flag.environment_id == dev_env.id).first()
    assert dev_flag is not None
    assert dev_flag.is_enabled is True

    # STAGE 2: Configure Targeting Rules
    pct_rule = TargetingRule(
        flag_id=dev_flag.id,
        rule_type="percentage",
        rule_value="50"
    )
    wl_rule = TargetingRule(
        flag_id=dev_flag.id,
        rule_type="whitelist",
        rule_value="user_beta_100,user_beta_200"
    )
    db_session.add_all([pct_rule, wl_rule])

    db_session.add(AuditLog(
        actor="admin@flagforge.com",
        action="UPDATE_TARGETING",
        flag_key=flag_key,
        environment="development",
        details="Updated targeting rules: 50% rollout + whitelist",
        previous_state={},
        new_state={"percentage": 50, "whitelist": "user_beta_100,user_beta_200"}
    ))
    db_session.commit()
    invalidate_flag_cache(flag_key)

    # STAGE 3 & 4: Evaluation & Priority Check
    # Whitelisted user -> Whitelist Priority 1
    eval_wl = evaluate_flag_detailed(db_session, flag_key, "development", user_id="user_beta_100")
    assert eval_wl["value"] is True
    assert eval_wl["reason"] == "USER_WHITELIST"

    # Non-whitelisted user evaluation
    eval_regular = evaluate_flag_detailed(db_session, flag_key, "development", user_id="user_regular_99")
    assert "reason" in eval_regular

    # STAGE 5: Audit Log Verification
    logs = db_session.query(AuditLog).filter(AuditLog.flag_key == flag_key).all()
    assert len(logs) == 2
    assert logs[0].action == "CREATE"
    assert logs[1].action == "UPDATE_TARGETING"

    # STAGE 6: Analytics Counting & Flush
    # Increment Redis counter
    record_evaluation_count(flag_key)
    record_evaluation_count(flag_key)

    # Flush Redis analytics to database
    flush_res = flush_redis_analytics_to_db(db_session)
    assert flush_res is not None

    # Retrieve metrics
    metrics = get_flag_metrics(db_session, flag_key, timeframe="30D")
    assert "total_evaluations" in metrics
    assert "data" in metrics


