from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from database import get_db
from models import Finding, Employee, ApprovalRequest, AccessException
import exception_service

router = APIRouter(prefix="/findings", tags=["Findings"])

VALID_STATUSES = {"Open", "Under Review", "Resolved", "Exception Active"}


class StatusUpdate(BaseModel):
    status: str


def format_finding(f: Finding) -> dict:
    emp = f.employee
    return {
        "id": f.id,
        "employee_id": emp.id,
        "employee_name": emp.name,
        "employee_email": emp.email,
        "employee_role": emp.role,
        "current_team": emp.current_team,
        "previous_team": emp.previous_team,
        "finding_type": f.finding_type,
        "risk_level": f.risk_level,
        "reason": f.reason,
        "recommendation": f.recommendation,
        "status": f.status,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
        "access": [
            {
                "group_name": ea.group.group_name,
                "system_name": ea.group.system_name,
                "team_owner": ea.group.team_owner,
                "is_privileged": ea.group.is_privileged,
            }
            for ea in emp.employee_access
        ],
        "exceptions": [
            {
                "id": ex.id,
                "access_group_name": ex.access_group_name,
                "business_justification": ex.business_justification,
                "approved_by": ex.approved_by,
                "expiry_date": str(ex.expiry_date),
                "status": ex.status,
                "created_at": ex.created_at.isoformat() if ex.created_at else None,
            }
            for ex in f.access_exceptions
        ],
    }


@router.get("/stats")
def findings_stats(db: Session = Depends(get_db)):
    exception_service.check_expired_exceptions(db)

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_employees = db.query(Employee).filter(Employee.employment_status == "active").count()
    total_findings = db.query(Finding).count()
    open_findings = db.query(Finding).filter(Finding.status == "Open").count()
    under_review = db.query(Finding).filter(Finding.status == "Under Review").count()
    exception_active = db.query(Finding).filter(Finding.status == "Exception Active").count()

    high_risk = db.query(Finding).filter(
        Finding.risk_level.in_(["High", "Critical"]),
        Finding.status.notin_(["Resolved"])
    ).count()

    critical_open = db.query(Finding).filter(
        Finding.risk_level == "Critical",
        Finding.status == "Open"
    ).count()

    movers_detected = db.query(Employee).filter(
        Employee.previous_team.isnot(None),
        Employee.employment_status == "active"
    ).count()

    # Resolved this month
    resolved_this_month = db.query(Finding).filter(
        Finding.status == "Resolved",
        Finding.resolved_at >= month_ago
    ).count()

    # Approvals this week
    approvals_this_week = db.query(ApprovalRequest).filter(
        ApprovalRequest.created_at >= week_ago
    ).count()

    # Active exceptions
    active_exceptions = db.query(AccessException).filter(
        AccessException.status == "Active"
    ).count()

    # Privileged stale access (open findings where access group is privileged)
    # We count open/exception-active findings that involve privileged access
    privileged_stale = db.query(Finding).filter(
        Finding.status.in_(["Open", "Exception Active"]),
        Finding.risk_level.in_(["Critical", "High"])
    ).count()

    # Average resolution time in days (for resolved findings with timestamps)
    resolved_findings = db.query(Finding).filter(
        Finding.status == "Resolved",
        Finding.resolved_at.isnot(None),
        Finding.created_at.isnot(None)
    ).all()

    avg_resolution_days = None
    if resolved_findings:
        total_days = sum(
            (f.resolved_at - f.created_at).total_seconds() / 86400
            for f in resolved_findings
            if f.resolved_at and f.created_at
        )
        avg_resolution_days = round(total_days / len(resolved_findings), 1)

    return {
        # Core stats
        "total_employees": total_employees,
        "total_findings": total_findings,
        "open_findings": open_findings,
        "under_review": under_review,
        "exception_active": exception_active,
        "high_risk_findings": high_risk,
        "movers_detected": movers_detected,
        # Governance insights
        "critical_open": critical_open,
        "resolved_this_month": resolved_this_month,
        "approvals_this_week": approvals_this_week,
        "active_exceptions": active_exceptions,
        "privileged_stale": privileged_stale,
        "avg_resolution_days": avg_resolution_days,
    }


@router.get("/")
def list_findings(
    db: Session = Depends(get_db),
    risk_level: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    exception_service.check_expired_exceptions(db)
    query = db.query(Finding).join(Finding.employee)
    if risk_level:
        query = query.filter(Finding.risk_level == risk_level)
    if status:
        query = query.filter(Finding.status == status)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            Employee.name.ilike(search_term) |
            Finding.reason.ilike(search_term) |
            Finding.finding_type.ilike(search_term)
        )
    findings = query.order_by(Finding.created_at.desc()).all()
    return {"findings": [format_finding(f) for f in findings], "total": len(findings)}


@router.get("/{finding_id}")
def get_finding(finding_id: int, db: Session = Depends(get_db)):
    f = db.query(Finding).filter(Finding.id == finding_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Finding not found")
    return format_finding(f)


@router.patch("/{finding_id}/status")
def update_finding_status(finding_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"
        )
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.status = body.status
    finding.updated_at = datetime.now(timezone.utc)

    if body.status == "Resolved":
        finding.resolved_at = datetime.now(timezone.utc)
    elif body.status in ("Open", "Under Review", "Exception Active"):
        finding.resolved_at = None

    db.commit()
    db.refresh(finding)
    return {"id": finding.id, "status": finding.status, "message": "Status updated"}
