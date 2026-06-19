from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from database import get_db
from routes.auth import get_current_user, require_can_create
import exception_service

router = APIRouter(prefix="/exceptions", tags=["Exceptions"])


class CreateExceptionRequest(BaseModel):
    finding_id: int
    access_group_name: str
    business_justification: str
    approved_by: str
    expiry_date: date


class RevokeRequest(BaseModel):
    revoked_by: str


@router.get("/")
def list_exceptions(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exceptions = exception_service.list_exceptions(db)
    return {"exceptions": exceptions, "total": len(exceptions)}


@router.get("/finding/{finding_id}")
def get_exceptions_for_finding(
    finding_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    exceptions = exception_service.get_exceptions_for_finding(db, finding_id)
    return {"exceptions": exceptions, "finding_id": finding_id}


@router.post("/")
def create_exception(
    req: CreateExceptionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_can_create),
):
    try:
        return exception_service.create_exception(
            db,
            finding_id=req.finding_id,
            access_group_name=req.access_group_name,
            business_justification=req.business_justification,
            approved_by=current_user.full_name,
            expiry_date=req.expiry_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{exception_id}/revoke")
def revoke_exception(
    exception_id: int,
    req: RevokeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_can_create),
):
    try:
        return exception_service.revoke_exception(
            db, exception_id, current_user.full_name
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
