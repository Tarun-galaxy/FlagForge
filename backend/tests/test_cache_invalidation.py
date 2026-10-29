import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.core.evaluator import evaluate_flag_detailed
from app.core.redis_client import (
    build_cache_key,
    get_cached_evaluation,
    set_cached_evaluation,
    invalidate_flag_cache,
    invalidate_all_eval_cache,
    check_redis_connection
)


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh SQLite in-memory database for cache invalidation tests."""
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


def test_cache_key_determinism():
    """(1) Identical request parameters generate identical Redis cache keys."""
    key1 = build_cache_key("flag_a", "development", user_id="u1", groups=["admin", "beta"], context={"country": "US"})
    key2 = build_cache_key("flag_a", "development", user_id="u1", groups=["beta", "admin"], context={"country": "US"})
    key3 = build_cache_key("flag_a", "development", user_id="u2", groups=["beta", "admin"], context={"country": "US"})

    # Order of groups array must be sorted deterministically
    assert key1 == key2
    # Different user_id produces distinct key
    assert key1 != key3


def test_cache_invalidation_isolation(db_session):
    """(2) Invalidating cache for flag A does not invalidate flag B."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag_a = Flag(flag_key="flag_a", name="Flag A", type="boolean", default_value="true", is_enabled=True, environment_id=env_dev.id)
    flag_b = Flag(flag_key="flag_b", name="Flag B", type="boolean", default_value="false", is_enabled=True, environment_id=env_dev.id)
    db_session.add_all([flag_a, flag_b])
    db_session.commit()

    # Evaluate both flags
    res_a1 = evaluate_flag_detailed(db_session, "flag_a", "development", user_id="user_iso")
    res_b1 = evaluate_flag_detailed(db_session, "flag_b", "development", user_id="user_iso")
    assert res_a1["value"] is True
    assert res_b1["value"] is False

    if check_redis_connection():
        # Both should be in cache
        cached_a = get_cached_evaluation("flag_a", "development", user_id="user_iso")
        cached_b = get_cached_evaluation("flag_b", "development", user_id="user_iso")
        assert cached_a is not None
        assert cached_b is not None

        # Invalidate ONLY flag_a
        invalidate_flag_cache("flag_a")

        # flag_a should be invalidated (None), flag_b should remain cached
        assert get_cached_evaluation("flag_a", "development", user_id="user_iso") is None
        assert get_cached_evaluation("flag_b", "development", user_id="user_iso") is not None


def test_invalidate_all_eval_cache_clears_everything(db_session):
    """(3) invalidate_all_eval_cache removes all flag evaluation cache entries."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag1 = Flag(flag_key="multi_1", name="Multi 1", type="boolean", default_value="true", is_enabled=True, environment_id=env_dev.id)
    flag2 = Flag(flag_key="multi_2", name="Multi 2", type="boolean", default_value="true", is_enabled=True, environment_id=env_dev.id)
    db_session.add_all([flag1, flag2])
    db_session.commit()

    evaluate_flag_detailed(db_session, "multi_1", "development", user_id="user_x")
    evaluate_flag_detailed(db_session, "multi_2", "development", user_id="user_y")

    # Invalidate all evaluation cache
    invalidate_all_eval_cache()

    if check_redis_connection():
        assert get_cached_evaluation("multi_1", "development", user_id="user_x") is None
        assert get_cached_evaluation("multi_2", "development", user_id="user_y") is None
