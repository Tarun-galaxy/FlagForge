from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.environment import Environment
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/environments", tags=["environments"])


class EnvironmentSchema(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EnvironmentCreate(BaseModel):
    name: str = Field(..., max_length=50)
    description: Optional[str] = Field(None, max_length=250)


class EnvironmentUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=250)


@router.get("", response_model=List[EnvironmentSchema])
def list_environments(db: Session = Depends(get_db)):
    """
    List all configured environments in the database.
    """
    return db.query(Environment).order_by(Environment.id).all()


@router.post("", response_model=EnvironmentSchema, status_code=status.HTTP_201_CREATED)
def create_environment(env_data: EnvironmentCreate, db: Session = Depends(get_db)):
    """
    Register a new environment and populate default flag structures.
    """
    name_lower = env_data.name.strip().lower()
    existing = db.query(Environment).filter(Environment.name == name_lower).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Environment '{env_data.name}' already exists."
        )
    
    new_env = Environment(name=name_lower, description=env_data.description)
    db.add(new_env)
    db.commit()
    db.refresh(new_env)

    # Populate existing flags for the new environment to maintain sync
    from app.models.flag import Flag
    unique_flag_keys = db.query(Flag.flag_key).distinct().all()
    for row in unique_flag_keys:
        flag_key = row[0]
        template = db.query(Flag).filter(Flag.flag_key == flag_key).first()
        if template:
            new_flag = Flag(
                flag_key=template.flag_key,
                name=template.name,
                description=template.description,
                type=template.type,
                default_value=template.default_value,
                owner_team=template.owner_team,
                is_enabled=False,
                environment_id=new_env.id
            )
            db.add(new_flag)

    # Write audit log
    from app.models.audit_log import AuditLog
    db.add(AuditLog(
        actor="admin",
        action="environment_created",
        details=f"Environment '{new_env.name}' created with description: '{new_env.description}'"
    ))
    db.commit()
    db.refresh(new_env)
    return new_env


@router.get("/{id}", response_model=EnvironmentSchema)
def get_environment(id: int, db: Session = Depends(get_db)):
    """
    Retrieve metadata details for a specific environment.
    """
    env = db.query(Environment).filter(Environment.id == id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment with ID {id} not found."
        )
    return env


@router.put("/{id}", response_model=EnvironmentSchema)
def update_environment(id: int, payload: EnvironmentUpdate, db: Session = Depends(get_db)):
    """
    Update configuration name or description details for an environment.
    """
    env = db.query(Environment).filter(Environment.id == id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment with ID {id} not found."
        )

    if payload.name:
        name_lower = payload.name.strip().lower()
        conflict = db.query(Environment).filter(Environment.name == name_lower, Environment.id != id).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Environment '{payload.name}' already exists."
            )
        env.name = name_lower

    if payload.description is not None:
        env.description = payload.description.strip() or None

    # Write audit log
    from app.models.audit_log import AuditLog
    db.add(AuditLog(
        actor="admin",
        action="environment_updated",
        details=f"Environment '{env.name}' updated. Description: '{env.description}'"
    ))
    db.commit()
    db.refresh(env)
    return env


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(id: int, db: Session = Depends(get_db)):
    """
    Delete an environment, cascading to its flags, targeting rules, and overrides.
    """
    env = db.query(Environment).filter(Environment.id == id).first()
    if not env:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Environment with ID {id} not found."
        )

    from app.models.flag import Flag
    from app.models.flag_override import FlagOverride
    from app.models.targeting_rule import TargetingRule
    from app.models.audit_log import AuditLog

    # 1. Delete overrides
    db.query(FlagOverride).filter(FlagOverride.environment_id == id).delete()

    # 2. Delete flags and targeting rules associated with this environment
    flags_to_delete = db.query(Flag.id).filter(Flag.environment_id == id).all()
    flag_ids = [f[0] for f in flags_to_delete]

    if flag_ids:
        db.query(TargetingRule).filter(TargetingRule.flag_id.in_(flag_ids)).delete(synchronize_session=False)
        db.query(Flag).filter(Flag.id.in_(flag_ids)).delete(synchronize_session=False)

    db.delete(env)

    # Write audit log
    db.add(AuditLog(
        actor="admin",
        action="environment_deleted",
        details=f"Environment '{env.name}' deleted"
    ))
    db.commit()
    return None
