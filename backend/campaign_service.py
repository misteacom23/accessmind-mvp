from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from models import (
    GovernanceCampaign, CampaignReviewItem,
    RoleCatalogue, Employee, GovernanceWorkflow,
    WorkflowTimelineEvent
)
from sla_service import _log_timeline

# ─────────────────────────────────────────────
# CAMPAIGN TYPES
# ─────────────────────────────────────────────

CAMPAIGN_TYPES = {
    "privileged_review": "Privileged Access Review",
    "stale_access_review": "Stale Access Review",
    "recertification": "Access Recertification",
    "hygiene_campaign": "Governance Hygiene Campaign",
}

CAMPAIGN_DUE_DAYS = {
    "privileged_review": 14,
    "stale_access_review": 21,
    "recertification": 30,
    "hygiene_campaign": 14,
}


# ─────────────────────────────────────────────
# CREATE CAMPAIGN
# ─────────────────────────────────────────────

def create_campaign(db: Session, payload: dict) -> GovernanceCampaign:
    now = datetime.utcnow()
    due_days = CAMPAIGN_DUE_DAYS.get(payload.get("campaign_type", "recertification"), 21)

    campaign = GovernanceCampaign(
        campaign_name=payload["campaign_name"],
        campaign_type=payload.get("campaign_type", "recertification"),
        target_system=payload.get("target_system"),
        target_access_type=payload.get("target_access_type"),
        status="draft",
        created_by=payload.get("created_by", "system"),
        due_date=now + timedelta(days=due_days),
        completion_pct=0.0,
        total_targets=0,
        confirmed_count=0,
        rejected_count=0,
        pending_count=0,
        created_at=now,
        updated_at=now,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


# ─────────────────────────────────────────────
# LAUNCH CAMPAIGN — generates review items
# ─────────────────────────────────────────────

def launch_campaign(db: Session, campaign_id: int, launched_by: str) -> dict:
    campaign = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.id == campaign_id
    ).first()

    if not campaign:
        return {"error": "Campaign not found"}
    if campaign.status != "draft":
        return {"error": f"Campaign is already {campaign.status}"}

    # Build target role query
    role_query = db.query(RoleCatalogue)

    if campaign.campaign_type == "privileged_review":
        role_query = role_query.filter(RoleCatalogue.is_privileged == True)
    elif campaign.campaign_type == "stale_access_review":
        role_query = role_query.filter(RoleCatalogue.stale_finding_count > 0)

    if campaign.target_system:
        role_query = role_query.filter(
            RoleCatalogue.application == campaign.target_system
        )

    target_roles = role_query.limit(50).all()

    if not target_roles:
        return {"error": "No target roles found for this campaign configuration"}

    # Get employees to assign reviews to
    employees = db.query(Employee).limit(20).all()
    employee_map = {e.id: e for e in employees}

    items_created = 0
    now = datetime.utcnow()

    for role in target_roles:
        # Assign to governance owner or fall back to first employee
        assigned_to = role.approval_owner or (employees[0].full_name if employees else "Unassigned")

        item = CampaignReviewItem(
            campaign_id=campaign.id,
            employee_id=employees[items_created % len(employees)].id if employees else None,
            role_id=role.id,
            assigned_to=assigned_to,
            status="pending",
            created_at=now,
        )
        db.add(item)
        items_created += 1

    campaign.status = "active"
    campaign.launched_at = now
    campaign.updated_at = now
    campaign.total_targets = items_created
    campaign.pending_count = items_created
    campaign.confirmed_count = 0
    campaign.rejected_count = 0
    campaign.completion_pct = 0.0

    db.commit()
    db.refresh(campaign)

    return {
        "campaign_id": campaign.id,
        "status": "active",
        "items_created": items_created,
        "launched_at": now.isoformat(),
    }


# ─────────────────────────────────────────────
# PROCESS REVIEW ITEM DECISION
# ─────────────────────────────────────────────

def process_review_decision(
    db: Session,
    item_id: int,
    decision: str,
    reviewer: str,
    notes: str = None
) -> dict:
    """
    decision: "confirmed" | "rejected" | "escalated"
    """
    item = db.query(CampaignReviewItem).filter(
        CampaignReviewItem.id == item_id
    ).first()

    if not item:
        return {"error": "Review item not found"}
    if item.status != "pending":
        return {"error": f"Item already actioned: {item.status}"}

    now = datetime.utcnow()
    item.status = decision
    item.reviewed_at = now
    item.review_notes = notes

    if decision == "escalated":
        item.escalated_at = now

    db.flush()

    # Recalculate campaign completion
    _recalculate_campaign(db, item.campaign_id)
    db.commit()

    return {
        "item_id": item_id,
        "status": decision,
        "reviewed_at": now.isoformat(),
    }


# ─────────────────────────────────────────────
# RECALCULATE CAMPAIGN STATS
# ─────────────────────────────────────────────

def _recalculate_campaign(db: Session, campaign_id: int):
    campaign = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.id == campaign_id
    ).first()
    if not campaign:
        return

    items = db.query(CampaignReviewItem).filter(
        CampaignReviewItem.campaign_id == campaign_id
    ).all()

    total = len(items)
    confirmed = sum(1 for i in items if i.status == "confirmed")
    rejected = sum(1 for i in items if i.status == "rejected")
    escalated = sum(1 for i in items if i.status == "escalated")
    pending = sum(1 for i in items if i.status == "pending")

    actioned = confirmed + rejected + escalated
    completion_pct = round((actioned / total) * 100, 1) if total > 0 else 0.0

    campaign.confirmed_count = confirmed
    campaign.rejected_count = rejected
    campaign.pending_count = pending
    campaign.total_targets = total
    campaign.completion_pct = completion_pct
    campaign.updated_at = datetime.utcnow()

    # Auto-complete if all items actioned
    if pending == 0 and total > 0:
        campaign.status = "completed"


# ─────────────────────────────────────────────
# GET CAMPAIGN SUMMARY
# ─────────────────────────────────────────────

def get_campaign_summary(db: Session, campaign_id: int) -> dict:
    campaign = db.query(GovernanceCampaign).filter(
        GovernanceCampaign.id == campaign_id
    ).first()
    if not campaign:
        return {"error": "Not found"}

    items = db.query(CampaignReviewItem).filter(
        CampaignReviewItem.campaign_id == campaign_id
    ).all()

    overdue_items = [
        i for i in items
        if i.status == "pending" and campaign.due_date and datetime.utcnow() > campaign.due_date
    ]

    return {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "campaign_type": campaign.campaign_type,
        "status": campaign.status,
        "target_system": campaign.target_system,
        "completion_pct": campaign.completion_pct,
        "total_targets": campaign.total_targets,
        "confirmed_count": campaign.confirmed_count,
        "rejected_count": campaign.rejected_count,
        "pending_count": campaign.pending_count,
        "overdue_count": len(overdue_items),
        "due_date": campaign.due_date.isoformat() if campaign.due_date else None,
        "launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None,
        "created_by": campaign.created_by,
    }


# ─────────────────────────────────────────────
# SEED DEMO CAMPAIGNS (called from main.py)
# ─────────────────────────────────────────────

def seed_demo_campaigns(db: Session):
    existing = db.query(GovernanceCampaign).first()
    if existing:
        return

    now = datetime.utcnow()

    demo_campaigns = [
        {
            "campaign_name": "Q2 Privileged Access Review",
            "campaign_type": "privileged_review",
            "target_system": None,
            "target_access_type": "privileged",
            "status": "active",
            "created_by": "admin@accessmind.local",
            "launched_at": now - timedelta(days=5),
            "due_date": now + timedelta(days=9),
            "total_targets": 18,
            "confirmed_count": 7,
            "rejected_count": 2,
            "pending_count": 9,
            "completion_pct": 50.0,
        },
        {
            "campaign_name": "Finance Access Recertification",
            "campaign_type": "recertification",
            "target_system": "SAP ERP",
            "target_access_type": None,
            "status": "active",
            "created_by": "manager@accessmind.local",
            "launched_at": now - timedelta(days=12),
            "due_date": now + timedelta(days=3),
            "total_targets": 24,
            "confirmed_count": 16,
            "rejected_count": 3,
            "pending_count": 5,
            "completion_pct": 79.2,
        },
        {
            "campaign_name": "Cloud Engineering Admin Review",
            "campaign_type": "privileged_review",
            "target_system": "AWS",
            "target_access_type": "admin",
            "status": "active",
            "created_by": "admin@accessmind.local",
            "launched_at": now - timedelta(days=20),
            "due_date": now - timedelta(days=6),
            "total_targets": 12,
            "confirmed_count": 4,
            "rejected_count": 1,
            "pending_count": 7,
            "completion_pct": 41.7,
        },
        {
            "campaign_name": "Stale Identity Hygiene Campaign",
            "campaign_type": "hygiene_campaign",
            "target_system": None,
            "target_access_type": None,
            "status": "draft",
            "created_by": "analyst@accessmind.local",
            "launched_at": None,
            "due_date": now + timedelta(days=21),
            "total_targets": 0,
            "confirmed_count": 0,
            "rejected_count": 0,
            "pending_count": 0,
            "completion_pct": 0.0,
        },
        {
            "campaign_name": "Annual Privileged Access Certification",
            "campaign_type": "recertification",
            "target_system": None,
            "target_access_type": "privileged",
            "status": "completed",
            "created_by": "admin@accessmind.local",
            "launched_at": now - timedelta(days=45),
            "due_date": now - timedelta(days=15),
            "total_targets": 31,
            "confirmed_count": 22,
            "rejected_count": 9,
            "pending_count": 0,
            "completion_pct": 100.0,
        },
    ]

    for c in demo_campaigns:
        campaign = GovernanceCampaign(
            campaign_name=c["campaign_name"],
            campaign_type=c["campaign_type"],
            target_system=c["target_system"],
            target_access_type=c["target_access_type"],
            status=c["status"],
            created_by=c["created_by"],
            launched_at=c["launched_at"],
            due_date=c["due_date"],
            total_targets=c["total_targets"],
            confirmed_count=c["confirmed_count"],
            rejected_count=c["rejected_count"],
            pending_count=c["pending_count"],
            completion_pct=c["completion_pct"],
            created_at=now,
            updated_at=now,
        )
        db.add(campaign)

    db.commit()
