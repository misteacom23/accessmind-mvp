import random
import string
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from audit_service import log as audit_log
from database import get_db
from models import Finding, RemediationAction
from routes.auth import get_current_user

router = APIRouter(prefix="/remediation", tags=["remediation"])


class RemediationCreate(BaseModel):
    finding_id: int
    action_type: str
    target_platform: str
    connector_id: Optional[int] = None
    notes: Optional[str] = None


def _make_ref(platform: str) -> str:
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"{platform.upper()}-{suffix}"


@router.post("/")
def create_remediation_action(
    payload: RemediationCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    finding = db.query(Finding).filter(Finding.id == payload.finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    external_ref = _make_ref(payload.target_platform)

    action = RemediationAction(
        finding_id=payload.finding_id,
        action_type=payload.action_type,
        target_platform=payload.target_platform,
        connector_id=payload.connector_id,
        status="sent",
        external_reference=external_ref,
        performed_by=current_user.full_name,
        notes=payload.notes,
    )
    db.add(action)

    if finding.status == "open":
        finding.status = "Under Review"

    db.commit()
    db.refresh(action)

    audit_log(
        db,
        action_type="REMEDIATION_LAUNCHED",
        performed_by=current_user.full_name,
        target_type="finding",
        target_id=payload.finding_id,
        details=f"Remediation routed to {payload.target_platform} — ref: {external_ref}",
    )

    return {
        "id": action.id,
        "finding_id": action.finding_id,
        "action_type": action.action_type,
        "target_platform": action.target_platform,
        "status": action.status,
        "external_reference": action.external_reference,
        "performed_by": action.performed_by,
        "notes": action.notes,
        "created_at": action.created_at.isoformat(),
    }


@router.get("/{finding_id}")
def get_remediation_actions(
    finding_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    actions = (
        db.query(RemediationAction)
        .filter(RemediationAction.finding_id == finding_id)
        .order_by(RemediationAction.created_at.desc())
        .all()
    )
    return [
        {
            "id": a.id,
            "finding_id": a.finding_id,
            "action_type": a.action_type,
            "target_platform": a.target_platform,
            "status": a.status,
            "external_reference": a.external_reference,
            "performed_by": a.performed_by,
            "notes": a.notes,
            "created_at": a.created_at.isoformat(),
        }
        for a in actions
    ]
