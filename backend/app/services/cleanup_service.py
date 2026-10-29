from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.flag import Flag
from app.models.environment import Environment
from app.models.targeting_rule import TargetingRule
from app.models.cleanup_candidate import CleanupCandidate


def evaluate_flag_cleanup_status(db: Session, flag_key: str) -> Optional[Dict[str, Any]]:
    """
    Evaluates whether a given flag_key is fully rolled out (100% in all envs)
    or fully disabled (0% / disabled in all envs) across all configured environments.
    """
    all_envs = db.query(Environment).all()
    if not all_envs:
        return None

    flag_records = db.query(Flag).filter(Flag.flag_key == flag_key).all()
    if not flag_records:
        return None

    env_map = {env.id: env.name for env in all_envs}
    env_states = {}
    
    is_all_rolled_out = True
    is_all_disabled = True
    latest_timestamp: Optional[datetime] = None

    for flag in flag_records:
        env_name = env_map.get(flag.environment_id, f"env_{flag.environment_id}")
        
        # Check percentage targeting rule
        pct_rule = db.query(TargetingRule).filter(
            TargetingRule.flag_id == flag.id,
            TargetingRule.rule_type == "percentage"
        ).first()

        rollout_pct = 0
        if pct_rule and pct_rule.rule_value:
            try:
                rollout_pct = int(pct_rule.rule_value)
            except ValueError:
                rollout_pct = 0
        else:
            # If enabled without percentage rule, rollout is 100%, else 0%
            rollout_pct = 100 if flag.is_enabled else 0

        # Effective environment enabled state
        effective_enabled = flag.is_enabled and (rollout_pct > 0)
        effective_rolled_out = flag.is_enabled and (rollout_pct >= 100)

        env_states[env_name] = {
            "is_enabled": flag.is_enabled,
            "rollout_percentage": rollout_pct,
            "effective_enabled": effective_enabled
        }

        if not effective_rolled_out:
            is_all_rolled_out = False

        if effective_enabled:
            is_all_disabled = False

        # Track latest change timestamp across environment flags
        ts = flag.updated_at or flag.created_at
        if ts:
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if latest_timestamp is None or ts > latest_timestamp:
                latest_timestamp = ts

    # If flags don't cover all existing environments in system, don't flag as candidate
    if len(flag_records) < len(all_envs):
        return None

    if not is_all_rolled_out and not is_all_disabled:
        return None

    status_type = "ROLLED_OUT" if is_all_rolled_out else "DISABLED"

    now = datetime.now(timezone.utc)
    if not latest_timestamp:
        latest_timestamp = now

    days_in_state = max(0, (now - latest_timestamp).days)

    return {
        "flag_key": flag_key,
        "status_type": status_type,
        "since_date": latest_timestamp,
        "days_in_state": days_in_state,
        "environment_states": env_states
    }


def run_cleanup_detection(db: Session, threshold_days: int = 30) -> List[CleanupCandidate]:
    """
    Scans all flags in the system, identifies cleanup candidates based on threshold_days,
    updates the cleanup_candidates database table, and returns the active candidates.
    """
    distinct_keys = db.query(Flag.flag_key).distinct().all()
    flag_keys = [k[0] for k in distinct_keys]
    now = datetime.now(timezone.utc)

    for key in flag_keys:
        eval_res = evaluate_flag_cleanup_status(db, key)
        existing_candidate = db.query(CleanupCandidate).filter(CleanupCandidate.flag_key == key).first()

        if eval_res and eval_res["days_in_state"] >= threshold_days:
            if existing_candidate:
                existing_candidate.status_type = eval_res["status_type"]
                existing_candidate.since_date = eval_res["since_date"]
                existing_candidate.days_in_state = eval_res["days_in_state"]
                existing_candidate.environment_states = eval_res["environment_states"]
                existing_candidate.last_evaluated_at = now
            else:
                new_cand = CleanupCandidate(
                    flag_key=key,
                    status_type=eval_res["status_type"],
                    since_date=eval_res["since_date"],
                    days_in_state=eval_res["days_in_state"],
                    environment_states=eval_res["environment_states"],
                    last_evaluated_at=now,
                    reviewed=False
                )
                db.add(new_cand)
        else:
            # Remove candidate if it no longer qualifies as stale
            if existing_candidate:
                db.delete(existing_candidate)

    db.commit()

    return db.query(CleanupCandidate).filter(CleanupCandidate.days_in_state >= threshold_days).all()
