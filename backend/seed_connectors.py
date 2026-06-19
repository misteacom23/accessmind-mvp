from datetime import datetime, timedelta
from database import SessionLocal
from models import Connector


def seed_connectors(db):
    existing = db.query(Connector).first()
    if existing:
        return

    connectors = [
        Connector(
            name="SailPoint IdentityNow",
            platform="sailpoint",
            connector_type="iam",
            status="active",
            description="Identity governance and administration platform. Source of truth for role assignments and access certifications.",
            base_url="https://tenant.identitynow.com",
            last_sync_at=datetime.utcnow() - timedelta(hours=2),
            sync_status="synced",
            record_count=1847,
        ),
        Connector(
            name="Microsoft Entra ID",
            platform="entra",
            connector_type="iam",
            status="active",
            description="Cloud identity and access management. Manages Azure AD groups, conditional access policies, and directory roles.",
            base_url="https://entra.microsoft.com",
            last_sync_at=datetime.utcnow() - timedelta(hours=5),
            sync_status="synced",
            record_count=3201,
        ),
        Connector(
            name="ServiceNow ITSM",
            platform="servicenow",
            connector_type="itsm",
            status="active",
            description="IT service management platform. Remediations routed here generate access removal tickets with SLA tracking.",
            base_url="https://tenant.service-now.com",
            last_sync_at=datetime.utcnow() - timedelta(hours=1),
            sync_status="synced",
            record_count=412,
        ),
        Connector(
            name="Okta",
            platform="okta",
            connector_type="iam",
            status="coming_soon",
            description="Workforce identity platform. Will provide SSO group membership and application assignment data.",
            base_url="https://tenant.okta.com",
            last_sync_at=None,
            sync_status="never_synced",
            record_count=0,
        ),
        Connector(
            name="CyberArk PAM",
            platform="cyberark",
            connector_type="pam",
            status="coming_soon",
            description="Privileged access management. Will surface privileged session data and vault account assignments.",
            base_url="https://cyberark.internal",
            last_sync_at=None,
            sync_status="never_synced",
            record_count=0,
        ),
        Connector(
            name="Splunk SIEM",
            platform="splunk",
            connector_type="siem",
            status="coming_soon",
            description="Security information and event management. Will receive governance audit events and risk signals for correlation.",
            base_url="https://splunk.internal:8089",
            last_sync_at=None,
            sync_status="never_synced",
            record_count=0,
        ),
    ]

    for c in connectors:
        db.add(c)

    db.commit()
    print(f"[seed] Seeded {len(connectors)} connectors")
