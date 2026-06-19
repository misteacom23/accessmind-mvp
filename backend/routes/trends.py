"""
routes/trends.py — Phase 4D
Governance trend analytics + workload intelligence endpoints.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from models import GovernanceTrendSnapshot, GovernanceWorkflow
from routes.auth import get_current_user

router = APIRouter(prefix="/governance/trends", tags=["trends"])


# ── GET /governance/trends/snapshots
# Returns time-series snapshots for a given metric_type over the last N days.
# Optional filters: system_scope, governance_queue
@router.get("/snapshots")
def get_snapshots(
    metric_type: str = Query(...),
    days: int = Query(30, ge=7, le=90),
    system_scope: Optional[str] = Query(None),
    governance_queue: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(GovernanceTrendSnapshot).filter(
        GovernanceTrendSnapshot.metric_type == metric_type,
        GovernanceTrendSnapshot.snapshot_date >= since,
    )
    if system_scope:
        q = q.filter(GovernanceTrendSnapshot.system_scope == system_scope)
    else:
        q = q.filter(GovernanceTrendSnapshot.system_scope == None)
    if governance_queue:
        q = q.filter(GovernanceTrendSnapshot.governance_queue == governance_queue)
    else:
        q = q.filter(GovernanceTrendSnapshot.governance_queue == None)

    rows = q.order_by(GovernanceTrendSnapshot.snapshot_date.asc()).all()
    return [
        {
            "date":             r.snapshot_date.strftime("%Y-%m-%d"),
            "value":            r.metric_value,
            "system_scope":     r.system_scope,
            "governance_queue": r.governance_queue,
        }
        for r in rows
    ]


# ── GET /governance/trends/summary
# Returns latest value + 7-day delta for each core metric.
@router.get("/summary")
def get_trend_summary(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    metrics = [
        "debt_score",
        "open_workflows",
        "escalation_count",
        "remediation_throughput",
        "stale_access_count",
    ]
    result = {}
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    for metric in metrics:
        # Latest snapshot (platform-wide only)
        latest = (
            db.query(GovernanceTrendSnapshot)
            .filter(
                GovernanceTrendSnapshot.metric_type == metric,
                GovernanceTrendSnapshot.system_scope == None,
                GovernanceTrendSnapshot.governance_queue == None,
            )
            .order_by(GovernanceTrendSnapshot.snapshot_date.desc())
            .first()
        )

        # Value from 7 days ago
        week_ago = (
            db.query(GovernanceTrendSnapshot)
            .filter(
                GovernanceTrendSnapshot.metric_type == metric,
                GovernanceTrendSnapshot.system_scope == None,
                GovernanceTrendSnapshot.governance_queue == None,
                GovernanceTrendSnapshot.snapshot_date <= seven_days_ago,
            )
            .order_by(GovernanceTrendSnapshot.snapshot_date.desc())
            .first()
        )

        current_val  = latest.metric_value   if latest   else 0
        previous_val = week_ago.metric_value if week_ago else current_val
        delta        = round(current_val - previous_val, 1)
        delta_pct    = round((delta / previous_val * 100), 1) if previous_val else 0

        result[metric] = {
            "current":   current_val,
            "previous":  previous_val,
            "delta":     delta,
            "delta_pct": delta_pct,
            "direction": "up" if delta > 0 else ("down" if delta < 0 else "flat"),
        }

    return result


# ── GET /governance/trends/hotspots
# Returns per-system latest debt scores, sorted worst first.
@router.get("/hotspots")
def get_hotspots(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Get latest debt_score snapshot per system
    subq = (
        db.query(
            GovernanceTrendSnapshot.system_scope,
            func.max(GovernanceTrendSnapshot.snapshot_date).label("latest_date"),
        )
        .filter(
            GovernanceTrendSnapshot.metric_type == "debt_score",
            GovernanceTrendSnapshot.system_scope != None,
        )
        .group_by(GovernanceTrendSnapshot.system_scope)
        .subquery()
    )

    rows = (
        db.query(GovernanceTrendSnapshot)
        .join(
            subq,
            (GovernanceTrendSnapshot.system_scope == subq.c.system_scope)
            & (GovernanceTrendSnapshot.snapshot_date == subq.c.latest_date),
        )
        .filter(GovernanceTrendSnapshot.metric_type == "debt_score")
        .order_by(GovernanceTrendSnapshot.metric_value.desc())
        .all()
    )

    return [
        {
            "system":     r.system_scope,
            "debt_score": r.metric_value,
            "as_of":      r.snapshot_date.strftime("%Y-%m-%d"),
        }
        for r in rows
    ]


# ── GET /governance/trends/workload
# Live workload intelligence — computed from governance_workflows table.
@router.get("/workload")
def get_workload(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    active_statuses = ["open", "owner_assigned", "under_review", "escalated", "remediation_in_progress"]

    # ── Queue overload: count of active workflows per governance_queue
    queue_rows = (
        db.query(
            GovernanceWorkflow.governance_queue,
            func.count(GovernanceWorkflow.id).label("total"),
            func.sum(
                case((GovernanceWorkflow.escalation_level >= 1, 1), else_=0)
            ).label("escalated"),
            func.sum(
                case((GovernanceWorkflow.priority == "critical", 1), else_=0)
            ).label("critical"),
        )
        .filter(
            GovernanceWorkflow.status.in_(active_statuses),
            GovernanceWorkflow.governance_queue != None,
        )
        .group_by(GovernanceWorkflow.governance_queue)
        .order_by(func.count(GovernanceWorkflow.id).desc())
        .all()
    )

    queues = [
        {
            "queue":     r.governance_queue,
            "total":     r.total,
            "escalated": int(r.escalated or 0),
            "critical":  int(r.critical or 0),
            "overloaded": r.total >= 8,
        }
        for r in queue_rows
    ]

    # ── Owner overload: governance owners with most unresolved workflows
    owner_rows = (
        db.query(
            GovernanceWorkflow.governance_owner,
            func.count(GovernanceWorkflow.id).label("total"),
            func.sum(
                case((GovernanceWorkflow.escalation_level >= 1, 1), else_=0)
            ).label("escalated"),
        )
        .filter(
            GovernanceWorkflow.status.in_(active_statuses),
            GovernanceWorkflow.governance_owner.isnot(None),
            GovernanceWorkflow.governance_owner != '',
        )
        .group_by(GovernanceWorkflow.governance_owner)
        .order_by(func.count(GovernanceWorkflow.id).desc())
        .limit(8)
        .all()
    )

    owners = [
        {
            "owner":     r.governance_owner,
            "total":     r.total,
            "escalated": int(r.escalated or 0),
            "overloaded": r.total >= 5,
        }
        for r in owner_rows
    ]

    # ── SLA breach hotspots: workflows past due_date
    now = datetime.utcnow()
    breached = (
        db.query(GovernanceWorkflow)
        .filter(
            GovernanceWorkflow.status.in_(active_statuses),
            GovernanceWorkflow.due_date < now,
        )
        .count()
    )

    due_soon = (
        db.query(GovernanceWorkflow)
        .filter(
            GovernanceWorkflow.status.in_(active_statuses),
            GovernanceWorkflow.due_date >= now,
            GovernanceWorkflow.due_date <= now + timedelta(days=2),
        )
        .count()
    )

    return {
        "queues":        queues,
        "owners":        owners,
        "sla_breached":  breached,
        "sla_due_soon":  due_soon,
    }
