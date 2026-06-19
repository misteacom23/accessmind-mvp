"""
Exception Service
-----------------
Handles temporary access exception workflows.

When an approver grants a temporary exception instead of removing access:
  1. Exception is created with expiry date + business justification
  2. Finding status becomes "Exception Active"
  3. Risk level is downgraded by one tier while exception is active
  4. Audit log is written
  5. On expiry, finding returns to Open for re-review

Exception statuses:
  Active   — exception is in effect, finding suppressed
  Expired  — expiry date passed, finding needs re-review
  Revoked  — manually cancelled before expiry
"""

from datetime import datetime, date, timezone
from sqlalchemy.orm import Session
from models import AccessException, Finding, Employee
import audit_service


RISK_DOWNGRADE = {
    "Critical": "High",
    "High":     "Medium",
    "Medium":   "Low",
    "Low":      "Low",
}


def format_exception(e: AccessException) -> dict:
    emp = e.employee
    finding = e.finding
    return {
        "id": e.id,
        "finding_id": e.finding_id,
        "employee_id": emp.id,
        "employee_name": emp.name,
        "employee_role": emp.role,
        "current_team": emp.current_team,
        "access_group_name": e.access_group_name,
        "business_justification": e.business_justification,
        "approved_by": e.approved_by,
        "expiry_date": str(e.expiry_date),
        "status": e.status,
        "risk_level": finding.risk_level,
        "finding_reason": finding.reason,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        "revoked_at": e.revoked_at.isoformat() if e.revoked_at else None,
    }


def create_exception(
    db: Session,
    finding_id: int,
    access_group_name: str,
    business_justification: str,
    approved_by: str,
    expiry_date: date,
) -> dict:
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise ValueError(f"Finding {finding_id} not found")

    # Check no active exception already exists
    existing = db.query(AccessException).filter(
        AccessException.finding_id == finding_id,
        AccessException.access_group_name == access_group_name,
        AccessException.status == "Active",
    ).first()
    if existing:
        raise ValueError(f"An active exception already exists for '{access_group_name}' on this finding.")

    exception = AccessException(
        finding_id=finding_id,
        employee_id=finding.employee_id,
        access_group_name=access_group_name,
        business_justification=business_justification,
        approved_by=approved_by,
        expiry_date=expiry_date,
        status="Active",
    )
    db.add(exception)
    db.flush()

    # Move finding to Exception Active status
    old_status = finding.status
    finding.status = "Exception Active"
    finding.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exception)

    # Audit logs
    audit_service.log(
        db,
        action_type="EXCEPTION_CREATED",
        performed_by=approved_by,
        target_type="access_exception",
        target_id=exception.id,
        details=(
            f"{approved_by} granted temporary exception for '{access_group_name}' "
            f"on Finding #{finding_id} ({finding.employee.name}). "
            f"Justification: {business_justification}. "
            f"Expires: {expiry_date}."
        ),
    )
    audit_service.log_finding_status_updated(
        db,
        finding_id=finding_id,
        old_status=old_status,
        new_status="Exception Active",
        performed_by=approved_by,
    )

    return format_exception(exception)


def revoke_exception(
    db: Session,
    exception_id: int,
    revoked_by: str,
) -> dict:
    exception = db.query(AccessException).filter(AccessException.id == exception_id).first()
    if not exception:
        raise ValueError(f"Exception {exception_id} not found")
    if exception.status != "Active":
        raise ValueError(f"Exception is already {exception.status}")

    exception.status = "Revoked"
    exception.revoked_at = datetime.now(timezone.utc)
    exception.updated_at = datetime.now(timezone.utc)

    # Return finding to Open
    finding = exception.finding
    finding.status = "Open"
    finding.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(exception)

    audit_service.log(
        db,
        action_type="EXCEPTION_REVOKED",
        performed_by=revoked_by,
        target_type="access_exception",
        target_id=exception_id,
        details=f"{revoked_by} revoked exception for '{exception.access_group_name}' — finding returned to Open.",
    )

    return format_exception(exception)


def check_expired_exceptions(db: Session) -> int:
    """
    Called at query time — marks exceptions past their expiry date as Expired
    and returns findings to Open for re-review.
    Returns count of newly expired exceptions.
    """
    today = date.today()
    active_exceptions = db.query(AccessException).filter(
        AccessException.status == "Active",
        AccessException.expiry_date < today,
    ).all()

    count = 0
    for exc in active_exceptions:
        exc.status = "Expired"
        exc.updated_at = datetime.now(timezone.utc)

        finding = exc.finding
        if finding.status == "Exception Active":
            finding.status = "Open"
            finding.updated_at = datetime.now(timezone.utc)

        audit_service.log(
            db,
            action_type="EXCEPTION_EXPIRED",
            performed_by="System",
            target_type="access_exception",
            target_id=exc.id,
            details=(
                f"Exception for '{exc.access_group_name}' on Finding #{exc.finding_id} "
                f"expired on {exc.expiry_date}. Finding returned to Open."
            ),
        )
        count += 1

    if count > 0:
        db.commit()

    return count


def list_exceptions(db: Session) -> list[dict]:
    check_expired_exceptions(db)
    exceptions = db.query(AccessException).order_by(AccessException.created_at.desc()).all()
    return [format_exception(e) for e in exceptions]


def get_exceptions_for_finding(db: Session, finding_id: int) -> list[dict]:
    check_expired_exceptions(db)
    exceptions = db.query(AccessException).filter(
        AccessException.finding_id == finding_id
    ).order_by(AccessException.created_at.desc()).all()
    return [format_exception(e) for e in exceptions]
