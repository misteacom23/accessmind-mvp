from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import GovernanceWorkflow, WorkflowTimelineEvent, GovernanceNotification

# ─────────────────────────────────────────────
# SLA DAYS BY PRIORITY
# ─────────────────────────────────────────────

SLA_DAYS = {
    "critical": 7,
    "high": 14,
    "medium": 30,
    "low": 60,
}

TERMINAL_STATUSES = {"resolved", "archived", "accepted_risk"}


def get_sla_days(priority: str) -> int:
    return SLA_DAYS.get(priority.lower(), 14)


def compute_due_date(created_at: datetime, priority: str) -> datetime:
    return created_at + timedelta(days=get_sla_days(priority))


def compute_overdue_days(due_date: datetime) -> int:
    if due_date is None:
        return 0
    delta = datetime.utcnow() - due_date
    return max(0, delta.days)


def get_sla_status(workflow: GovernanceWorkflow) -> dict:
    """
    Returns a dict describing the SLA state of a workflow.
    Used by API responses — never stored directly.
    """
    if workflow.status in TERMINAL_STATUSES:
        return {
            "sla_status": "resolved",
            "overdue_days": 0,
            "due_date": workflow.due_date,
            "escalation_level": workflow.escalation_level,
        }

    overdue_days = compute_overdue_days(workflow.due_date)
    days_remaining = max(0, (workflow.due_date - datetime.utcnow()).days) if workflow.due_date else None

    if overdue_days > workflow.sla_days:
        sla_status = "critical_breach"
    elif overdue_days > 0:
        sla_status = "breached"
    elif days_remaining is not None and days_remaining <= 2:
        sla_status = "due_soon"
    else:
        sla_status = "on_track"

    return {
        "sla_status": sla_status,
        "overdue_days": overdue_days,
        "days_remaining": days_remaining,
        "due_date": workflow.due_date,
        "escalation_level": workflow.escalation_level,
    }


# ─────────────────────────────────────────────
# SLA SWEEP — run on scan or manual trigger
# ─────────────────────────────────────────────

def run_sla_sweep(db: Session) -> dict:
    """
    Checks all open workflows for SLA breaches.
    Escalates level and logs timeline events.
    Never changes workflow status autonomously.
    """
    now = datetime.utcnow()
    escalated_l1 = 0
    escalated_l2 = 0

    open_workflows = db.query(GovernanceWorkflow).filter(
        GovernanceWorkflow.status.notin_(TERMINAL_STATUSES)
    ).all()

    for wf in open_workflows:
        if wf.due_date is None:
            continue

        overdue_days = compute_overdue_days(wf.due_date)

        # Level 1 — initial SLA breach
        if overdue_days > 0 and wf.escalation_level == 0:
            wf.escalation_level = 1
            wf.escalated_at = now
            _log_timeline(
                db, wf.id,
                event_type="sla_breach",
                actor="system",
                description=f"SLA breach detected. {overdue_days} day(s) overdue. Escalated to governance queue.",
                metadata={"overdue_days": overdue_days, "escalation_level": 1}
            )
            db.add(GovernanceNotification(
                notification_type="sla_breach",
                title=f"SLA Breached — {wf.title}",
                body=(
                    f"Governance workflow {wf.external_reference or wf.id} is {overdue_days} day(s) overdue. "
                    f"Escalated to {wf.governance_queue or 'governance queue'}. Immediate action required."
                ),
                severity="warning" if overdue_days < 7 else "critical",
                target_user_role=None,
                related_workflow_id=wf.id,
            ))
            escalated_l1 += 1

        # Level 2 — double SLA breach
        elif overdue_days > wf.sla_days and wf.escalation_level == 1:
            wf.escalation_level = 2
            _log_timeline(
                db, wf.id,
                event_type="sla_critical_breach",
                actor="system",
                description=f"Critical SLA breach. {overdue_days} day(s) overdue. Escalated to {wf.escalation_target or 'governance lead'}.",
                metadata={"overdue_days": overdue_days, "escalation_level": 2}
            )
            db.add(GovernanceNotification(
                notification_type="escalation",
                title=f"Critical Escalation — {wf.title}",
                body=(
                    f"Governance workflow {wf.external_reference or wf.id} has critically breached its SLA "
                    f"by {overdue_days} day(s). Escalated to {wf.escalation_target or 'governance lead'}."
                ),
                severity="critical",
                target_user_role="manager",
                related_workflow_id=wf.id,
            ))
            escalated_l2 += 1

    db.commit()

    return {
        "workflows_checked": len(open_workflows),
        "escalated_to_l1": escalated_l1,
        "escalated_to_l2": escalated_l2,
        "sweep_at": now.isoformat(),
    }


# ─────────────────────────────────────────────
# INTERNAL HELPERS
# ─────────────────────────────────────────────

def _log_timeline(db: Session, workflow_id: int, event_type: str, actor: str, description: str, metadata: dict = None):
    event = WorkflowTimelineEvent(
        workflow_id=workflow_id,
        event_type=event_type,
        actor=actor,
        description=description,
        event_metadata=metadata or {},
        created_at=datetime.utcnow(),
    )
    db.add(event)
