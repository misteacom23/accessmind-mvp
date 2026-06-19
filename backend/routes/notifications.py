"""
routes/notifications.py — Phase 4D
In-app governance notification endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from database import get_db
from models import GovernanceNotification
from routes.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n: GovernanceNotification) -> dict:
    return {
        "id":                  n.id,
        "notification_type":   n.notification_type,
        "title":               n.title,
        "body":                n.body,
        "severity":            n.severity,
        "target_user_role":    n.target_user_role,
        "is_read":             n.is_read,
        "is_dismissed":        n.is_dismissed,
        "related_workflow_id": n.related_workflow_id,
        "related_campaign_id": n.related_campaign_id,
        "created_at":          n.created_at.isoformat() if n.created_at else None,
        "read_at":             n.read_at.isoformat() if n.read_at else None,
    }


# ── GET /notifications
# Returns active (non-dismissed) notifications visible to the current user's role.
# Query params:
#   unread_only (bool, default False) — filter to is_read=False only
#   limit (int, default 20)
@router.get("")
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(GovernanceNotification).filter(
        GovernanceNotification.is_dismissed == False
    )

    # Role filtering: show notifications targeted at this role OR targeted at nobody (all roles)
    user_role = current_user.role
    q = q.filter(
        (GovernanceNotification.target_user_role == None) |
        (GovernanceNotification.target_user_role == user_role)
    )

    if unread_only:
        q = q.filter(GovernanceNotification.is_read == False)

    notifications = (
        q.order_by(GovernanceNotification.created_at.desc())
        .limit(limit)
        .all()
    )

    unread_count = (
        db.query(GovernanceNotification)
        .filter(
            GovernanceNotification.is_dismissed == False,
            GovernanceNotification.is_read == False,
            (GovernanceNotification.target_user_role == None) |
            (GovernanceNotification.target_user_role == user_role),
        )
        .count()
    )

    return {
        "notifications": [_serialize(n) for n in notifications],
        "unread_count":  unread_count,
    }


# ── PATCH /notifications/{id}/read
# Marks a single notification as read.
@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    n = db.query(GovernanceNotification).filter(
        GovernanceNotification.id == notification_id
    ).first()
    if not n:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")

    n.is_read = True
    n.read_at = datetime.utcnow()
    db.commit()
    return _serialize(n)


# ── POST /notifications/dismiss-all
# Dismisses all notifications visible to the current user.
@router.post("/dismiss-all")
def dismiss_all(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_role = current_user.role
    q = db.query(GovernanceNotification).filter(
        GovernanceNotification.is_dismissed == False,
        (GovernanceNotification.target_user_role == None) |
        (GovernanceNotification.target_user_role == user_role),
    )
    count = q.count()
    q.update({"is_dismissed": True}, synchronize_session=False)
    db.commit()
    return {"dismissed": count}


# ── POST /notifications/seed-demo
# Seeds realistic demo notifications. Idempotent — skips if already seeded.
@router.post("/seed-demo")
def seed_demo_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = db.query(GovernanceNotification).first()
    if existing:
        return {"seeded": 0, "message": "already seeded"}

    from datetime import timedelta
    now = datetime.utcnow()

    demo = [
        GovernanceNotification(
            notification_type="sla_breach",
            title="SLA Breached — AWS Unused Privileged Roles",
            body="Workflow SAIL-AW9KP2XQ has exceeded its 7-day critical SLA. Escalation level raised to 2. Immediate governance action required.",
            severity="critical",
            target_user_role=None,
            created_at=now - timedelta(hours=2),
        ),
        GovernanceNotification(
            notification_type="escalation",
            title="Escalation — Marcus Johnson Stale Access",
            body="Stale access workflow for Marcus Johnson (Active Directory) escalated to director level after 14-day SLA breach. Routed to Entra ID governance queue.",
            severity="critical",
            target_user_role="manager",
            created_at=now - timedelta(hours=5),
        ),
        GovernanceNotification(
            notification_type="package_issue",
            title="Orphaned Package Detected — Legacy-Reporting-Package",
            body="Legacy-Reporting-Package has no governance owner and no active roles. Package has been flagged as orphaned. Governance review required.",
            severity="warning",
            target_user_role=None,
            created_at=now - timedelta(hours=8),
        ),
        GovernanceNotification(
            notification_type="workflow_created",
            title="Auto-Trigger — 3 New Governance Workflows Created",
            body="AccessMind auto-triggered 3 governance workflows from high-risk hygiene clusters detected during the latest scan. Review in Governance Workflows.",
            severity="info",
            target_user_role=None,
            created_at=now - timedelta(hours=12),
        ),
        GovernanceNotification(
            notification_type="campaign_overdue",
            title="Campaign Overdue — Cloud Engineering Admin Review",
            body="Cloud Engineering Admin Review campaign is 4 days past its due date with 58% of items still pending. Escalation recommended.",
            severity="warning",
            target_user_role="manager",
            created_at=now - timedelta(days=1),
        ),
        GovernanceNotification(
            notification_type="sla_breach",
            title="SLA Due Soon — CyberArk PAM Stale Review",
            body="CyberArk PAM governance workflow CYARK-PM6VB4WS is due within 48 hours. 3 privileged accounts pending recertification decision.",
            severity="warning",
            target_user_role=None,
            created_at=now - timedelta(days=1, hours=3),
        ),
        GovernanceNotification(
            notification_type="package_issue",
            title="Duplicate Package Risk — AWS Admin Packages",
            body="Cloud-Ops-Admin-Package overlaps with 2 other packages granting equivalent AWS Administrator permissions. Consolidation recommended.",
            severity="warning",
            target_user_role="analyst",
            created_at=now - timedelta(days=2),
        ),
        GovernanceNotification(
            notification_type="workflow_created",
            title="Governance Workflow — SAP ERP Stale Review",
            body="SAP ERP Finance Roles governance workflow SAIL-SP4FC9NZ has been assigned to Finance Governance Queue. SLA: 30 days.",
            severity="info",
            target_user_role=None,
            created_at=now - timedelta(days=3),
        ),
    ]

    db.add_all(demo)
    db.commit()
    return {"seeded": len(demo)}
