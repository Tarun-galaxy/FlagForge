import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.targeting_rule import TargetingRule
from app.models.flag_override import FlagOverride
from app.core.evaluator import evaluate_flag_detailed
from app.core.redis_client import invalidate_flag_cache, invalidate_all_eval_cache, check_redis_connection


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh, clean SQLite in-memory database for integration testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    development = Environment(name="development", description="Development Environment")
    session.add(development)
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_5_tier_priority_hierarchy_and_caching(db_session):
    """
    Milestone 2 Integration Test:
    Verifies 5-tier evaluation priority order:
    Tier 1 (Whitelist) > Tier 2 (Groups) > Tier 3 (Rollout) > Tier 4 (Env Override) > Tier 5 (Default)
    Also tests Redis cache invalidation after every rule mutation.
    """
    invalidate_all_eval_cache()
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    # 1. Create Base Flag (Default = false)
    flag = Flag(
        flag_key="MILESTONE2_FLAG",
        name="Milestone 2 Integration Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    # Tier 5: Default Value Fallback
    res_default = evaluate_flag_detailed(db_session, "MILESTONE2_FLAG", "development", user_id="user_999")
    assert res_default["value"] is False
    assert res_default["matched_rule"] == "DEFAULT_VALUE"

    # Tier 4: Environment Override
    override = FlagOverride(
        flag_key="MILESTONE2_FLAG",
        environment_id=env_dev.id,
        value="true"
    )
    db_session.add(override)
    db_session.commit()
    invalidate_flag_cache("MILESTONE2_FLAG")

    res_override = evaluate_flag_detailed(db_session, "MILESTONE2_FLAG", "development", user_id="user_999")
    assert res_override["value"] is True
    assert res_override["matched_rule"] == "ENV_OVERRIDE"

    # Tier 3: Percentage Rollout
    rule_pct = TargetingRule(
        flag_id=flag.id,
        rule_type="percentage",
        rule_value="100"
    )
    db_session.add(rule_pct)
    db_session.commit()
    invalidate_flag_cache("MILESTONE2_FLAG")

    res_pct = evaluate_flag_detailed(db_session, "MILESTONE2_FLAG", "development", user_id="user_999")
    assert res_pct["value"] is True
    assert res_pct["matched_rule"] == "PERCENTAGE_ROLLOUT"

    # Tier 2: Group Targeting
    rule_group = TargetingRule(
        flag_id=flag.id,
        rule_type="group",
        rule_value="beta_testers"
    )
    db_session.add(rule_group)
    db_session.commit()
    invalidate_flag_cache("MILESTONE2_FLAG")

    res_group = evaluate_flag_detailed(db_session, "MILESTONE2_FLAG", "development", user_id="user_999", groups=["beta_testers"])
    assert res_group["value"] is True
    assert res_group["matched_rule"] == "GROUP_TARGETING"

    # Tier 1: User Whitelist
    rule_wl = TargetingRule(
        flag_id=flag.id,
        rule_type="whitelist",
        rule_value="vip_user_1"
    )
    db_session.add(rule_wl)
    db_session.commit()
    invalidate_flag_cache("MILESTONE2_FLAG")

    res_wl = evaluate_flag_detailed(db_session, "MILESTONE2_FLAG", "development", user_id="vip_user_1")
    assert res_wl["value"] is True
    assert res_wl["matched_rule"] == "USER_WHITELIST"
