import os
import dotenv
dotenv.load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

import pytest
import app.models
from app.core.database import Base, engine, SessionLocal
from app.core.redis_client import record_evaluation_count, get_pending_evaluation_keys
from app.services.analytics_service import flush_redis_analytics_to_db, get_flag_metrics, seed_flag_analytics
from app.models.evaluation_analytics import EvaluationAnalytics


def test_record_and_flush_analytics():
    Base.metadata.create_all(bind=engine)
    test_flag_key = "test_analytics_flag"
    record_evaluation_count(test_flag_key)
    record_evaluation_count(test_flag_key)

    pending = get_pending_evaluation_keys()
    assert any(test_flag_key in k for k in pending.keys())

    db = SessionLocal()
    try:
        res = flush_redis_analytics_to_db(db)
        assert res["status"] == "success"
        assert res["flushed_keys"] >= 1
        assert res["total_evaluations_flushed"] >= 2

        records = db.query(EvaluationAnalytics).filter(
            EvaluationAnalytics.flag_key == test_flag_key
        ).all()
        assert len(records) >= 1
        assert sum(r.count for r in records) >= 2
    finally:
        db.close()


def test_metrics_calculation_and_seeding():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        flag_key = "api_metrics_test_flag"
        seed_res = seed_flag_analytics(db, flag_key, days=7)
        assert seed_res["status"] == "success"

        metrics = get_flag_metrics(db, flag_key, timeframe="7D")
        assert metrics["flag_key"] == flag_key
        assert metrics["timeframe"] == "7D"
        assert metrics["total_evaluations"] > 0
        assert len(metrics["data"]) >= 7

    finally:
        db.close()
