"""
AccessMind — Phase 4B
Governance Hygiene API Routes

Prefix: /governance/hygiene
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import GovernanceHygieneCluster
from hygiene_service import get_debt_scores, run_hygiene_scan, upsert_clusters
from routes.auth import get_current_user

router = APIRouter(prefix="/governance/hygiene", tags=["governance-hygiene"])


def _cluster_to_dict(c: GovernanceHygieneCluster) -> dict:
    return {
        "id": c.id,
        "cluster_type": c.cluster_type,
        "system_name": c.system_name,
        "title": c.title,
        "description": c.description,
        "affected_count": c.affected_count,
        "affected_role_names": c.affected_role_names or [],
        "priority": c.priority,
        "governance_owner": c.governance_owner,
        "governance_queue": c.governance_queue,
        "escalation_target": c.escalation_target,
        "recommendation": c.recommendation,
        "status": c.status,
        "governance_debt_score": c.governance_debt_score,
        "last_detected_at": c.last_detected_at.isoformat() if c.last_detected_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/clusters")
def list_clusters(
    cluster_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    system_name: Optional[str] = Query(None),
    active_only: Optional[bool] = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(GovernanceHygieneCluster)

    if cluster_type:
        q = q.filter(GovernanceHygieneCluster.cluster_type == cluster_type)
    if priority:
        q = q.filter(GovernanceHygieneCluster.priority == priority)
    if status:
        q = q.filter(GovernanceHygieneCluster.status == status)
    if system_name:
        q = q.filter(GovernanceHygieneCluster.system_name.ilike(f"%{system_name}%"))
    if active_only:
        q = q.filter(
            GovernanceHygieneCluster.status.in_(
                ["new", "under_review", "owner_assigned", "remediation_in_progress"]
            )
        )

    clusters = q.order_by(GovernanceHygieneCluster.governance_debt_score.desc()).all()
    return {"clusters": [_cluster_to_dict(c) for c in clusters], "total": len(clusters)}


@router.post("/scan")
def run_scan(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cluster_data = run_hygiene_scan(db)
    clusters = upsert_clusters(db, cluster_data)

    priority_summary = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for c in clusters:
        priority_summary[c.priority] = priority_summary.get(c.priority, 0) + 1

    return {
        "message": f"Hygiene scan complete. {len(clusters)} clusters detected.",
        "clusters_detected": len(clusters),
        "priority_summary": priority_summary,
        "scanned_at": datetime.utcnow().isoformat(),
    }


@router.patch("/clusters/{cluster_id}")
def update_cluster(
    cluster_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    cluster = (
        db.query(GovernanceHygieneCluster)
        .filter(GovernanceHygieneCluster.id == cluster_id)
        .first()
    )
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    VALID_STATUSES = {
        "new", "under_review", "accepted_risk",
        "owner_assigned", "remediation_in_progress", "archived", "resolved",
    }

    if "status" in payload:
        if payload["status"] not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}",
            )
        cluster.status = payload["status"]

    if "governance_owner" in payload:
        cluster.governance_owner = payload["governance_owner"]
    if "governance_queue" in payload:
        cluster.governance_queue = payload["governance_queue"]
    if "escalation_target" in payload:
        cluster.escalation_target = payload["escalation_target"]

    cluster.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cluster)
    return _cluster_to_dict(cluster)


@router.get("/debt-score")
def debt_score(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_debt_scores(db)
