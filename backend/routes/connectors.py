from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Connector, RemediationAction
from routes.auth import get_current_user

router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/")
def list_connectors(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    connectors = db.query(Connector).order_by(Connector.status.asc(), Connector.name.asc()).all()
    result = []
    for c in connectors:
        action_count = (
            db.query(RemediationAction)
            .filter(RemediationAction.connector_id == c.id)
            .count()
        )
        result.append({
            "id": c.id,
            "name": c.name,
            "platform": c.platform,
            "connector_type": c.connector_type,
            "status": c.status,
            "description": c.description,
            "base_url": c.base_url,
            "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
            "sync_status": c.sync_status,
            "record_count": c.record_count,
            "remediation_action_count": action_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return result
