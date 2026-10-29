import random
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.evaluation_analytics import EvaluationAnalytics
from app.core.redis_client import get_pending_evaluation_keys, clear_evaluation_key


def parse_hourly_key(key: str) -> Optional[tuple[str, datetime]]:
    """
    Parses key format flag:{flag_key}:{YYYY-MM-DD-HH}
    Returns (flag_key, hour_datetime_utc) or None if format doesn't match.
    """
    try:
        parts = key.split(":")
        if len(parts) != 3 or parts[0] != "flag":
            return None
        flag_key = parts[1]
        hour_str = parts[2]  # e.g. 2026-08-05-18
        dt = datetime.strptime(hour_str, "%Y-%m-%d-%H").replace(tzinfo=timezone.utc)
        return flag_key, dt
    except Exception:
        return None


def flush_redis_analytics_to_db(db: Session) -> Dict[str, Any]:
    """
    Scans Redis keys matching flag:*:*, aggregates counts per flag_key + hour_bucket,
    upserts into evaluation_analytics table in PostgreSQL/DB, and deletes keys from Redis.
    """
    pending = get_pending_evaluation_keys()
    flushed_keys_count = 0
    total_evaluations_flushed = 0

    for key, count in pending.items():
        parsed = parse_hourly_key(key)
        if not parsed:
            continue

        flag_key, hour_bucket = parsed

        # Upsert logic: find existing record or create new
        record = db.query(EvaluationAnalytics).filter(
            EvaluationAnalytics.flag_key == flag_key,
            EvaluationAnalytics.hour_bucket == hour_bucket
        ).first()

        if record:
            record.count += count
        else:
            record = EvaluationAnalytics(
                flag_key=flag_key,
                hour_bucket=hour_bucket,
                count=count
            )
            db.add(record)

        clear_evaluation_key(key)
        flushed_keys_count += 1
        total_evaluations_flushed += count

    db.commit()

    return {
        "status": "success",
        "flushed_keys": flushed_keys_count,
        "total_evaluations_flushed": total_evaluations_flushed
    }


def get_flag_metrics(db: Session, flag_key: str, timeframe: str = "30D") -> Dict[str, Any]:
    """
    Calculates flag evaluation metrics over the selected timeframe (7D, 30D, 90D).
    Merges flushed DB historical records with live un-flushed Redis counters.
    """
    days = 30
    if timeframe == "7D":
        days = 7
    elif timeframe == "90D":
        days = 90

    now_utc = datetime.now(timezone.utc)
    start_date = now_utc - timedelta(days=days)
    prev_start_date = start_date - timedelta(days=days)

    # 1. Fetch historical DB evaluation analytics
    records = db.query(EvaluationAnalytics).filter(
        EvaluationAnalytics.flag_key == flag_key,
        EvaluationAnalytics.hour_bucket >= prev_start_date
    ).all()

    # 2. Map hourly buckets into date groups
    # Structure: date_str (YYYY-MM-DD) -> total_count
    current_period_counts: Dict[str, int] = {}
    previous_period_counts: Dict[str, int] = {}

    # Initialize all dates in current period so chart has smooth timeline
    for d in range(days):
        day_dt = (now_utc - timedelta(days=days - 1 - d)).date()
        date_str = day_dt.isoformat()
        current_period_counts[date_str] = 0

    for r in records:
        r_dt = r.hour_bucket.astimezone(timezone.utc) if r.hour_bucket.tzinfo else r.hour_bucket.replace(tzinfo=timezone.utc)
        date_str = r_dt.date().isoformat()

        if r_dt >= start_date:
            current_period_counts[date_str] = current_period_counts.get(date_str, 0) + r.count
        elif r_dt >= prev_start_date:
            previous_period_counts[date_str] = previous_period_counts.get(date_str, 0) + r.count

    # 3. Merge active un-flushed Redis counters
    pending = get_pending_evaluation_keys()
    for key, count in pending.items():
        parsed = parse_hourly_key(key)
        if parsed and parsed[0] == flag_key:
            dt = parsed[1]
            if dt >= start_date:
                d_str = dt.date().isoformat()
                current_period_counts[d_str] = current_period_counts.get(d_str, 0) + count

    total_evaluations = sum(current_period_counts.values())
    prev_total_evaluations = sum(previous_period_counts.values())

    # Calculate percentage change
    change_pct = 0.0
    if prev_total_evaluations > 0:
        change_pct = round(((total_evaluations - prev_total_evaluations) / prev_total_evaluations) * 100.0, 1)
    elif total_evaluations > 0:
        change_pct = 100.0

    # Build chart data series array sorted by date
    chart_data = []
    for date_str in sorted(current_period_counts.keys()):
        dt_obj = datetime.strptime(date_str, "%Y-%m-%d")
        formatted_date = dt_obj.strftime("%b %d")  # e.g. "May 17"
        chart_data.append({
            "date": formatted_date,
            "full_date": date_str,
            "count": current_period_counts[date_str]
        })

    return {
        "flag_key": flag_key,
        "timeframe": timeframe,
        "total_evaluations": total_evaluations,
        "previous_total": prev_total_evaluations,
        "change_percentage": change_pct,
        "is_positive": change_pct >= 0,
        "data": chart_data
    }


def clear_flag_analytics(db: Session, flag_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Clears evaluation analytics records for a specific flag or all flags.
    """
    query = db.query(EvaluationAnalytics)
    if flag_key:
        query = query.filter(EvaluationAnalytics.flag_key == flag_key)
    deleted_count = query.delete()
    db.commit()
    return {"status": "success", "deleted_records": deleted_count, "flag_key": flag_key}


def seed_flag_analytics(db: Session, flag_key: str, days: int = 30) -> Dict[str, Any]:
    """
    Generates realistic evaluation analytics data starting from Aug 01, 2026 to current date.
    """
    now_utc = datetime.now(timezone.utc)
    # Target date: Aug 1, 2026
    start_seed_date = datetime(2026, 8, 1, tzinfo=timezone.utc)
    inserted_records = 0

    # Clean existing seed records for clean chart state
    db.query(EvaluationAnalytics).filter(EvaluationAnalytics.flag_key == flag_key).delete()

    # Seed days starting from 10 days before Aug 1 up to today (Aug 5)
    days_count = (now_utc.date() - start_seed_date.date()).days + 1 + 5  # include past week comparison
    for d in range(days_count):
        day_date = now_utc - timedelta(days=d)
        base_count = random.randint(4000, 15000)

        for hour in range(24):
            hour_dt = day_date.replace(hour=hour, minute=0, second=0, microsecond=0)
            peak_multiplier = 1.8 if 9 <= hour <= 18 else 0.4
            hourly_count = int((base_count / 24.0) * peak_multiplier * random.uniform(0.8, 1.2))

            if hourly_count > 0:
                db.add(EvaluationAnalytics(
                    flag_key=flag_key,
                    hour_bucket=hour_dt,
                    count=hourly_count
                ))
                inserted_records += 1

    db.commit()
    return {"status": "success", "seeded_records": inserted_records, "flag_key": flag_key}


