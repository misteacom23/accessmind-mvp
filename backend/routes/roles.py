from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from database import get_db
from models import RoleCatalogue, EmployeeAccess, Employee, AccessGroup, User
from routes.auth import get_current_user

router = APIRouter(prefix="/roles", tags=["roles"])


def role_to_dict(r: RoleCatalogue) -> dict:
    return {
        "id": r.id,
        "role_name": r.role_name,
        "application": r.application,
        "environment": r.environment,
        "access_type": r.access_type,
        "is_privileged": r.is_privileged,
        "description": r.description,
        "owner_team": r.owner_team,
        "approval_owner": r.approval_owner,
        "requestable": r.requestable,
        "assigned_user_count": r.assigned_user_count,
        "stale_finding_count": r.stale_finding_count,
        "last_reviewed_date": r.last_reviewed_date.isoformat() if r.last_reviewed_date else None,
        "source_system": r.source_system,
        "source_type": r.source_type,
        "external_id": r.external_id,
        "sync_status": r.sync_status,
        "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/")
def list_roles(
    q: Optional[str] = Query(None),
    application: Optional[str] = Query(None),
    environment: Optional[str] = Query(None),
    access_type: Optional[str] = Query(None),
    is_privileged: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(RoleCatalogue)

    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                RoleCatalogue.role_name.ilike(search),
                RoleCatalogue.application.ilike(search),
                RoleCatalogue.description.ilike(search),
                RoleCatalogue.owner_team.ilike(search),
            )
        )

    if application:
        query = query.filter(RoleCatalogue.application == application)
    if environment:
        query = query.filter(RoleCatalogue.environment == environment)
    if access_type:
        query = query.filter(RoleCatalogue.access_type == access_type)
    if is_privileged is not None:
        query = query.filter(RoleCatalogue.is_privileged == is_privileged)

    roles = query.order_by(RoleCatalogue.application, RoleCatalogue.role_name).all()

    all_roles = db.query(RoleCatalogue).all()
    applications = sorted(set(r.application for r in all_roles))
    environments = sorted(set(r.environment for r in all_roles))
    access_types = sorted(set(r.access_type for r in all_roles))

    return {
        "roles": [role_to_dict(r) for r in roles],
        "total": len(roles),
        "filters": {
            "applications": applications,
            "environments": environments,
            "access_types": access_types,
        },
    }


@router.get("/{role_id}")
def get_role(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = db.query(RoleCatalogue).filter(RoleCatalogue.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    related = (
        db.query(RoleCatalogue)
        .filter(RoleCatalogue.application == role.application, RoleCatalogue.id != role_id)
        .limit(5)
        .all()
    )

    total_used_by = db.query(Employee).join(EmployeeAccess, EmployeeAccess.employee_id == Employee.id).join(AccessGroup, AccessGroup.id == EmployeeAccess.group_id).filter(AccessGroup.group_name == role.role_name).count()
    used_by_rows = (
        db.query(Employee)
        .join(EmployeeAccess, EmployeeAccess.employee_id == Employee.id)
        .join(AccessGroup, AccessGroup.id == EmployeeAccess.group_id)
        .filter(AccessGroup.group_name == role.role_name)
        .limit(5)
        .all()
    )

    used_by = [
        {
            "id": e.id,
            "name": e.name,
            "job_title": e.role,
            "department": e.current_team,
        }
        for e in used_by_rows
    ]

    return {
        **role_to_dict(role),
        "related_roles": [role_to_dict(r) for r in related],
        "used_by": used_by,
        "used_by_total": total_used_by,
    }
