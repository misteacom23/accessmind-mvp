from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import AuditLog, Finding

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


def format_log(entry: AuditLog) -> dict:
    return {
        "id": entry.id,
        "action_type": entry.action_type,
        "performed_by": entry.performed_by,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "details": entry.details,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


@router.get("/")
def list_audit_logs(db: Session = Depends(get_db)):
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .all()
    )
    return {"logs": [format_log(l) for l in logs], "total": len(logs)}


@router.get("/finding/{finding_id}")
def finding_timeline(finding_id: int, db: Session = Depends(get_db)):
    """Returns audit logs for a specific finding — used as the activity timeline."""
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.target_type.in_(["finding", "approval_request"]),
            AuditLog.target_id == finding_id,
        )
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    return {"timeline": [format_log(l) for l in logs], "finding_id": finding_id}
