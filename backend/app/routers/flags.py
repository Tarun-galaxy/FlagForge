from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_actor
from app.models.flag import Flag
from app.models.environment import Environment
from app.models.audit_log import AuditLog
from app.models.targeting_rule import TargetingRule
from app.schemas.flag import (
    FlagCreate, FlagUpdate, FlagResponse, EvaluationRequest, EvaluationResponse,
    TargetingRuleResponse, TargetingRuleSave, TargetingRulesResponse, TargetingRulesSave,
    FlagOverrideResponse, FlagOverrideSave
)
from app.core.evaluator import evaluate_flag
from app.core.redis_client import invalidate_flag_cache

router = APIRouter(prefix="/flags", tags=["flags"])



def _attach_rollout_percentage(db: Session, flag: Flag) -> Flag:
    pct_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "percentage"
    ).first()
    if pct_rule and pct_rule.rule_value is not None and str(pct_rule.rule_value).strip() != "":
        try:
            pct = int(pct_rule.rule_value)
        except ValueError:
            pct = 100 if flag.is_enabled else 0
    else:
        pct = 100 if flag.is_enabled else 0
    setattr(flag, "rollout_percentage", pct)
    return flag


@router.post("", response_model=FlagResponse, status_code=status.HTTP_201_CREATED)

def create_flag(
    flag_data: FlagCreate,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    current_actor = get_current_actor(authorization, x_actor_email)
    # 1. Check if the flag key already exists in any environment
    existing = db.query(Flag).filter(Flag.flag_key == flag_data.key).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Flag with key '{flag_data.key}' already exists."
        )

    # 2. Get all environments
    envs = db.query(Environment).all()
    if not envs:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No environments configured in the system."
        )

    target_env = flag_data.environment.lower()
    target_flag = None

    # 3. Create a flag entry for each environment to support per-env overrides
    for env in envs:
        is_target = (env.name.lower() == target_env)
        
        new_flag = Flag(
            flag_key=flag_data.key,
            name=flag_data.name,
            description=flag_data.description,
            type=flag_data.type,
            default_value=flag_data.default_value,
            owner_team=flag_data.owner_team,
            is_enabled=flag_data.is_enabled if is_target else False,
            environment_id=env.id
        )
        db.add(new_flag)
        
        if is_target:
            target_flag = new_flag

    # Write audit log
    db.add(AuditLog(
        actor=current_actor,
        action="CREATE",
        flag_key=flag_data.key,
        environment=flag_data.environment.lower(),
        details=f"Created with default: {flag_data.default_value} ({flag_data.type})",
        previous_state={},
        new_state={
            "flag_key": flag_data.key,
            "environment": flag_data.environment.lower(),
            "type": flag_data.type,
            "default_value": flag_data.default_value,
            "is_enabled": flag_data.is_enabled if is_target else False,
            "owner_team": flag_data.owner_team
        }
    ))

    db.commit()

    # If the target environment wasn't found (unlikely due to seeding but possible if user sends bad string)
    if not target_flag:
        # Fall back to returning the first created one or commit first
        # But we want to return the target flag. If the target environment name was not found,
        # let's find the development environment or the first one.
        target_flag = db.query(Flag).filter(
            Flag.flag_key == flag_data.key
        ).first()

    db.refresh(target_flag)
    return _attach_rollout_percentage(db, target_flag)


@router.get("", response_model=List[FlagResponse])
def list_flags(
    environment: str = Query("development", description="Filter by environment name"),
    db: Session = Depends(get_db)
):
    # 1. Resolve environment
    env = db.query(Environment).filter(Environment.name == environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment}' not found."
        )

    # 2. Return list of flags for that environment with rollout percentage
    flags = db.query(Flag).filter(Flag.environment_id == env.id).order_by(Flag.id).all()
    return [_attach_rollout_percentage(db, f) for f in flags]






@router.post("/analytics/flush")
def flush_analytics_endpoint(
    db: Session = Depends(get_db)
):
    """
    Flushes hourly evaluation counters from Redis into PostgreSQL/database (evaluation_analytics table).
    """
    from app.services.analytics_service import flush_redis_analytics_to_db
    return flush_redis_analytics_to_db(db)


@router.get("/{key}/metrics")
def get_flag_metrics_endpoint(
    key: str,
    timeframe: str = Query("30D", regex="^(7D|30D|90D)$"),
    db: Session = Depends(get_db)
):
    """
    Retrieves evaluation count metrics over the selected timeframe (7D, 30D, 90D).
    Includes total evaluation count, % change vs previous period, and daily breakdown for charts.
    """
    from app.services.analytics_service import get_flag_metrics
    return get_flag_metrics(db=db, flag_key=key, timeframe=timeframe)


@router.post("/{key}/clear-analytics")
@router.delete("/{key}/analytics")
def clear_flag_analytics_endpoint(
    key: str,
    db: Session = Depends(get_db)
):
    """
    Clears evaluation analytics records for the specified flag.
    """
    from app.services.analytics_service import clear_flag_analytics
    return clear_flag_analytics(db=db, flag_key=key)


@router.post("/{key}/seed-analytics")
def seed_flag_analytics_endpoint(
    key: str,
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db)
):
    """
    Generates realistic sample evaluation data for visualizing metrics charts in dev/demo.
    """
    from app.services.analytics_service import seed_flag_analytics
    return seed_flag_analytics(db=db, flag_key=key, days=days)



@router.get("/{key}", response_model=FlagResponse)
def get_flag(
    key: str,
    environment: str = Query("development", description="Environment name"),
    db: Session = Depends(get_db)
):

    # 1. Resolve environment
    env = db.query(Environment).filter(Environment.name == environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment}' not found."
        )

    # 2. Get flag
    flag = db.query(Flag).filter(Flag.flag_key == key, Flag.environment_id == env.id).first()
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found in environment '{environment}'."
        )
    return _attach_rollout_percentage(db, flag)



@router.put("/{key}", response_model=FlagResponse)
def update_flag(
    key: str,
    flag_update: FlagUpdate,
    environment: str = Query("development", description="Environment name"),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    current_actor = get_current_actor(authorization, x_actor_email)
    # 1. Resolve environment
    env = db.query(Environment).filter(Environment.name == environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment}' not found."
        )

    # 2. Get flags across all environments to update global metadata (name, description, owner_team)
    all_flags = db.query(Flag).filter(Flag.flag_key == key).all()
    if not all_flags:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found."
        )

    # Find the specific row for our target environment to apply env-specific updates
    target_flag = next((f for f in all_flags if f.environment_id == env.id), None)
    if not target_flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found in environment '{environment}'."
        )

    # Validate default value format if updating it (based on target flag type)
    if flag_update.default_value is not None:
        flag_type = target_flag.type
        v = flag_update.default_value
        if flag_type == "boolean":
            if v.lower() not in ("true", "false"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="default_value must be 'true' or 'false' for boolean flags."
                )
        elif flag_type == "number":
            try:
                float(v)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="default_value must be a valid number for number flags."
                )

    # 2. Capture previous state before applying updates
    prev_state = {
        "flag_key": key,
        "environment": environment.lower(),
        "name": target_flag.name,
        "description": target_flag.description,
        "type": target_flag.type,
        "default_value": target_flag.default_value,
        "owner_team": target_flag.owner_team,
        "is_enabled": target_flag.is_enabled,
    }

    # 3. Update global fields on ALL environment rows if provided
    for f in all_flags:
        if flag_update.name is not None:
            f.name = flag_update.name
        if flag_update.description is not None:
            f.description = flag_update.description
        if flag_update.owner_team is not None:
            f.owner_team = flag_update.owner_team

    # 4. Update environment-specific fields on the target environment row
    if flag_update.is_enabled is not None:
        target_flag.is_enabled = flag_update.is_enabled
    if flag_update.default_value is not None:
        target_flag.default_value = flag_update.default_value

    new_state = {
        "flag_key": key,
        "environment": environment.lower(),
        "name": target_flag.name,
        "description": target_flag.description,
        "type": target_flag.type,
        "default_value": target_flag.default_value,
        "owner_team": target_flag.owner_team,
        "is_enabled": target_flag.is_enabled,
    }

    # Write audit log
    details_list = []
    if flag_update.is_enabled is not None:
        details_list.append(f"status changed to {'ACTIVE' if flag_update.is_enabled else 'INACTIVE'}")
    if flag_update.default_value is not None:
        details_list.append(f"default_value set to '{flag_update.default_value}'")
    if flag_update.name is not None:
        details_list.append("name updated")
    if flag_update.description is not None:
        details_list.append("description updated")
    if flag_update.owner_team is not None:
        details_list.append("owner_team updated")
    
    details_str = ", ".join(details_list) if details_list else "no changes detected"

    action_name = "UPDATE"
    if flag_update.is_enabled is not None:
        action_name = "ENABLE" if flag_update.is_enabled else "DISABLE"

    db.add(AuditLog(
        actor=current_actor,
        action=action_name,
        flag_key=key,
        environment=environment.lower(),
        details=details_str,
        previous_state=prev_state,
        new_state=new_state
    ))

    db.commit()
    db.refresh(target_flag)
    invalidate_flag_cache(key)
    return _attach_rollout_percentage(db, target_flag)



@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flag(
    key: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    current_actor = get_current_actor(authorization, x_actor_email)
    # Find all rows representing this flag key in all environments
    flags = db.query(Flag).filter(Flag.flag_key == key).all()
    if not flags:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found."
        )
    for f in flags:
        # Cascade delete associated targeting rules first
        db.query(TargetingRule).filter(TargetingRule.flag_id == f.id).delete()
        db.delete(f)

    # Write audit log
    db.add(AuditLog(
        actor=current_actor,
        action="DELETE",
        flag_key=key,
        environment="all",
        details=f"Flag '{key}' permanently deleted from all environments",
        previous_state={"flag_key": key, "is_enabled": True},
        new_state={}
    ))

    db.commit()
    invalidate_flag_cache(key)
    return None


@router.get("/{key}/targeting", response_model=TargetingRulesResponse)
def get_targeting_rules(
    key: str,
    environment: str = Query("development", description="Environment name"),
    db: Session = Depends(get_db)
):
    # 1. Resolve environment
    env = db.query(Environment).filter(Environment.name == environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment}' not found."
        )

    # 2. Get flag
    flag = db.query(Flag).filter(Flag.flag_key == key, Flag.environment_id == env.id).first()
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found in environment '{environment}'."
        )

    # 3. Retrieve rules
    whitelist_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "whitelist"
    ).first()

    group_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "group"
    ).first()

    percentage_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "percentage"
    ).first()

    pct_val = 0
    if percentage_rule:
        try:
            pct_val = int(percentage_rule.rule_value)
        except ValueError:
            pct_val = 0

    return TargetingRulesResponse(
        whitelist=whitelist_rule.rule_value if whitelist_rule else "",
        groups=group_rule.rule_value if group_rule else "",
        percentage=pct_val
    )


@router.post("/{key}/targeting", response_model=TargetingRulesResponse)
def save_targeting_rules(
    key: str,
    payload: TargetingRulesSave,
    environment: str = Query("development", description="Environment name"),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    current_actor = get_current_actor(authorization, x_actor_email)
    # 1. Resolve environment
    env = db.query(Environment).filter(Environment.name == environment).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment '{environment}' not found."
        )

    # 2. Get flag
    flag = db.query(Flag).filter(Flag.flag_key == key, Flag.environment_id == env.id).first()
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found in environment '{environment}'."
        )

    # Fetch existing rules to record previous state BEFORE applying changes
    whitelist_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "whitelist"
    ).first()

    group_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "group"
    ).first()

    percentage_rule = db.query(TargetingRule).filter(
        TargetingRule.flag_id == flag.id,
        TargetingRule.rule_type == "percentage"
    ).first()

    old_whitelist = whitelist_rule.rule_value if whitelist_rule else ""
    old_group = group_rule.rule_value if group_rule else ""
    old_percentage = percentage_rule.rule_value if percentage_rule else "0"

    # Save whitelist rule
    if whitelist_rule:
        whitelist_rule.rule_value = payload.whitelist
    else:
        whitelist_rule = TargetingRule(
            flag_id=flag.id,
            rule_type="whitelist",
            rule_value=payload.whitelist
        )
        db.add(whitelist_rule)

    # Save group rule
    if group_rule:
        group_rule.rule_value = payload.groups
    else:
        group_rule = TargetingRule(
            flag_id=flag.id,
            rule_type="group",
            rule_value=payload.groups
        )
        db.add(group_rule)

    # Save percentage rule
    if percentage_rule:
        percentage_rule.rule_value = str(payload.percentage)
    else:
        percentage_rule = TargetingRule(
            flag_id=flag.id,
            rule_type="percentage",
            rule_value=str(payload.percentage)
        )
        db.add(percentage_rule)

    prev_state = {
        "flag_key": key,
        "environment": environment.lower(),
        "whitelist": old_whitelist,
        "groups": old_group,
        "percentage": old_percentage
    }
    new_state = {
        "flag_key": key,
        "environment": environment.lower(),
        "whitelist": payload.whitelist,
        "groups": payload.groups,
        "percentage": str(payload.percentage)
    }

    # Write audit log
    db.add(AuditLog(
        actor=current_actor,
        action="TARGETING",
        flag_key=key,
        environment=environment.lower(),
        details=f"Whitelist: '{payload.whitelist}', Groups: '{payload.groups}', Rollout: {payload.percentage}%",
        previous_state=prev_state,
        new_state=new_state
    ))

    db.commit()
    invalidate_flag_cache(key)
    return TargetingRulesResponse(
        whitelist=payload.whitelist,
        groups=payload.groups,
        percentage=payload.percentage
    )


@router.get("/{key}/overrides", response_model=List[FlagOverrideResponse])
def get_flag_overrides(
    key: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve environment-specific overrides for a flag key.
    """
    envs = db.query(Environment).order_by(Environment.id).all()
    
    # Check if flag exists
    flag_exists = db.query(Flag).filter(Flag.flag_key == key).first()
    if not flag_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found."
        )

    from app.models.flag_override import FlagOverride
    res = []
    for env in envs:
        override = db.query(FlagOverride).filter(
            FlagOverride.flag_key == key,
            FlagOverride.environment_id == env.id
        ).first()

        env_flag = db.query(Flag).filter(
            Flag.flag_key == key,
            Flag.environment_id == env.id
        ).first()
        
        default_val = env_flag.default_value if env_flag else ""

        if override:
            res.append(FlagOverrideResponse(
                environment_id=env.id,
                environment_name=env.name,
                environment_description=env.description,
                override_value=override.value,
                status="Overridden",
                updated_at=override.updated_at or override.created_at
            ))
        else:
            res.append(FlagOverrideResponse(
                environment_id=env.id,
                environment_name=env.name,
                environment_description=env.description,
                override_value=default_val,
                status="Using Default",
                updated_at=env_flag.updated_at or env_flag.created_at if env_flag else None
            ))
    return res


@router.put("/{key}/overrides/{env_id}", response_model=FlagOverrideResponse)
def save_flag_override(
    key: str,
    env_id: int,
    payload: FlagOverrideSave,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_actor_email: Optional[str] = Header(None)
):
    current_actor = get_current_actor(authorization, x_actor_email)
    """
    Create, update, or remove an environment-specific override for a flag.
    """
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment with ID {env_id} not found."
        )

    flag = db.query(Flag).filter(Flag.flag_key == key, Flag.environment_id == env_id).first()
    if not flag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flag '{key}' not found in environment '{env.name}'."
        )

    from app.models.flag_override import FlagOverride
    override = db.query(FlagOverride).filter(
        FlagOverride.flag_key == key,
        FlagOverride.environment_id == env_id
    ).first()

    if payload.active:
        prev_val = override.value if override else flag.default_value
        if override:
            override.value = payload.value
        else:
            override = FlagOverride(
                flag_key=key,
                environment_id=env_id,
                value=payload.value
            )
            db.add(override)
        
        db.add(AuditLog(
            actor=current_actor,
            action="UPDATE",
            flag_key=key,
            environment=env.name.lower(),
            details=f"Override set to '{payload.value}'",
            previous_state={"flag_key": key, "environment": env.name.lower(), "override_value": prev_val},
            new_state={"flag_key": key, "environment": env.name.lower(), "override_value": payload.value}
        ))
        db.commit()
        db.refresh(override)
        invalidate_flag_cache(key)
        
        return FlagOverrideResponse(
            environment_id=env.id,
            environment_name=env.name,
            environment_description=env.description,
            override_value=override.value,
            status="Overridden",
            updated_at=override.updated_at or override.created_at
        )
    else:
        if override:
            prev_val = override.value
            db.delete(override)
            db.add(AuditLog(
                actor=current_actor,
                action="UPDATE",
                flag_key=key,
                environment=env.name.lower(),
                details="Override removed, reverting to default",
                previous_state={"flag_key": key, "environment": env.name.lower(), "override_value": prev_val},
                new_state={"flag_key": key, "environment": env.name.lower(), "override_value": None}
            ))
            db.commit()
            invalidate_flag_cache(key)

        return FlagOverrideResponse(
            environment_id=env.id,
            environment_name=env.name,
            environment_description=env.description,
            override_value=flag.default_value,
            status="Using Default",
            updated_at=flag.updated_at or flag.created_at
        )


@router.post("/evaluate", response_model=EvaluationResponse)
def evaluate_flag_endpoint(
    payload: EvaluationRequest,
    db: Session = Depends(get_db)
):
    """
    Evaluates a feature flag in strict 5-tier priority order:
    user targeting -> group targeting -> percentage rollout -> environment override -> default value.
    """
    key = payload.flag_key or payload.key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'flag_key' or 'key' must be provided in request body."
        )

    from app.core.evaluator import evaluate_flag_detailed
    res = evaluate_flag_detailed(
        db=db,
        flag_key=key,
        environment_name=payload.environment,
        user_id=payload.user_id,
        groups=payload.groups,
        context=payload.context,
        user_context=payload.user_context
    )
    return res


