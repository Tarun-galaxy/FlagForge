import os
import time
import tempfile
import concurrent.futures
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import app.models
from app.core.database import Base
from app.models.environment import Environment
from app.models.flag import Flag
from app.models.targeting_rule import TargetingRule
from app.core.evaluator import evaluate_flag_detailed, evaluate_flag


@pytest.fixture(name="db_session")
def fixture_db_session():
    """Provides a fresh SQLite in-memory database for evaluation load testing."""
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


def test_sequential_evaluation_throughput(db_session):
    """(1) Evaluate flag 200 times sequentially. Must execute < 5.0 seconds."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="load_test_flag",
        name="Load Test Flag",
        type="boolean",
        default_value="true",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    start_time = time.perf_counter()
    eval_count = 200

    for i in range(eval_count):
        val = evaluate_flag(db_session, "load_test_flag", "development", {"userId": f"user_{i}"})
        assert val is True

    elapsed = time.perf_counter() - start_time
    evals_per_sec = eval_count / elapsed

    assert elapsed < 5.0, f"200 evals took {elapsed:.2f}s (expected < 5.0s)"
    assert evals_per_sec > 20, f"Throughput was {evals_per_sec:.1f} evals/sec (expected > 20)"


def test_evaluation_latency_percentiles(db_session):
    """(2) Evaluate 100 flags and measure p50 and p99 evaluation latency."""
    env_dev = db_session.query(Environment).filter(Environment.name == "development").first()
    flag = Flag(
        flag_key="latency_flag",
        name="Latency Flag",
        type="boolean",
        default_value="false",
        is_enabled=True,
        environment_id=env_dev.id
    )
    db_session.add(flag)
    db_session.commit()

    db_session.add(TargetingRule(flag_id=flag.id, rule_type="percentage", rule_value="50"))
    db_session.commit()

    latencies = []
    for i in range(100):
        res = evaluate_flag_detailed(db_session, "latency_flag", "development", user_id=f"user_lat_{i}")
        latencies.append(res.get("latency_ms", 0.0))

    latencies.sort()
    p50 = latencies[len(latencies) // 2]
    p99 = latencies[int(len(latencies) * 0.99)]

    assert p50 < 30.0, f"Median latency p50 was {p50:.2f}ms (expected < 30ms)"
    assert p99 < 100.0, f"p99 latency was {p99:.2f}ms (expected < 100ms)"


def test_concurrent_evaluation_throughput():
    """(3) Multi-threaded concurrent evaluation using thread-safe temporary file database."""
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    
    try:
        engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False, "timeout": 30}
        )
        Base.metadata.create_all(bind=engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        init_db = TestingSessionLocal()
        dev = Environment(name="development")
        init_db.add(dev)
        init_db.commit()

        flag = Flag(
            flag_key="concurrent_flag",
            name="Concurrent Flag",
            type="boolean",
            default_value="true",
            is_enabled=True,
            environment_id=dev.id
        )
        init_db.add(flag)
        init_db.commit()
        init_db.close()

        def run_worker(worker_id):
            session = TestingSessionLocal()
            successes = 0
            try:
                for j in range(20):
                    res = evaluate_flag_detailed(session, "concurrent_flag", "development", user_id=f"worker_{worker_id}_u_{j}")
                    if res["value"] is True:
                        successes += 1
            finally:
                session.close()
            return successes

        start = time.perf_counter()
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(run_worker, w) for w in range(5)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        duration = time.perf_counter() - start
        total_evals = sum(results)

        assert total_evals == 100
        assert duration < 10.0, f"100 concurrent evals took {duration:.2f}s (expected < 10s)"
    finally:
        if os.path.exists(db_path):
            try:
                os.remove(db_path)
            except Exception:
                pass
