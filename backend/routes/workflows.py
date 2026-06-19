from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from database import get_db
from models import GovernanceWorkflow, WorkflowTimelineEvent, Connector
from sla_service import get_sla_status, run_sla_sweep, _log_timeline
from workflow_automation import run_auto_trigger
from routes.auth import get_current_user

router = APIRouter(prefix="/governance/workflows", tags=["workflows"])

TERMINAL_STATUSES = {"resolved", "archived", "accepted_risk"}

VALID_STATUSES = {
    "open",
    "under_review",
    "owner_assigned",
    "remediation_in_progress",
    "accepted_risk",
    "resolved",
    "archived",
}

# ─────────────────────────────────────────────
# RECOMMENDATIONS ENGINE
# ─────────────────────────────────────────────
def generate_recommendations(wf: GovernanceWorkflow, overdue_days: int) -> list:
    """
    Rules-based recommendations computed at serialisation time.
    Returns a list of {action, reason, urgency} dicts.
    urgency: "critical" | "warning" | "info"
    """
    recs = []
    now = datetime.utcnow()
    is_terminal = wf.status in TERMINAL_STATUSES

    if is_terminal:
        return recs

    # ── SLA breach recommendations
    if overdue_days > (wf.sla_days or 14) and wf.escalation_level < 2:
        recs.append({
            "action": "Escalate to governance lead",
            "reason": f"SLA critically breached by {overdue_days} days — requires director-level intervention.",
            "urgency": "critical",
        })
    elif overdue_days > 0 and wf.escalation_level == 0:
        recs.append({
            "action": "Assign governance owner",
            "reason": f"Workflow is {overdue_days} day(s) overdue with no escalation. Assign an owner immediately.",
            "urgency": "warning",
        })

    # ── Missing owner / owner assignment
    if wf.workflow_type in ("owner_assignment", "orphaned_role_cleanup", "missing_owner"):
        if overdue_days > 30:
            recs.append({
                "action": "Archive or reassign role via connected platform",
                "reason": "Role has been ungoverned for over 30 days. Archive if unused or assign a new owner.",
                "urgency": "warning",
            })
        else:
            recs.append({
                "action": "Identify replacement governance owner",
                "reason": "Role is missing an active owner. Locate a responsible team before SLA expires.",
                "urgency": "info",
            })

    # ── Stale access remediation
    if wf.workflow_type in ("stale_access_remediation", "stale_review", "stale_review_remediation"):
        if overdue_days > 14:
            recs.append({
                "action": "Launch recertification campaign",
                "reason": "Stale access unresolved for over 14 days. Launch a campaign to recertify or revoke.",
                "urgency": "critical",
            })
        else:
            recs.append({
                "action": "Schedule access recertification with role owner",
                "reason": "Stale access detected. Confirm whether entitlement is still required.",
                "urgency": "warning",
            })

    # ── Privileged access review
    if wf.workflow_type in ("privileged_access_review", "unused_privileged_cleanup"):
        recs.append({
            "action": "Revoke unused privileged access via remediation platform",
            "reason": "Privileged roles with no active users represent a critical attack surface. Revoke immediately.",
            "urgency": "critical" if wf.priority == "critical" else "warning",
        })

    # ── Duplicate / overlapping roles
    if wf.workflow_type in ("duplicate_role_consolidation", "hygiene_remediation"):
        recs.append({
            "action": "Consolidate duplicate roles into a single governed package",
            "reason": "Duplicate entitlement paths increase governance debt and audit risk.",
            "urgency": "warning",
        })

    # ── No governance queue assigned
    if not wf.governance_queue and wf.status not in ("resolved", "archived"):
        recs.append({
            "action": "Assign to a governance queue",
            "reason": "Workflow has no queue assignment. It will not appear in any team's workload view.",
            "urgency": "info",
        })

    # ── Escalation level 2 — needs manual resolution
    if wf.escalation_level >= 2:
        recs.append({
            "action": "Initiate manual governance review",
            "reason": "Workflow has reached critical escalation level. Manual governance lead review required.",
            "urgency": "critical",
        })

    # De-duplicate by action text and cap at 3
    seen = set()
    deduped = []
    for r in recs:
        if r["action"] not in seen:
            seen.add(r["action"])
            deduped.append(r)
    return deduped[:3]




# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _serialise_workflow(wf: GovernanceWorkflow, db: Session) -> dict:
    sla = get_sla_status(wf)

    connector_name = None
    connector_platform = None
    if wf.connector_id:
        c = db.query(Connector).filter(Connector.id == wf.connector_id).first()
        if c:
            connector_name = c.name
            connector_platform = c.platform

    return {
        "id": wf.id,
        "workflow_type": wf.workflow_type,
        "source_type": wf.source_type,
        "source_id": wf.source_id,
        "title": wf.title,
        "description": wf.description,
        "priority": wf.priority,
        "status": wf.status,
        "governance_owner": wf.governance_owner,
        "governance_queue": wf.governance_queue,
        "connector_id": wf.connector_id,
        "connector_name": connector_name,
        "connector_platform": connector_platform,
        "external_reference": wf.external_reference,
        "sla_days": wf.sla_days,
        "due_date": wf.due_date.isoformat() if wf.due_date else None,
        "created_at": wf.created_at.isoformat() if wf.created_at else None,
        "updated_at": wf.updated_at.isoformat() if wf.updated_at else None,
        "first_reviewed_at": wf.first_reviewed_at.isoformat() if wf.first_reviewed_at else None,
        "escalated_at": wf.escalated_at.isoformat() if wf.escalated_at else None,
        "resolved_at": wf.resolved_at.isoformat() if wf.resolved_at else None,
        "escalation_level": wf.escalation_level,
        "escalation_target": wf.escalation_target,
        "notes": wf.notes,
        "story_key": wf.story_key,
        "sla_status": sla["sla_status"],
        "overdue_days": sla["overdue_days"],
        "days_remaining": sla.get("days_remaining"),
        "recommendations": generate_recommendations(wf, sla["overdue_days"]),
    }


def _serialise_event(e: WorkflowTimelineEvent) -> dict:
    return {
        "id": e.id,
        "event_type": e.event_type,
        "actor": e.actor,
        "description": e.description,
        "event_metadata": e.event_metadata,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


# ─────────────────────────────────────────────
# LIST WORKFLOWS
# ─────────────────────────────────────────────

@router.get("")
def list_workflows(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    workflow_type: Optional[str] = None,
    escalation_level: Optional[int] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(GovernanceWorkflow)

    if active_only:
        query = query.filter(GovernanceWorkflow.status.notin_(TERMINAL_STATUSES))
    if status:
        query = query.filter(GovernanceWorkflow.status == status)
    if priority:
        query = query.filter(GovernanceWorkflow.priority == priority)
    if workflow_type:
        query = query.filter(GovernanceWorkflow.workflow_type == workflow_type)
    if escalation_level is not None:
        query = query.filter(GovernanceWorkflow.escalation_level == escalation_level)

    workflows = query.order_by(
        GovernanceWorkflow.escalation_level.desc(),
        GovernanceWorkflow.created_at.desc()
    ).all()

    return [_serialise_workflow(wf, db) for wf in workflows]


# ─────────────────────────────────────────────
# GET SINGLE WORKFLOW
# ─────────────────────────────────────────────

@router.get("/{workflow_id}")
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    wf = db.query(GovernanceWorkflow).filter(
        GovernanceWorkflow.id == workflow_id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _serialise_workflow(wf, db)


# ─────────────────────────────────────────────
# GET WORKFLOW TIMELINE
# ─────────────────────────────────────────────

@router.get("/{workflow_id}/timeline")
def get_workflow_timeline(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    wf = db.query(GovernanceWorkflow).filter(
        GovernanceWorkflow.id == workflow_id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    events = db.query(WorkflowTimelineEvent).filter(
        WorkflowTimelineEvent.workflow_id == workflow_id
    ).order_by(WorkflowTimelineEvent.created_at.asc()).all()

    return {
        "workflow_id": workflow_id,
        "workflow_title": wf.title,
        "events": [_serialise_event(e) for e in events],
    }


# ─────────────────────────────────────────────
# UPDATE WORKFLOW STATUS / ROUTING
# ─────────────────────────────────────────────

@router.patch("/{workflow_id}")
def update_workflow(
    workflow_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    wf = db.query(GovernanceWorkflow).filter(
        GovernanceWorkflow.id == workflow_id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    now = datetime.utcnow()
    actor = current_user.email if hasattr(current_user, "email") else "system"
    changed_fields = []

    if "status" in payload:
        new_status = payload["status"]
        if new_status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

        old_status = wf.status
        wf.status = new_status
        changed_fields.append(f"status: {old_status} → {new_status}")

        if new_status == "resolved" and not wf.resolved_at:
            wf.resolved_at = now
        if new_status == "under_review" and not wf.first_reviewed_at:
            wf.first_reviewed_at = now

    if "governance_owner" in payload:
        wf.governance_owner = payload["governance_owner"]
        changed_fields.append(f"governance_owner → {payload['governance_owner']}")

    if "governance_queue" in payload:
        wf.governance_queue = payload["governance_queue"]
        changed_fields.append(f"governance_queue → {payload['governance_queue']}")

    if "escalation_target" in payload:
        wf.escalation_target = payload["escalation_target"]
        changed_fields.append(f"escalation_target → {payload['escalation_target']}")

    if "notes" in payload:
        wf.notes = payload["notes"]

    wf.updated_at = now

    if changed_fields:
        _log_timeline(
            db, wf.id,
            event_type="workflow_updated",
            actor=actor,
            description=f"Workflow updated: {'; '.join(changed_fields)}.",
            metadata={"changes": changed_fields}
        )

    db.commit()
    db.refresh(wf)
    return _serialise_workflow(wf, db)


# ─────────────────────────────────────────────
# SLA SWEEP
# ─────────────────────────────────────────────

@router.post("/actions/sla-sweep")
def trigger_sla_sweep(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = run_sla_sweep(db)
    return result


# ─────────────────────────────────────────────
# AUTO-TRIGGER WORKFLOWS
# ─────────────────────────────────────────────

@router.post("/actions/run-auto-trigger")
def trigger_auto_workflows(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = run_auto_trigger(db)
    return result


# ─────────────────────────────────────────────
# WORKFLOW QUEUE SUMMARY
# ─────────────────────────────────────────────

@router.get("/stats/queue-summary")
def get_workflow_queue_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    all_wf = db.query(GovernanceWorkflow).all()

    escalated = [w for w in all_wf if w.escalation_level >= 1 and w.status not in TERMINAL_STATUSES]
    overdue = [w for w in all_wf if w.due_date and w.due_date < datetime.utcnow() and w.status not in TERMINAL_STATUSES]
    active = [w for w in all_wf if w.status not in TERMINAL_STATUSES]
    resolved = [w for w in all_wf if w.status in TERMINAL_STATUSES]

    critical_open = [w for w in active if w.priority == "critical"]
    high_open = [w for w in active if w.priority == "high"]

    return {
        "total_workflows": len(all_wf),
        "active": len(active),
        "escalated": len(escalated),
        "overdue": len(overdue),
        "resolved": len(resolved),
        "critical_open": len(critical_open),
        "high_open": len(high_open),
    }
