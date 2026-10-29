import hashlib
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.flag import Flag
from app.models.environment import Environment
from app.models.targeting_rule import TargetingRule
from app.models.flag_override import FlagOverride
from app.models.user_group_membership import UserGroupMembership
from app.core.redis_client import get_cached_evaluation, set_cached_evaluation, record_evaluation_count


def calculate_user_bucket(user_id: str, flag_key: str) -> int:
    """
    Computes a deterministic integer bucket from 0 to 99 for a user_id and flag_key.
    Uses MD5 hashing to ensure uniform distribution and consistency.
    """
    raw_key = f"{user_id}:{flag_key}"
    hash_hex = hashlib.md5(raw_key.encode('utf-8')).hexdigest()
    hash_int = int(hash_hex, 16)
    return hash_int % 100


def evaluate_flag_detailed(
    db: Session,
    flag_key: str,
    environment_name: str,
    user_id: Optional[str] = None,
    groups: Optional[Any] = None,
    context: Optional[Dict[str, Any]] = None,
    user_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Evaluates a feature flag in strict 5-tier priority order:
    1. User Targeting (Whitelist) -> USER_WHITELIST
    2. Group Targeting -> GROUP_TARGETING
    3. Percentage Rollout -> PERCENTAGE_ROLLOUT
    4. Environment Override -> ENV_OVERRIDE
    5. Default Value -> DEFAULT_VALUE
    """
    # Track evaluation analytics count (Redis hourly counter)
    try:
        record_evaluation_count(flag_key)
    except Exception:
        pass

    start_time = time.perf_counter()
    ctx = context or user_context or {}
    uid = user_id or ctx.get("userId") or ctx.get("user_id") or ctx.get("id")

    # 1. Check Redis Cache First (Sub-millisecond)
    cached_result = get_cached_evaluation(flag_key, environment_name, uid, groups, ctx)
    if cached_result is not None:
        elapsed = (time.perf_counter() - start_time) * 1000.0
        cached_result["latency_ms"] = round(elapsed, 2)
        cached_result["cached"] = True
        cached_result["served_from_cache"] = True
        return cached_result


    req_groups = []
    if groups:
        if isinstance(groups, list):
            req_groups = [str(g).strip() for g in groups if str(g).strip()]
        elif isinstance(groups, str):
            req_groups = [g.strip() for g in groups.split(",") if g.strip()]
    elif ctx.get("groups"):
        g_ctx = ctx.get("groups")
        if isinstance(g_ctx, list):
            req_groups = [str(g).strip() for g in g_ctx if str(g).strip()]
        elif isinstance(g_ctx, str):
            req_groups = [g.strip() for g in g_ctx.split(",") if g.strip()]

    if uid:
        db_user_groups = db.query(UserGroupMembership.group_name).filter(
            UserGroupMembership.user_id == str(uid)
        ).all()
        for ug in db_user_groups:
            if ug[0] and ug[0] not in req_groups:
                req_groups.append(ug[0])

    env = db.query(Environment).filter(
        Environment.name.ilike(environment_name)
    ).first()
    
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment_name}' not found."
        )

    flag = db.query(Flag).filter(
        Flag.flag_key == flag_key,
        Flag.environment_id == env.id
    ).first()

    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{flag_key}' not found in environment '{environment_name}'."
        )

    flag_type = flag.type
    val_str = str(flag.default_value).strip() if flag.default_value is not None else "false"

    if flag_type == "boolean":
        typed_default = val_str.lower() in ("true", "1", "t", "y", "yes")
    elif flag_type == "number":
        try:
            typed_default = float(val_str) if "." in val_str else int(val_str)
        except ValueError:
            typed_default = 0
    else:
        typed_default = val_str

    priority_steps = [
        {"priority": 1, "step": 1, "name": "User Targeting", "status": "Skipped", "detail": "User whitelist check"},
        {"priority": 2, "step": 2, "name": "Group Targeting", "status": "Skipped", "detail": "Group membership check"},
        {"priority": 3, "step": 3, "name": "% Rollout", "status": "Skipped", "detail": "Percentage rollout check"},
        {"priority": 4, "step": 4, "name": "Env Override", "status": "Skipped", "detail": "Environment override check"},
        {"priority": 5, "step": 5, "name": "Default Value", "status": "Skipped", "detail": "Flag default fallback"},
    ]

    now = datetime.now(timezone.utc)
    evaluated_at_formatted = now.strftime("%d %b %Y, %I:%M:%S %p")
    summary = {
        "flag_key": flag_key,
        "environment": env.name.capitalize(),
        "user_id": uid or "N/A",
        "groups": req_groups
    }

    def _finalize_result(res: Dict[str, Any]) -> Dict[str, Any]:
        elapsed = (time.perf_counter() - start_time) * 1000.0
        res["latency_ms"] = round(elapsed, 2)
        res["cached"] = False
        res["served_from_cache"] = False
        set_cached_evaluation(flag_key, environment_name, uid, groups, ctx, res)
        return res

    if not flag.is_enabled:
        disabled_val = False if flag_type == "boolean" else typed_default
        priority_steps[4]["status"] = "Matched"
        return _finalize_result({
            "flag_key": flag_key,
            "key": flag_key,
            "value": disabled_val,
            "type": flag_type,
            "environment": env.name.capitalize(),
            "is_enabled": False,
            "reason": "DEFAULT_VALUE",
            "matched_rule": "DEFAULT_VALUE",
            "rule_detail": "Flag is disabled in environment; using default fallback.",
            "details": "Flag is disabled in environment; using default fallback.",
            "priority_steps": priority_steps,
            "priority_checks": priority_steps,
            "evaluated_at": evaluated_at_formatted,
            "request_summary": summary
        })

    # ----------------------------------------------------
    # TIER 1: User Targeting (Whitelist)
    # ----------------------------------------------------
    whitelist_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "whitelist"
    ).first()

    if whitelist_rule and whitelist_rule.rule_value:
        whitelisted_ids = [u.strip() for u in whitelist_rule.rule_value.split(",") if u.strip()]
        if uid and str(uid) in whitelisted_ids:
            priority_steps[0]["status"] = "Matched"
            resolved_value = True if flag_type == "boolean" else typed_default
            rule_detail = f"User '{uid}' is in flag user whitelist"
            return _finalize_result({
                "flag_key": flag_key,
                "key": flag_key,
                "value": resolved_value,
                "type": flag_type,
                "environment": env.name.capitalize(),
                "is_enabled": flag.is_enabled,
                "reason": "USER_WHITELIST",
                "matched_rule": "USER_WHITELIST",
                "rule_detail": rule_detail,
                "details": rule_detail,
                "priority_steps": priority_steps,
                "priority_checks": priority_steps,
                "evaluated_at": evaluated_at_formatted,
                "request_summary": summary
            })
        else:
            priority_steps[0]["status"] = "No match"
    else:
        priority_steps[0]["status"] = "No match"

    # ----------------------------------------------------
    # TIER 2: Group Targeting
    # ----------------------------------------------------
    group_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "group"
    ).first()

    if group_rule and group_rule.rule_value:
        targeted_groups = [g.strip() for g in group_rule.rule_value.split(",") if g.strip()]
        matching_groups = [g for g in req_groups if g in targeted_groups]
        if matching_groups:
            priority_steps[1]["status"] = "Matched"
            resolved_value = True if flag_type == "boolean" else typed_default
            rule_detail = f"User is in group \"{matching_groups[0]}\""
            return _finalize_result({
                "flag_key": flag_key,
                "key": flag_key,
                "value": resolved_value,
                "type": flag_type,
                "environment": env.name.capitalize(),
                "is_enabled": flag.is_enabled,
                "reason": "GROUP_TARGETING",
                "matched_rule": "GROUP_TARGETING",
                "rule_detail": rule_detail,
                "details": rule_detail,
                "priority_steps": priority_steps,
                "priority_checks": priority_steps,
                "evaluated_at": evaluated_at_formatted,
                "request_summary": summary
            })
        else:
            priority_steps[1]["status"] = "No match"
    else:
        priority_steps[1]["status"] = "No match"

    # ----------------------------------------------------
    # TIER 3: Percentage Rollout
    # ----------------------------------------------------
    pct_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "percentage"
    ).first()

    if pct_rule and pct_rule.rule_value:
        try:
            pct_val = int(pct_rule.rule_value)
        except ValueError:
            pct_val = 0

        if pct_val > 0 and uid:
            user_bucket = calculate_user_bucket(str(uid), flag_key)
            if user_bucket < pct_val:
                priority_steps[2]["status"] = "Matched"
                resolved_value = True if flag_type == "boolean" else typed_default
                rule_detail = f"User hash bucket {user_bucket} <= {pct_val}% rollout threshold"
                return _finalize_result({
                    "flag_key": flag_key,
                    "key": flag_key,
                    "value": resolved_value,
                    "type": flag_type,
                    "environment": env.name.capitalize(),
                    "is_enabled": flag.is_enabled,
                    "reason": "PERCENTAGE_ROLLOUT",
                    "matched_rule": "PERCENTAGE_ROLLOUT",
                    "rule_detail": rule_detail,
                    "details": rule_detail,
                    "priority_steps": priority_steps,
                    "priority_checks": priority_steps,
                    "evaluated_at": evaluated_at_formatted,
                    "request_summary": summary
                })
            else:
                priority_steps[2]["status"] = "No match"
        else:
            priority_steps[2]["status"] = "No match"
    else:
        priority_steps[2]["status"] = "No match"

    # ----------------------------------------------------
    # TIER 4: Environment Override
    # ----------------------------------------------------
    override = db.query(FlagOverride).filter(
        FlagOverride.flag_key == flag_key,
        FlagOverride.environment_id == env.id
    ).first()

    if override:
        priority_steps[3]["status"] = "Matched"
        if flag_type == "boolean":
            resolved_value = override.value.lower() in ("true", "1", "t", "y", "yes", "on")
        elif flag_type == "number":
            try:
                resolved_value = float(override.value) if "." in override.value else int(override.value)
            except ValueError:
                resolved_value = 0
        else:
            resolved_value = override.value

        rule_detail = f"Environment override active: '{override.value}'"
        return _finalize_result({
            "flag_key": flag_key,
            "key": flag_key,
            "value": resolved_value,
            "type": flag_type,
            "environment": env.name.capitalize(),
            "is_enabled": flag.is_enabled,
            "reason": "ENV_OVERRIDE",
            "matched_rule": "ENV_OVERRIDE",
            "rule_detail": rule_detail,
            "details": rule_detail,
            "priority_steps": priority_steps,
            "priority_checks": priority_steps,
            "evaluated_at": evaluated_at_formatted,
            "request_summary": summary
        })
    else:
        priority_steps[3]["status"] = "No match"

    # ----------------------------------------------------
    # TIER 5: Default Value Fallback
    # ----------------------------------------------------
    priority_steps[4]["status"] = "Matched"
    rule_detail = f"No prior targeting rules matched. Returning flag's default value '{typed_default}'."
    return _finalize_result({
        "flag_key": flag_key,
        "key": flag_key,
        "value": typed_default,
        "type": flag_type,
        "environment": env.name.capitalize(),
        "is_enabled": flag.is_enabled,
        "reason": "DEFAULT_VALUE",
        "matched_rule": "DEFAULT_VALUE",
        "rule_detail": rule_detail,
        "details": rule_detail,
        "priority_steps": priority_steps,
        "priority_checks": priority_steps,
        "evaluated_at": evaluated_at_formatted,
        "request_summary": summary
    })


def evaluate_flag(
    db: Session,
    flag_key: str,
    environment_name: str,
    user_context: Optional[Dict[str, Any]] = None
) -> Any:
    """
    Simplified evaluator returning just the raw resolved value for backwards compatibility.
    """
    res = evaluate_flag_detailed(
        db=db,
        flag_key=flag_key,
        environment_name=environment_name,
        user_context=user_context
    )
    return res["value"]
