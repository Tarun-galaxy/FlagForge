from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.core.database import get_db
from app.models.user_group_membership import UserGroupMembership
from app.core.redis_client import invalidate_all_eval_cache

router = APIRouter(prefix="/groups", tags=["groups"])


class CreateGroupRequest(BaseModel):
    name: str


@router.get("", response_model=List[str])
def get_groups(db: Session = Depends(get_db)):
    # Return all unique group names
    groups = db.query(UserGroupMembership.group_name).distinct().all()
    group_names = [g[0] for g in groups if g[0]]
    
    # If list is empty, seed standard mockup groups
    if not group_names:
        default_groups = [
            "beta_users",
            "premium_plan",
            "internal_team",
            "qa_team",
            "support_team",
            "enterprise_cust",
            "india_users",
            "android_users"
        ]
        for g in default_groups:
            db.add(UserGroupMembership(user_id="system_seed", group_name=g))
        db.commit()
        group_names = default_groups

    return group_names


from app.models.audit_log import AuditLog

@router.post("", response_model=str)
def create_group(req: CreateGroupRequest, db: Session = Depends(get_db)):
    existing = db.query(UserGroupMembership).filter(UserGroupMembership.group_name == req.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Group '{req.name}' already exists."
        )
    db.add(UserGroupMembership(user_id="system_seed", group_name=req.name))
    db.add(AuditLog(actor="admin", action="group_created", details=f"User group '{req.name}' created"))
    db.commit()
    return req.name


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(name: str, db: Session = Depends(get_db)):
    db.query(UserGroupMembership).filter(UserGroupMembership.group_name == name).delete()
    db.add(AuditLog(actor="admin", action="group_deleted", details=f"User group '{name}' deleted"))
    db.commit()
    invalidate_all_eval_cache()
    return None


class BatchDeleteGroupsRequest(BaseModel):
    groups: List[str]


@router.post("/batch-delete", status_code=status.HTTP_204_NO_CONTENT)
def batch_delete_groups(req: BatchDeleteGroupsRequest, db: Session = Depends(get_db)):
    for g in req.groups:
        db.query(UserGroupMembership).filter(UserGroupMembership.group_name == g).delete()
        db.add(AuditLog(actor="admin", action="group_deleted", details=f"User group '{g}' deleted"))
    db.commit()
    invalidate_all_eval_cache()
    return None


@router.get("/{name}/members", response_model=List[str])
def get_group_members(name: str, db: Session = Depends(get_db)):
    members = db.query(UserGroupMembership.user_id).filter(
        UserGroupMembership.group_name == name,
        UserGroupMembership.user_id != "system_seed"
    ).all()
    return [m[0] for m in members if m[0]]


class AddMemberRequest(BaseModel):
    user_id: str


@router.post("/{name}/members", response_model=str)
def add_group_member(name: str, req: AddMemberRequest, db: Session = Depends(get_db)):
    existing = db.query(UserGroupMembership).filter(
        UserGroupMembership.group_name == name,
        UserGroupMembership.user_id == req.user_id
    ).first()
    if existing:
        return req.user_id
    
    db.add(UserGroupMembership(user_id=req.user_id, group_name=name))
    db.add(AuditLog(actor="admin", action="group_member_added", details=f"User '{req.user_id}' added to group '{name}'"))
    db.commit()
    invalidate_all_eval_cache()
    return req.user_id


@router.delete("/{name}/members/{user_id}", response_model=str)
def remove_group_member(name: str, user_id: str, db: Session = Depends(get_db)):
    db.query(UserGroupMembership).filter(
        UserGroupMembership.group_name == name,
        UserGroupMembership.user_id == user_id
    ).delete()
    db.add(AuditLog(actor="admin", action="group_member_removed", details=f"User '{user_id}' removed from group '{name}'"))
    db.commit()
    invalidate_all_eval_cache()
    return user_id
