"""
Audit Service
-------------
Centralised audit logging. Every governance action must call this.
This is the single source of truth for all system activity.

Action types:
  FINDING_CREATED          — mover detection created a finding
  FINDING_STATUS_UPDATED   — finding status changed
  APPROVAL_CREATED         — approval request submitted
  APPROVAL_APPROVED        — approver approved the request
  APPROVAL_REJECTED        — approver rejected the request
"""

from sqlalchemy.orm import Session
from models import AuditLog


def log(
    db: Session,
    action_type: str,
    performed_by: str = "System",
    target_type: str | None = None,
    target_id: int | None = None,
    details: str | None = None,
) -> AuditLog:
    """
    Create an audit log entry. Call this after every governance action.
    Commits immediately so logs are never lost even if the caller fails later.
    """
    entry = AuditLog(
        action_type=action_type,
        performed_by=performed_by,
        target_type=target_type,
        target_id=target_id,
        details=details,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def log_finding_created(db: Session, finding_id: int, employee_name: str, risk_level: str, reason: str):
    return log(
        db,
        action_type="FINDING_CREATED",
        performed_by="System",
        target_type="finding",
        target_id=finding_id,
        details=f"Finding created for {employee_name} — {risk_level} risk. {reason}",
    )


def log_finding_status_updated(db: Session, finding_id: int, old_status: str, new_status: str, performed_by: str = "System"):
    return log(
        db,
        action_type="FINDING_STATUS_UPDATED",
        performed_by=performed_by,
        target_type="finding",
        target_id=finding_id,
        details=f"Finding status changed from '{old_status}' to '{new_status}'.",
    )


def log_approval_created(db: Session, approval_id: int, finding_id: int, employee_name: str, access_group: str, performed_by: str = "System"):
    return log(
        db,
        action_type="APPROVAL_CREATED",
        performed_by=performed_by,
        target_type="approval_request",
        target_id=approval_id,
        details=f"Approval request created for removal of '{access_group}' from {employee_name} (Finding #{finding_id}).",
    )


def log_approval_approved(db: Session, approval_id: int, approver: str, access_group: str, employee_name: str, notes: str | None):
    return log(
        db,
        action_type="APPROVAL_APPROVED",
        performed_by=approver,
        target_type="approval_request",
        target_id=approval_id,
        details=f"{approver} approved removal of '{access_group}' from {employee_name}." + (f" Notes: {notes}" if notes else ""),
    )


def log_approval_rejected(db: Session, approval_id: int, approver: str, access_group: str, employee_name: str, notes: str | None):
    return log(
        db,
        action_type="APPROVAL_REJECTED",
        performed_by=approver,
        target_type="approval_request",
        target_id=approval_id,
        details=f"{approver} rejected removal of '{access_group}' from {employee_name}." + (f" Notes: {notes}" if notes else ""),
    )
