"""
Approval Service
----------------
Handles the full approval workflow lifecycle.

Workflow:
  1. create_approval_request()  → creates request, sets finding to Under Review
  2. approve_request()          → approves, sets finding to Resolved
  3. reject_request()           → rejects, sets finding back to Open

Every action writes to the audit log.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import ApprovalRequest, Finding, Employee
import audit_service


def format_approval(a: ApprovalRequest) -> dict:
    emp = a.employee
    finding = a.finding
    return {
        "id": a.id,
        "finding_id": a.finding_id,
        "employee_id": emp.id,
        "employee_name": emp.name,
        "employee_role": emp.role,
        "current_team": emp.current_team,
        "previous_team": emp.previous_team,
        "request_type": a.request_type,
        "access_group_name": a.access_group_name,
        "approver_name": a.approver_name,
        "status": a.status,
        "decision_notes": a.decision_notes,
        "risk_level": finding.risk_level,
        "finding_reason": finding.reason,
        "finding_recommendation": finding.recommendation,
        "finding_status": finding.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "decided_at": a.decided_at.isoformat() if a.decided_at else None,
    }


def create_approval_request(
    db: Session,
    finding_id: int,
    access_group_name: str,
    approver_name: str,
    performed_by: str = "System",
) -> dict:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise ValueError(f"Finding {finding_id} not found")

    # Check no pending request already exists for this finding+group
    existing = (
        db.query(ApprovalRequest)
        .filter(
            ApprovalRequest.finding_id == finding_id,
            ApprovalRequest.access_group_name == access_group_name,
            ApprovalRequest.status == "Pending",
        )
        .first()
    )
    if existing:
        raise ValueError(f"A pending approval request already exists for '{access_group_name}' on this finding.")

    approval = ApprovalRequest(
        finding_id=finding_id,
        employee_id=finding.employee_id,
        request_type="access_removal",
        access_group_name=access_group_name,
        approver_name=approver_name,
        status="Pending",
    )
    db.add(approval)
    db.flush()

    # Automatically move finding to Under Review
    old_status = finding.status
    finding.status = "Under Review"
    finding.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(approval)

    # Audit logs
    audit_service.log_approval_created(
        db,
        approval_id=approval.id,
        finding_id=finding_id,
        employee_name=finding.employee.name,
        access_group=access_group_name,
        performed_by=performed_by,
    )
    if old_status != "Under Review":
        audit_service.log_finding_status_updated(
            db,
            finding_id=finding_id,
            old_status=old_status,
            new_status="Under Review",
            performed_by="System",
        )

    return format_approval(approval)


def approve_request(
    db: Session,
    approval_id: int,
    approver_name: str,
    decision_notes: str | None = None,
) -> dict:
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise ValueError(f"Approval request {approval_id} not found")
    if approval.status != "Pending":
        raise ValueError(f"Approval request is already {approval.status}")

    approval.status = "Approved"
    approval.approver_name = approver_name
    approval.decision_notes = decision_notes
    approval.decided_at = datetime.now(timezone.utc)

    # Automatically resolve the finding
    finding = approval.finding
    old_status = finding.status
    finding.status = "Resolved"
    finding.resolved_at = datetime.now(timezone.utc)
    finding.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(approval)

    audit_service.log_approval_approved(
        db,
        approval_id=approval_id,
        approver=approver_name,
        access_group=approval.access_group_name,
        employee_name=approval.employee.name,
        notes=decision_notes,
    )
    audit_service.log_finding_status_updated(
        db,
        finding_id=finding.id,
        old_status=old_status,
        new_status="Resolved",
        performed_by=approver_name,
    )

    return format_approval(approval)


def reject_request(
    db: Session,
    approval_id: int,
    approver_name: str,
    decision_notes: str | None = None,
) -> dict:
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise ValueError(f"Approval request {approval_id} not found")
    if approval.status != "Pending":
        raise ValueError(f"Approval request is already {approval.status}")

    approval.status = "Rejected"
    approval.approver_name = approver_name
    approval.decision_notes = decision_notes
    approval.decided_at = datetime.now(timezone.utc)

    # Finding goes back to Open
    finding = approval.finding
    old_status = finding.status
    finding.status = "Open"
    finding.updated_at = datetime.now(timezone.utc)
    finding.resolved_at = None

    db.commit()
    db.refresh(approval)

    audit_service.log_approval_rejected(
        db,
        approval_id=approval_id,
        approver=approver_name,
        access_group=approval.access_group_name,
        employee_name=approval.employee.name,
        notes=decision_notes,
    )
    audit_service.log_finding_status_updated(
        db,
        finding_id=finding.id,
        old_status=old_status,
        new_status="Open",
        performed_by=approver_name,
    )

    return format_approval(approval)


def list_approvals(db: Session) -> list[dict]:
    approvals = (
        db.query(ApprovalRequest)
        .order_by(ApprovalRequest.created_at.desc())
        .all()
    )
    return [format_approval(a) for a in approvals]


def get_approval(db: Session, approval_id: int) -> dict:
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval:
        raise ValueError(f"Approval request {approval_id} not found")
    return format_approval(approval)
