import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.core.evaluator import evaluate_flag, evaluate_flag_detailed


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh, clean SQLite in-memory database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    # Seed environments
    development = Environment(name="development")
    staging = Environment(name="staging")
    production = Environment(name="production")
    session.add_all([development, staging, production])
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_evaluation_returns_default_value_when_no_rules(db_session):
    """(1) Default value is returned when no rule matches."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    flag_str = Flag(
        flag_key="theme-color",
        name="Theme Color",
        type="string",
        default_value="blue",
        is_enabled=True,
        environment_id=env_dev.id
    )
    flag_num = Flag(
        flag_key="retry-count",
        name="Retry Count",
        type="number",
        default_value="5",
        is_enabled=True,
        environment_id=env_dev.id
    )
    
    db_session.add_all([flag_str, flag_num])
    db_session.commit()

    res_str = evaluate_flag(db_session, "theme-color", "development", {"userId": "123"})
    res_num = evaluate_flag(db_session, "retry-count", "development", {"userId": "123"})
    
    assert res_str == "blue"
    assert res_num == 5


def test_evaluation_environment_override(db_session):
    """(2) Environment override works correctly."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    env_prod = db_session.query(Environment).filter(Environment.name == "production").first()

    flag_dev = Flag(
        flag_key="new-dashboard",
        name="New Dashboard",
        type="boolean",
        default_value="true",
        is_enabled=True,
        environment_id=env_dev.id
    )
    flag_prod = Flag(
        flag_key="new-dashboard",
        name="New Dashboard",
        type="boolean",
        default_value="false",
        is_enabled=False,
        environment_id=env_prod.id
    )
    
    db_session.add_all([flag_dev, flag_prod])
    db_session.commit()

    dev_result = evaluate_flag(db_session, "new-dashboard", "development")
    assert dev_result is True

    prod_result = evaluate_flag(db_session, "new-dashboard", "production")
    assert prod_result is False


def test_disabled_flag_always_returns_false_or_default(db_session):
    """(3) A disabled flag always returns false/default."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    flag_bool = Flag(
        flag_key="promo-banner",
        name="Promo Banner",
        type="boolean",
        default_value="true",
        is_enabled=False,
        environment_id=env_dev.id
    )
    flag_num = Flag(
        flag_key="max-items",
        name="Max Items",
        type="number",
        default_value="100",
        is_enabled=False,
        environment_id=env_dev.id
    )
    
    db_session.add_all([flag_bool, flag_num])
    db_session.commit()

    res_bool = evaluate_flag(db_session, "promo-banner", "development")
    res_num = evaluate_flag(db_session, "max-items", "development")

    assert res_bool is False
    assert res_num == 100


def test_evaluation_works_with_missing_user_context(db_session):
    """(4) Evaluation works even with an empty/missing user context."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    flag = Flag(
        flag_key="checkout-flow-v2",
        name="Checkout Flow V2",
        type="boolean",
        default_value="true",
        is_enabled=True,
        environment_id=env_dev.id
    )
    
    db_session.add(flag)
    db_session.commit()

    res_none = evaluate_flag(db_session, "checkout-flow-v2", "development", None)
    res_empty = evaluate_flag(db_session, "checkout-flow-v2", "development", {})

    assert res_none is True
    assert res_empty is True


def test_evaluation_user_targeting_whitelist(db_session):
    """(5) Test user targeting whitelist logic works correctly."""
    from app.models.targeting_rule import TargetingRule
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    flag = Flag(
        flag_key="beta-access",
        name="Beta Access",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()
    db_session.refresh(flag)

    rule = TargetingRule(
        flag_id=flag.id,
        rule_type="whitelist",
        rule_value="tester1, tester2"
    )
    db_session.add(rule)
    db_session.commit()

    res_tester1 = evaluate_flag(db_session, "beta-access", "development", {"userId": "tester1"})
    assert res_tester1 is True

    res_tester2 = evaluate_flag(db_session, "beta-access", "development", {"userId": "tester2"})
    assert res_tester2 is True

    res_stranger = evaluate_flag(db_session, "beta-access", "development", {"userId": "stranger"})
    assert res_stranger is False


def test_evaluation_user_group_targeting(db_session):
    """(6) Test group membership targeting works correctly."""
    from app.models.targeting_rule import TargetingRule
    from app.models.user_group_membership import UserGroupMembership
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    
    flag = Flag(
        flag_key="premium-features",
        name="Premium Features",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()
    db_session.refresh(flag)

    db_session.add(UserGroupMembership(user_id="user101", group_name="premium_plan"))
    db_session.add(UserGroupMembership(user_id="user101", group_name="beta_users"))
    db_session.commit()

    rule = TargetingRule(
        flag_id=flag.id,
        rule_type="group",
        rule_value="premium_plan, internal_team"
    )
    db_session.add(rule)
    db_session.commit()

    res_user101 = evaluate_flag(db_session, "premium-features", "development", {"userId": "user101"})
    assert res_user101 is True


def test_evaluation_5_tier_priority_steps(db_session):
    """(10) Test 5-tier priority evaluation and step status reporting."""
    from app.models.targeting_rule import TargetingRule
    from app.models.flag_override import FlagOverride
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()

    flag = Flag(
        flag_key="AI_CHAT",
        name="AI Chat",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()
    db_session.refresh(flag)

    # 1. Group Rule
    db_session.add(TargetingRule(
        flag_id=flag.id,
        rule_type="group",
        rule_value="beta_users"
    ))
    # 2. Env Override
    db_session.add(FlagOverride(
        flag_key="AI_CHAT",
        environment_id=env_dev.id,
        value="false"
    ))
    db_session.commit()

    # User in beta_users group -> Group Targeting matches (Priority 2) before Env Override (Priority 4)
    detailed = evaluate_flag_detailed(
        db=db_session,
        flag_key="AI_CHAT",
        environment_name="development",
        user_id="user_101",
        groups=["beta_users"]
    )

    assert detailed["reason"] == "GROUP_TARGETING"
    assert detailed["value"] is True

    steps = detailed["priority_checks"]
    assert len(steps) == 5
    assert steps[0]["status"] == "No match"  # User Whitelist
    assert steps[1]["status"] == "Matched"   # Group Targeting
    assert steps[2]["status"] == "Skipped"    # % Rollout
    assert steps[3]["status"] == "Skipped"    # Env Override
    assert steps[4]["status"] == "Skipped"    # Default Value
