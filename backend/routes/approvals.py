from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from routes.auth import get_current_user, require_can_approve, require_can_create
import approval_service
import audit_service

router = APIRouter(prefix="/approval-requests", tags=["Approvals"])


class CreateApprovalRequest(BaseModel):
    finding_id: int
    access_group_name: str
    approver_name: str
    performed_by: str = "Analyst"


class DecisionRequest(BaseModel):
    approver_name: str
    decision_notes: str | None = None


@router.get("/")
def list_approvals(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    approvals = approval_service.list_approvals(db)
    return {"approvals": approvals, "total": len(approvals)}


@router.get("/{approval_id}")
def get_approval(
    approval_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        return approval_service.get_approval(db, approval_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/")
def create_approval(
    req: CreateApprovalRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_can_create),
):
    try:
        result = approval_service.create_approval_request(
            db,
            finding_id=req.finding_id,
            access_group_name=req.access_group_name,
            approver_name=req.approver_name,
            performed_by=current_user.full_name,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/approve")
def approve(
    approval_id: int,
    req: DecisionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_can_approve),
):
    try:
        return approval_service.approve_request(
            db,
            approval_id=approval_id,
            approver_name=current_user.full_name,
            decision_notes=req.decision_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{approval_id}/reject")
def reject(
    approval_id: int,
    req: DecisionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_can_approve),
):
    try:
        return approval_service.reject_request(
            db,
            approval_id=approval_id,
            approver_name=current_user.full_name,
            decision_notes=req.decision_notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
