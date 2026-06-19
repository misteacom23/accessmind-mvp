import random
import string
from datetime import datetime
from sqlalchemy.orm import Session
from models import (
    GovernanceWorkflow, WorkflowTimelineEvent,
    GovernanceHygieneCluster, Finding, Connector
)
from sla_service import get_sla_days, compute_due_date, _log_timeline

# ─────────────────────────────────────────────
# REFERENCE ID GENERATION
# ─────────────────────────────────────────────

PLATFORM_PREFIXES = {
    "sailpoint": "SAIL",
    "entra": "ENTRA",
    "okta": "OKTA",
    "cyberark": "CYARK",
    "servicenow": "SNOW",
    "splunk": "SPLNK",
}

def generate_reference_id(platform: str) -> str:
    prefix = PLATFORM_PREFIXES.get(platform.lower(), "GOV")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    return f"{prefix}-{suffix}"


# ─────────────────────────────────────────────
# PLATFORM ROUTING (mirrors hygiene page logic)
# ─────────────────────────────────────────────

MICROSOFT_SYSTEMS = {
    "Active Directory", "Microsoft Azure", "Microsoft Sentinel",
    "Microsoft Defender XDR", "Microsoft Power BI", "SharePoint"
}

def resolve_platform(system_name: str) -> str:
    if system_name in MICROSOFT_SYSTEMS:
        return "entra"
    if system_name == "CyberArk PAM":
        return "cyberark"
    if system_name in ("Okta IAM",):
        return "okta"
    if system_name in ("ServiceNow ITSM", "ServiceNow GRC"):
        return "servicenow"
    return "sailpoint"


def get_connector_id(db: Session, platform: str) -> int | None:
    connector = db.query(Connector).filter(
        Connector.platform == platform,
        Connector.status == "active"
    ).first()
    return connector.id if connector else None


# ─────────────────────────────────────────────
# PRIORITY → ESCALATION TARGET
# ─────────────────────────────────────────────

ESCALATION_TARGETS = {
    "critical": "CISO / Security Director",
    "high": "IT Governance Lead",
    "medium": "Governance Queue Manager",
    "low": "Team Governance Owner",
}


# ─────────────────────────────────────────────
# TERMINAL / SKIP STATES
# ─────────────────────────────────────────────

TERMINAL_STATUSES = {"resolved", "archived", "accepted_risk"}

HYGIENE_SKIP_STATUSES = {
    "accepted_risk", "remediation_in_progress", "resolved", "archived"
}


# ─────────────────────────────────────────────
# AUTO-TRIGGER FROM HYGIENE CLUSTERS
# ─────────────────────────────────────────────

TRIGGER_CLUSTER_TYPES = {
    "unused_privileged",
    "missing_owner",
    "stale_review",
}

TRIGGER_PRIORITIES = {"critical", "high"}


def auto_trigger_from_clusters(db: Session) -> dict:
    """
    Scans high-risk hygiene clusters and creates GovernanceWorkflow
    records for any that don't already have an open workflow.
    """
    clusters = db.query(GovernanceHygieneCluster).filter(
        GovernanceHygieneCluster.cluster_type.in_(TRIGGER_CLUSTER_TYPES),
        GovernanceHygieneCluster.priority.in_(TRIGGER_PRIORITIES),
        GovernanceHygieneCluster.status.notin_(HYGIENE_SKIP_STATUSES),
    ).all()

    created = 0
    skipped = 0

    for cluster in clusters:
        # Check if an open workflow already exists for this cluster
        existing = db.query(GovernanceWorkflow).filter(
            GovernanceWorkflow.source_type == "hygiene_cluster",
            GovernanceWorkflow.source_id == cluster.id,
            GovernanceWorkflow.status.notin_(TERMINAL_STATUSES),
        ).first()

        if existing:
            skipped += 1
            continue

        platform = resolve_platform(cluster.system_name or "")
        connector_id = get_connector_id(db, platform)
        sla_days = get_sla_days(cluster.priority)
        now = datetime.utcnow()
        due_date = compute_due_date(now, cluster.priority)
        ref_id = generate_reference_id(platform)

        wf = GovernanceWorkflow(
            workflow_type=_workflow_type_for_cluster(cluster.cluster_type),
            source_type="hygiene_cluster",
            source_id=cluster.id,
            title=cluster.title,
            description=cluster.description,
            priority=cluster.priority,
            status="open",
            governance_owner=cluster.governance_owner or "",
            governance_queue=cluster.governance_queue or "Governance Review Queue",
            connector_id=connector_id,
            external_reference=ref_id,
            sla_days=sla_days,
            due_date=due_date,
            escalation_level=0,
            escalation_target=ESCALATION_TARGETS.get(cluster.priority, "Governance Lead"),
            notes=f"Auto-triggered from hygiene cluster: {cluster.cluster_type}",
            created_at=now,
            updated_at=now,
        )
        db.add(wf)
        db.flush()

        _log_timeline(
            db, wf.id,
            event_type="workflow_created",
            actor="system",
            description=f"Governance workflow auto-triggered. Priority: {cluster.priority.upper()}. "
                        f"Routed to {platform.upper()} via {ref_id}.",
            metadata={
                "source": "hygiene_cluster",
                "cluster_type": cluster.cluster_type,
                "platform": platform,
                "external_reference": ref_id,
                "sla_days": sla_days,
            }
        )
        created += 1

    db.commit()
    return {"workflows_created": created, "clusters_skipped": skipped}


# ─────────────────────────────────────────────
# AUTO-TRIGGER FROM FINDINGS
# ─────────────────────────────────────────────

FINDING_TRIGGER_RISKS = {"Critical", "High"}
FINDING_TRIGGER_TYPES = {"stale_access"}


def auto_trigger_from_findings(db: Session) -> dict:
    """
    Scans critical/high open findings and creates GovernanceWorkflow
    records for any that don't already have an open workflow.
    """
    findings = db.query(Finding).filter(
        Finding.risk_level.in_(FINDING_TRIGGER_RISKS),
        Finding.finding_type.in_(FINDING_TRIGGER_TYPES),
        Finding.status.notin_(["Resolved", "Exception Active"]),
    ).all()

    created = 0
    skipped = 0

    for finding in findings:
        existing = db.query(GovernanceWorkflow).filter(
            GovernanceWorkflow.source_type == "finding",
            GovernanceWorkflow.source_id == finding.id,
            GovernanceWorkflow.status.notin_(TERMINAL_STATUSES),
        ).first()

        if existing:
            skipped += 1
            continue

        system_name = getattr(finding, "system_name", "") or ""
        platform = resolve_platform(system_name)
        connector_id = get_connector_id(db, platform)
        priority = finding.risk_level.lower()
        sla_days = get_sla_days(priority)
        now = datetime.utcnow()
        due_date = compute_due_date(now, priority)
        ref_id = generate_reference_id(platform)

        wf = GovernanceWorkflow(
            workflow_type="stale_access_remediation",
            source_type="finding",
            source_id=finding.id,
            title=f"Stale Access: {finding.employee.name if finding.employee else 'Unknown Employee'} — {system_name}",
            description=f"{finding.risk_level} stale access finding requiring governance review.",
            priority=priority,
            status="open",
            governance_owner="",
            governance_queue="Access Remediation Queue",
            connector_id=connector_id,
            external_reference=ref_id,
            sla_days=sla_days,
            due_date=due_date,
            escalation_level=0,
            escalation_target=ESCALATION_TARGETS.get(priority, "Governance Lead"),
            notes=f"Auto-triggered from finding ID {finding.id}.",
            created_at=now,
            updated_at=now,
        )
        db.add(wf)
        db.flush()

        _log_timeline(
            db, wf.id,
            event_type="workflow_created",
            actor="system",
            description=f"Workflow auto-triggered from {finding.risk_level} finding. "
                        f"Routed to {platform.upper()} via {ref_id}.",
            metadata={
                "source": "finding",
                "finding_id": finding.id,
                "risk_level": finding.risk_level,
                "platform": platform,
                "external_reference": ref_id,
            }
        )
        created += 1

    db.commit()
    return {"workflows_created": created, "findings_skipped": skipped}


# ─────────────────────────────────────────────
# FULL AUTO-TRIGGER RUN
# ─────────────────────────────────────────────

def run_auto_trigger(db: Session) -> dict:
    cluster_result = auto_trigger_from_clusters(db)
    finding_result = auto_trigger_from_findings(db)
    return {
        "from_clusters": cluster_result,
        "from_findings": finding_result,
        "triggered_at": datetime.utcnow().isoformat(),
    }


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _workflow_type_for_cluster(cluster_type: str) -> str:
    mapping = {
        "unused_privileged": "privileged_access_review",
        "missing_owner": "owner_assignment",
        "stale_review": "stale_review_remediation",
        "orphaned_roles": "orphaned_role_cleanup",
        "duplicate_variants": "role_consolidation",
    }
    return mapping.get(cluster_type, "governance_review")
