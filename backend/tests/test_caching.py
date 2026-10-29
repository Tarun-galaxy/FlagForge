import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.core.evaluator import evaluate_flag_detailed
from app.core.redis_client import invalidate_flag_cache, invalidate_all_eval_cache, check_redis_connection


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh, clean SQLite in-memory database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()

    development = Environment(name="development")
    session.add(development)
    session.commit()

    try:
        yield session
    finally:
        session.close()


def test_redis_evaluation_caching_and_invalidation(db_session):
    """
    Tests evaluation caching (sub-millisecond hit) and cache invalidation.
    """
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="redis-cache-test",
        name="Redis Cache Test Flag",
        type="boolean",
        default_value="true",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    # 1. First evaluation: Cache Miss
    res1 = evaluate_flag_detailed(db_session, "redis-cache-test", "development", user_id="user_cache_101")
    assert res1["value"] is True
    assert "latency_ms" in res1
    assert res1["latency_ms"] >= 0

    # 2. Test cache hit and invalidation if Redis is connected
    if check_redis_connection():
        res2 = evaluate_flag_detailed(db_session, "redis-cache-test", "development", user_id="user_cache_101")
        assert res2["cached"] is True
        assert res2["served_from_cache"] is True

        # Invalidate cache for flag
        invalidate_flag_cache("redis-cache-test")

        # Third evaluation after invalidation: Cache Miss
        res3 = evaluate_flag_detailed(db_session, "redis-cache-test", "development", user_id="user_cache_101")
        assert res3["cached"] is False
