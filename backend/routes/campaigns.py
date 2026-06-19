from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from database import get_db
from models import GovernanceCampaign, CampaignReviewItem, RoleCatalogue, Employee
from campaign_service import (
    create_campaign, launch_campaign,
    process_review_decision, get_campaign_summary
)
from routes.auth import get_current_user

router = APIRouter(prefix="/governance/campaigns", tags=["campaigns"])


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _serialise_campaign(c: GovernanceCampaign) -> dict:
    now = datetime.utcnow()
    is_overdue = (
        c.due_date is not None and
        now > c.due_date and
        c.status not in ("completed", "archived")
    )
    days_remaining = None
    if c.due_date and c.status not in ("completed", "archived"):
        delta = (c.due_date - now).days
        days_remaining = max(0, delta)

    return {
        "id": c.id,
        "campaign_name": c.campaign_name,
        "campaign_type": c.campaign_type,
        "target_system": c.target_system,
        "target_access_type": c.target_access_type,
        "status": c.status,
        "created_by": c.created_by,
        "launched_at": c.launched_at.isoformat() if c.launched_at else None,
        "due_date": c.due_date.isoformat() if c.due_date else None,
        "completion_pct": c.completion_pct,
        "total_targets": c.total_targets,
        "confirmed_count": c.confirmed_count,
        "rejected_count": c.rejected_count,
        "pending_count": c.pending_count,
        "is_overdue": is_overdue,
        "days_remaining": days_remaining,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _serialise_review_item(item: CampaignReviewItem, db: Session) -> dict:
    role_name = None
    application = None
    is_privileged = False
    if item.role_id:
        role = db.query(RoleCatalogue).filter(RoleCatalogue.id == item.role_id).first()
        if role:
            role_name = role.role_name
            application = role.application
            is_privileged = role.is_privileged or False

    employee_name = None
    if item.employee_id:
        emp = db.query(Employee).filter(Employee.id == item.employee_id).first()
        if emp:
            employee_name = getattr(emp, 'name', getattr(emp, 'full_name', None))

    return {
        "id": item.id,
        "campaign_id": item.campaign_id,
        "employee_id": item.employee_id,
        "employee_name": employee_name,
        "role_id": item.role_id,
        "role_name": role_name,
        "application": application,
        "is_privileged": is_privileged,
        "assigned_to": item.assigned_to,
        "status": item.status,
        "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
        "review_notes": item.review_notes,
        "escalated_at": item.escalated_at.isoformat() if item.escalated_at else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


# ─────────────────────────────────────────────
# LIST CAMPAIGNS
# ─────────────────────────────────────────────

@router.get("")
def list_campaigns(
    status: Optional[str] = None,
    campaign_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(GovernanceCampaign)

    if status:
        query = query.filter(GovernanceCampaign.status == status)
    if campaign_type:
        query = query.filter(GovernanceCampaign.campaign_type == campaign_type)

    campaigns = query.order_by(GovernanceCampaign.created_at.desc()).all()
    return [_serialise_campaign(c) for c in campaigns]


# ─────────────────────────────────────────────
# GET SINGLE CAMPAIGN
# ─────────────────────────────────────────────

@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.id == campaign_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _serialise_campaign(c)


# ─────────────────────────────────────────────
# CREATE CAMPAIGN
# ─────────────────────────────────────────────

@router.post("")
def create_new_campaign(
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    actor = current_user.email if hasattr(current_user, "email") else "system"
    payload["created_by"] = actor

    if "campaign_name" not in payload or not payload["campaign_name"].strip():
        raise HTTPException(status_code=400, detail="campaign_name is required")
    if "campaign_type" not in payload:
        raise HTTPException(status_code=400, detail="campaign_type is required")

    campaign = create_campaign(db, payload)
    return _serialise_campaign(campaign)


# ─────────────────────────────────────────────
# LAUNCH CAMPAIGN
# ─────────────────────────────────────────────

@router.post("/{campaign_id}/launch")
def launch_existing_campaign(
    campaign_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    actor = current_user.email if hasattr(current_user, "email") else "system"
    result = launch_campaign(db, campaign_id, launched_by=actor)

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─────────────────────────────────────────────
# GET REVIEW ITEMS FOR CAMPAIGN
# ─────────────────────────────────────────────

@router.get("/{campaign_id}/items")
def get_campaign_items(
    campaign_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.id == campaign_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(CampaignReviewItem).filter(
        CampaignReviewItem.campaign_id == campaign_id
    )
    if status:
        query = query.filter(CampaignReviewItem.status == status)

    items = query.order_by(CampaignReviewItem.created_at.asc()).all()
    return [_serialise_review_item(item, db) for item in items]


# ─────────────────────────────────────────────
# PROCESS REVIEW DECISION
# ─────────────────────────────────────────────

@router.patch("/{campaign_id}/items/{item_id}")
def action_review_item(
    campaign_id: int,
    item_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    actor = current_user.email if hasattr(current_user, "email") else "system"
    decision = payload.get("decision")

    if decision not in ("confirmed", "rejected", "escalated"):
        raise HTTPException(
            status_code=400,
            detail="decision must be: confirmed | rejected | escalated"
        )

    result = process_review_decision(
        db,
        item_id=item_id,
        decision=decision,
        reviewer=actor,
        notes=payload.get("notes"),
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ─────────────────────────────────────────────
# CAMPAIGN SUMMARY STATS
# ─────────────────────────────────────────────

@router.get("/summary/campaign-overview")
def get_campaigns_overview(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    all_campaigns = db.query(GovernanceCampaign).all()
    now = datetime.utcnow()

    active = [c for c in all_campaigns if c.status == "active"]
    draft = [c for c in all_campaigns if c.status == "draft"]
    completed = [c for c in all_campaigns if c.status == "completed"]
    overdue = [
        c for c in active
        if c.due_date and now > c.due_date
    ]

    avg_completion = (
        round(sum(c.completion_pct for c in active) / len(active), 1)
        if active else 0.0
    )

    return {
        "total": len(all_campaigns),
        "active": len(active),
        "draft": len(draft),
        "completed": len(completed),
        "overdue": len(overdue),
        "avg_completion_pct": avg_completion,
        "pending_reviews": sum(c.pending_count for c in active),
    }
