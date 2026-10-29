import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.targeting_rule import TargetingRule
from app.core.evaluator import calculate_user_bucket, evaluate_flag_detailed


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh SQLite in-memory database for targeting rule tests."""
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


def test_percentage_rollout_deterministic_hashing():
    """(1) Same user_id + flag_key must always produce identical bucket (0-99)."""
    user_id = "user_alpha_123"
    flag_key = "new_checkout_flow"

    bucket1 = calculate_user_bucket(user_id, flag_key)
    bucket2 = calculate_user_bucket(user_id, flag_key)
    bucket3 = calculate_user_bucket(user_id, flag_key)

    assert 0 <= bucket1 <= 99
    assert bucket1 == bucket2 == bucket3

    # 1000 repeated evaluations must remain 100% deterministic
    for _ in range(1000):
        assert calculate_user_bucket(user_id, flag_key) == bucket1


def test_percentage_rollout_50_percent_statistical_distribution():
    """(2) 50% rollout across 1,000 unique user IDs should yield approx 45-55% matches."""
    flag_key = "stat_test_flag"
    match_count = 0
    total_users = 1000

    for i in range(total_users):
        bucket = calculate_user_bucket(f"user_id_{i}", flag_key)
        if bucket < 50:
            match_count += 1

    ratio = match_count / total_users
    # 50% threshold +/- 5% tolerance
    assert 0.45 <= ratio <= 0.55, f"Expected 45%-55% rollout, got {ratio * 100}%"


def test_percentage_rollout_boundaries(db_session):
    """(3) 0% rollout matches 0 users; 100% rollout matches all users."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="boundary_flag",
        name="Boundary Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    # Rule: 0% rollout
    rule_0 = TargetingRule(flag_id=flag.id, rule_type="percentage", rule_value="0")
    db_session.add(rule_0)
    db_session.commit()

    for i in range(50):
        res = evaluate_flag_detailed(db_session, "boundary_flag", "development", user_id=f"user_{i}")
        assert res["reason"] == "DEFAULT_VALUE"
        assert res["value"] is False

    # Update Rule to 100% rollout
    rule_0.rule_value = "100"
    db_session.commit()
    from app.core.redis_client import invalidate_flag_cache
    invalidate_flag_cache("boundary_flag")

    for i in range(50):
        res = evaluate_flag_detailed(db_session, "boundary_flag", "development", user_id=f"user_{i}")
        assert res["reason"] == "PERCENTAGE_ROLLOUT"
        assert res["value"] is True


def test_whitelist_whitespace_and_commas_parsing(db_session):
    """(4) Whitelist values with irregular spaces or trailing commas parse cleanly."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="whitespace_flag",
        name="Whitespace Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    rule = TargetingRule(
        flag_id=flag.id,
        rule_type="whitelist",
        rule_value=" alice@test.com ,  bob@test.com, charlie@test.com , "
    )
    db_session.add(rule)
    db_session.commit()

    res_alice = evaluate_flag_detailed(db_session, "whitespace_flag", "development", user_id="alice@test.com")
    assert res_alice["reason"] == "USER_WHITELIST"
    assert res_alice["value"] is True

    res_bob = evaluate_flag_detailed(db_session, "whitespace_flag", "development", user_id="bob@test.com")
    assert res_bob["reason"] == "USER_WHITELIST"

    res_stranger = evaluate_flag_detailed(db_session, "whitespace_flag", "development", user_id="dave@test.com")
    assert res_stranger["reason"] == "DEFAULT_VALUE"


def test_empty_targeting_rules_fallback(db_session):
    """(5) Empty or malformed rule values gracefully fall through to default value."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="empty_rule_flag",
        name="Empty Rule Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    rule_empty_wl = TargetingRule(flag_id=flag.id, rule_type="whitelist", rule_value="   ")
    rule_empty_group = TargetingRule(flag_id=flag.id, rule_type="group", rule_value="")
    db_session.add_all([rule_empty_wl, rule_empty_group])
    db_session.commit()

    res = evaluate_flag_detailed(db_session, "empty_rule_flag", "development", user_id="user_any")
    assert res["reason"] == "DEFAULT_VALUE"
    assert res["value"] is False


def test_whitelist_overrides_group_and_percentage(db_session):
    """(6) Tier 1 Whitelist precedence over Tier 2 Group and Tier 3 Rollout."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="precedence_flag",
        name="Precedence Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    # Add whitelist (VIP user), group, and percentage rules
    db_session.add_all([
        TargetingRule(flag_id=flag.id, rule_type="whitelist", rule_value="vip_user"),
        TargetingRule(flag_id=flag.id, rule_type="group", rule_value="beta_group"),
        TargetingRule(flag_id=flag.id, rule_type="percentage", rule_value="100")
    ])
    db_session.commit()

    res = evaluate_flag_detailed(
        db_session,
        "precedence_flag",
        "development",
        user_id="vip_user",
        groups=["beta_group"]
    )
    assert res["reason"] == "USER_WHITELIST"
    assert res["priority_checks"][0]["status"] == "Matched"
    assert res["priority_checks"][1]["status"] == "Skipped"
